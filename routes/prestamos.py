from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from database import get_db
from schemas.prestamo import PrestamoCreate, PrestamoRead
from schemas.cuota import CuotaRead, CuotaUpdate
from models.prestamo import Prestamo
from models.cuota import Cuota
from models.pago import Pago
from services.prestamo_service import create_prestamo, calcular_deuda_restante
from services.auth import get_current_user

router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    total_prestado = (
        db.query(sqlfunc.sum(Prestamo.monto)).scalar() or 0
    )
    total_cobrado = (
        db.query(sqlfunc.sum(Pago.monto_pagado)).scalar() or 0
    )
    total_cuotas = (
        db.query(sqlfunc.sum(Cuota.monto)).scalar() or 0
    )
    deuda_total = round(float(total_cuotas) - float(total_cobrado), 2)

    prestamos_activos = (
        db.query(sqlfunc.count(Prestamo.id))
        .filter(Prestamo.estado == "activo")
        .scalar()
        or 0
    )
    clientes_count = db.query(
        sqlfunc.count(sqlfunc.distinct(Prestamo.cliente_id))
    ).scalar() or 0

    return {
        "total_prestado": float(total_prestado),
        "total_cobrado": float(total_cobrado),
        "deuda_total": deuda_total,
        "prestamos_activos": prestamos_activos,
        "clientes_con_prestamos": clientes_count,
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
    return db.query(Prestamo).all()


@router.get("/{prestamo_id}", response_model=PrestamoRead)
def obtener_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    p = db.query(Prestamo).get(prestamo_id)
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
