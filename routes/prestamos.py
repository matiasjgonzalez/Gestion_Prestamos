from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sqlfunc
from database import get_db
from schemas.prestamo import PrestamoCreate, PrestamoRead
from schemas.cuota import CuotaRead, CuotaUpdate
from models.prestamo import Prestamo
from models.cuota import Cuota
from models.pago import Pago
from models.client import Cliente
from services.prestamo_service import create_prestamo, calcular_deuda_restante
from services.mora_service import verificar_mora, obtener_cuotas_en_mora
from services.auth import get_current_user
from datetime import date

router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Dashboard unificado: stats + mora en 1 sola request."""
    # Verificar mora automáticamente
    verificar_mora(db)

    total_prestado = db.query(sqlfunc.sum(Prestamo.monto)).scalar() or 0
    total_cobrado = db.query(sqlfunc.sum(Pago.monto_pagado)).scalar() or 0
    total_cuotas = db.query(sqlfunc.sum(Cuota.monto)).scalar() or 0
    deuda_total = round(float(total_cuotas) - float(total_cobrado), 2)

    prestamos_activos = (
        db.query(sqlfunc.count(Prestamo.id))
        .filter(Prestamo.estado == "activo")
        .scalar()
        or 0
    )
    clientes_count = (
        db.query(sqlfunc.count(sqlfunc.distinct(Prestamo.cliente_id))).scalar() or 0
    )

    # Mora incluida en la misma respuesta
    cuotas_mora = obtener_cuotas_en_mora(db)

    return {
        "total_prestado": float(total_prestado),
        "total_cobrado": float(total_cobrado),
        "deuda_total": deuda_total,
        "prestamos_activos": prestamos_activos,
        "clientes_con_prestamos": clientes_count,
        "mora": {
            "total_en_mora": len(cuotas_mora),
            "cuotas": cuotas_mora,
        },
    }


@router.get("/{prestamo_id}/completo")
def detalle_completo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Detalle completo de un préstamo: datos, cliente, cuotas, pagos, deuda. 1 sola request."""
    prestamo = (
        db.query(Prestamo)
        .options(
            joinedload(Prestamo.cuotas_rel),
            joinedload(Prestamo.pagos),
            joinedload(Prestamo.cliente),
        )
        .filter(Prestamo.id == prestamo_id)
        .first()
    )
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    total_pagado = sum(float(p.monto_pagado) for p in prestamo.pagos)
    total_cuotas = sum(float(c.monto) for c in prestamo.cuotas_rel)
    deuda = round(total_cuotas - total_pagado, 2)

    cuotas_sorted = sorted(prestamo.cuotas_rel, key=lambda c: c.numero_cuota)
    pagos_sorted = sorted(prestamo.pagos, key=lambda p: p.fecha_pago, reverse=True)

    return {
        "prestamo": {
            "id": prestamo.id,
            "cliente_id": prestamo.cliente_id,
            "monto": float(prestamo.monto),
            "interes_total": prestamo.interes_total,
            "cuotas": prestamo.cuotas,
            "monto_cuota": float(prestamo.monto_cuota) if prestamo.monto_cuota else None,
            "fecha_inicio": prestamo.fecha_inicio.isoformat() if prestamo.fecha_inicio else None,
            "estado": prestamo.estado,
        },
        "cliente": {
            "id": prestamo.cliente.id,
            "nombre": prestamo.cliente.nombre,
            "apellido": prestamo.cliente.apellido,
            "dni": prestamo.cliente.dni,
        }
        if prestamo.cliente
        else None,
        "cuotas_rel": [
            {
                "id": c.id,
                "prestamo_id": c.prestamo_id,
                "numero_cuota": c.numero_cuota,
                "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
                "monto": float(c.monto),
                "estado": c.estado,
            }
            for c in cuotas_sorted
        ],
        "pagos": [
            {
                "id": p.id,
                "prestamo_id": p.prestamo_id,
                "monto_pagado": float(p.monto_pagado),
                "fecha_pago": p.fecha_pago.isoformat() if p.fecha_pago else None,
                "dias_atraso": p.dias_atraso,
            }
            for p in pagos_sorted
        ],
        "deuda_restante": deuda,
        "total_cuotas": total_cuotas,
        "total_pagado": total_pagado,
    }


@router.post("/", response_model=PrestamoRead)
def crear_prestamo(
    payload: PrestamoCreate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    if len(payload.cuotas_detalle) != payload.cuotas:
        raise HTTPException(
            status_code=400,
            detail=f"Se esperaban {payload.cuotas} cuotas pero se recibieron {len(payload.cuotas_detalle)}",
        )
    prestamo = create_prestamo(
        db,
        cliente_id=payload.cliente_id,
        monto=payload.monto,
        interes_total=payload.interes_total,
        num_cuotas=payload.cuotas,
        cuotas_detalle=payload.cuotas_detalle,
        fecha_inicio=payload.fecha_inicio,
    )
    return prestamo


@router.get("/", response_model=list[PrestamoRead])
def listar_prestamos(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    return (
        db.query(Prestamo)
        .options(joinedload(Prestamo.cuotas_rel))
        .all()
    )


@router.get("/{prestamo_id}", response_model=PrestamoRead)
def obtener_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    p = (
        db.query(Prestamo)
        .options(joinedload(Prestamo.cuotas_rel))
        .filter(Prestamo.id == prestamo_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    return p


@router.get("/{prestamo_id}/deuda")
def deuda_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    p = db.query(Prestamo).get(prestamo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    deuda = calcular_deuda_restante(db, p)
    return {"deuda_restante": deuda}


@router.get("/{prestamo_id}/cuotas", response_model=list[CuotaRead])
def listar_cuotas(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    p = db.query(Prestamo).get(prestamo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    return (
        db.query(Cuota)
        .filter(Cuota.prestamo_id == prestamo_id)
        .order_by(Cuota.numero_cuota)
        .all()
    )


@router.put("/{prestamo_id}/cuotas/{cuota_id}", response_model=CuotaRead)
def actualizar_cuota(
    prestamo_id: int,
    cuota_id: int,
    payload: CuotaUpdate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cuota = (
        db.query(Cuota)
        .filter(Cuota.id == cuota_id, Cuota.prestamo_id == prestamo_id)
        .first()
    )
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")
    if payload.fecha_vencimiento is not None:
        cuota.fecha_vencimiento = payload.fecha_vencimiento
    if payload.monto is not None:
        cuota.monto = payload.monto
    db.add(cuota)
    db.commit()
    db.refresh(cuota)
    return cuota


@router.delete("/{prestamo_id}")
def eliminar_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    p = db.query(Prestamo).get(prestamo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}
