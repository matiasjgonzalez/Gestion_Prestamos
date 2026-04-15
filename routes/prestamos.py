import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
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
from services.mora_service import obtener_cuotas_en_mora
from services.auth import get_current_user
from datetime import date, datetime, timezone

router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    total_prestado = db.query(sqlfunc.sum(Prestamo.monto)).scalar() or 0
    total_cobrado = db.query(sqlfunc.sum(Pago.monto_pagado)).scalar() or 0
    total_cuotas = db.query(sqlfunc.sum(Cuota.monto)).scalar() or 0
    deuda_total = round(float(total_cuotas) - float(total_cobrado), 2)
    prestamos_activos = (
        db.query(sqlfunc.count(Prestamo.id))
        .filter(Prestamo.estado == "activo")
        .scalar() or 0
    )
    clientes_count = (
        db.query(sqlfunc.count(sqlfunc.distinct(Prestamo.cliente_id))).scalar() or 0
    )

    # Préstamos por tipo
    tipos_rows = (
        db.query(Prestamo.tipo_prestamo, sqlfunc.count(Prestamo.id))
        .group_by(Prestamo.tipo_prestamo)
        .all()
    )
    prestamos_por_tipo = [{"tipo": t or "mensual", "cantidad": c} for t, c in tipos_rows]

    # Cuotas por estado
    estados_rows = (
        db.query(Cuota.estado, sqlfunc.count(Cuota.id))
        .group_by(Cuota.estado)
        .all()
    )
    cuotas_por_estado = [{"estado": e, "cantidad": c} for e, c in estados_rows]

    mora_result = obtener_cuotas_en_mora(db, limit=100_000)
    return {
        "total_prestado": float(total_prestado),
        "total_cobrado": float(total_cobrado),
        "deuda_total": deuda_total,
        "prestamos_activos": prestamos_activos,
        "clientes_con_prestamos": clientes_count,
        "prestamos_por_tipo": prestamos_por_tipo,
        "cuotas_por_estado": cuotas_por_estado,
        "mora": {"total_en_mora": mora_result["total"], "cuotas": mora_result["cuotas"]},
    }


@router.get("/{prestamo_id}/completo")
def detalle_completo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
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

    # Compute monto_efectivo: unattributed surplus reduces the first unpaid cuota
    sum_pagadas = sum(float(c.monto) for c in cuotas_sorted if c.estado == "pagada")
    surplus = max(0.0, total_pagado - sum_pagadas)
    cuotas_data = []
    for c in cuotas_sorted:
        c_monto = float(c.monto)
        if c.estado == "pagada":
            efectivo = 0.0
        elif surplus > 0:
            efectivo = max(0.0, round(c_monto - surplus, 2))
            surplus = max(0.0, surplus - c_monto)
        else:
            efectivo = c_monto
        cuotas_data.append({
            "id": c.id, "prestamo_id": c.prestamo_id,
            "numero_cuota": c.numero_cuota,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
            "monto": c_monto, "monto_efectivo": efectivo, "estado": c.estado,
        })

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
        } if prestamo.cliente else None,
        "cuotas_rel": cuotas_data,
        "pagos": [
            {
                "id": p.id, "prestamo_id": p.prestamo_id,
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


@router.post("/{prestamo_id}/cuotas/{cuota_id}/marcar-pagada")
def marcar_cuota_pagada(
    prestamo_id: int,
    cuota_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Marca una cuota individual como pagada y registra el pago."""
    cuota = (
        db.query(Cuota)
        .filter(Cuota.id == cuota_id, Cuota.prestamo_id == prestamo_id)
        .first()
    )
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")
    if cuota.estado == "pagada":
        raise HTTPException(status_code=400, detail="La cuota ya está pagada")

    cuota.estado = "pagada"
    db.add(cuota)

    # Registrar pago automático
    pago = Pago(
        prestamo_id=prestamo_id,
        cuota_id=cuota_id,
        monto_pagado=float(cuota.monto),
        fecha_pago=datetime.now(timezone.utc),
        dias_atraso=max(0, (date.today() - cuota.fecha_vencimiento).days) if cuota.fecha_vencimiento <= date.today() else 0,
    )
    db.add(pago)

    # Verificar si todas las cuotas están pagadas
    no_pagadas = (
        db.query(Cuota)
        .filter(Cuota.prestamo_id == prestamo_id, Cuota.estado != "pagada")
        .count()
    )
    if no_pagadas <= 1:  # la actual se está marcando
        prestamo = db.query(Prestamo).filter(Prestamo.id == prestamo_id).first()
        if prestamo:
            prestamo.estado = "finalizado"
            db.add(prestamo)

    db.commit()
    return {"ok": True, "message": f"Cuota #{cuota.numero_cuota} marcada como pagada"}


@router.post("/{prestamo_id}/cuotas/{cuota_id}/desmarcar-pagada")
def desmarcar_cuota_pagada(
    prestamo_id: int,
    cuota_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Revierte el marcado de una cuota como pagada y elimina el pago automático asociado."""
    cuota = (
        db.query(Cuota)
        .filter(Cuota.id == cuota_id, Cuota.prestamo_id == prestamo_id)
        .first()
    )
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")
    if cuota.estado != "pagada":
        raise HTTPException(status_code=400, detail="La cuota no está marcada como pagada")

    # Restaurar estado según si venció o no
    cuota.estado = "vencida" if cuota.fecha_vencimiento < date.today() else "pendiente"
    db.add(cuota)

    # Eliminar el pago automático vinculado a esta cuota
    pago_auto = (
        db.query(Pago)
        .filter(Pago.prestamo_id == prestamo_id, Pago.cuota_id == cuota_id)
        .first()
    )
    if pago_auto:
        db.delete(pago_auto)

    # Si el préstamo estaba finalizado, reactivarlo
    prestamo = db.query(Prestamo).filter(Prestamo.id == prestamo_id).first()
    if prestamo and prestamo.estado == "finalizado":
        prestamo.estado = "activo"
        db.add(prestamo)

    db.commit()
    return {"ok": True, "message": f"Cuota #{cuota.numero_cuota} desmarcada"}


@router.post("/{prestamo_id}/cancelar")
def cancelar_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Cancela el préstamo: marca todas las cuotas pendientes como pagadas."""
    prestamo = db.query(Prestamo).filter(Prestamo.id == prestamo_id).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    if prestamo.estado == "finalizado":
        raise HTTPException(status_code=400, detail="El préstamo ya está finalizado")

    cuotas_pendientes = (
        db.query(Cuota)
        .filter(
            Cuota.prestamo_id == prestamo_id,
            Cuota.estado.in_(["pendiente", "vencida"]),
        )
        .all()
    )

    total_restante = sum(float(c.monto) for c in cuotas_pendientes)

    for c in cuotas_pendientes:
        c.estado = "pagada"
        db.add(c)

    # Registrar pago por el total restante
    if total_restante > 0:
        pago = Pago(
            prestamo_id=prestamo_id,
            monto_pagado=total_restante,
            fecha_pago=datetime.now(timezone.utc),
            dias_atraso=0,
        )
        db.add(pago)

    prestamo.estado = "finalizado"
    db.add(prestamo)
    db.commit()

    return {
        "ok": True,
        "message": f"Préstamo #{prestamo_id} cancelado. {len(cuotas_pendientes)} cuotas marcadas como pagadas.",
    }


@router.post("/", response_model=PrestamoRead)
def crear_prestamo(
    payload: PrestamoCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
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
        tipo_prestamo=payload.tipo_prestamo,
    )
    return prestamo


@router.get("/export/xlsx")
def export_prestamos_xlsx(
    estado: Optional[str] = Query(None),
    cliente_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    q = db.query(Prestamo, Cliente).join(Cliente, Prestamo.cliente_id == Cliente.id)
    if estado:
        q = q.filter(Prestamo.estado == estado)
    if cliente_id:
        q = q.filter(Prestamo.cliente_id == cliente_id)
    rows = q.order_by(Prestamo.id.desc()).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Préstamos"

    headers = ["ID", "Cliente", "DNI", "Tipo", "Monto", "Interés (%)", "Cuotas", "Fecha Inicio", "Estado"]
    header_fill = PatternFill("solid", fgColor="0284C7")
    header_font = Font(bold=True, color="FFFFFF")
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for p, c in rows:
        ws.append([
            p.id, f"{c.nombre} {c.apellido}", c.dni,
            p.tipo_prestamo or "mensual",
            float(p.monto), p.interes_total, p.cuotas,
            p.fecha_inicio.isoformat() if p.fecha_inicio else "",
            p.estado,
        ])

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(c.value or "")) for c in col) + 4

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        iter([output.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=prestamos.xlsx"},
    )


@router.get("/")
def listar_prestamos(
    offset: int = 0,
    limit: int = 10,
    estado: Optional[str] = Query(None),
    cliente_id: Optional[int] = Query(None),
    tipo_prestamo: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    q = (
        db.query(Prestamo)
        .options(joinedload(Prestamo.cliente))
        .join(Cliente, Prestamo.cliente_id == Cliente.id)
    )
    if estado:
        q = q.filter(Prestamo.estado == estado)
    if cliente_id:
        q = q.filter(Prestamo.cliente_id == cliente_id)
    if tipo_prestamo:
        q = q.filter(Prestamo.tipo_prestamo == tipo_prestamo)
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            (Cliente.nombre + " " + Cliente.apellido).ilike(term)
        )
    items = q.order_by(Prestamo.id.desc()).offset(offset).limit(limit).all()
    return [
        {
            "id": p.id,
            "cliente_id": p.cliente_id,
            "cliente_nombre": f"{p.cliente.nombre} {p.cliente.apellido}" if p.cliente else "—",
            "cliente_dni": p.cliente.dni if p.cliente else "—",
            "monto": float(p.monto),
            "interes_total": p.interes_total,
            "cuotas": p.cuotas,
            "monto_cuota": float(p.monto_cuota) if p.monto_cuota else None,
            "fecha_inicio": p.fecha_inicio.isoformat() if p.fecha_inicio else None,
            "estado": p.estado,
            "tipo_prestamo": p.tipo_prestamo or "mensual",
        }
        for p in items
    ]


@router.get("/{prestamo_id}", response_model=PrestamoRead)
def obtener_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    p = db.query(Prestamo).filter(Prestamo.id == prestamo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    return p


@router.get("/{prestamo_id}/deuda")
def deuda_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
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
    _user=Depends(get_current_user),
):
    p = db.query(Prestamo).get(prestamo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    return db.query(Cuota).filter(Cuota.prestamo_id == prestamo_id).order_by(Cuota.numero_cuota).all()


@router.put("/{prestamo_id}/cuotas/{cuota_id}", response_model=CuotaRead)
def actualizar_cuota(
    prestamo_id: int,
    cuota_id: int,
    payload: CuotaUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    cuota = db.query(Cuota).filter(Cuota.id == cuota_id, Cuota.prestamo_id == prestamo_id).first()
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
    _user=Depends(get_current_user),
):
    p = db.query(Prestamo).get(prestamo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}
