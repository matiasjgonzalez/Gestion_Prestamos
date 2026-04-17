from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from database import get_db
from schemas.pago import PagoCreate, PagoRead
from models.pago import Pago
from models.prestamo import Prestamo
from models.cuota import Cuota
from services.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter()


@router.post("/", response_model=PagoRead)
def registrar_pago(
    payload: PagoCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    prestamo = db.query(Prestamo).filter(Prestamo.id == payload.prestamo_id).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    if prestamo.estado == "finalizado":
        raise HTTPException(status_code=400, detail="El préstamo ya está finalizado")

    # Validar que el monto no supere la deuda restante
    deuda_restante = float(
        db.query(sqlfunc.coalesce(sqlfunc.sum(Cuota.monto), 0))
        .filter(Cuota.prestamo_id == prestamo.id, Cuota.estado.in_(["pendiente", "vencida"]))
        .scalar()
    )
    if float(payload.monto_pagado) > deuda_restante + 0.01:  # +0.01 por redondeo
        raise HTTPException(
            status_code=400,
            detail=f"El monto del pago (${float(payload.monto_pagado):,.2f}) supera la deuda restante (${deuda_restante:,.2f})"
        )

    pago_fecha = payload.fecha_pago or datetime.now(timezone.utc)
    monto = float(payload.monto_pagado)

    # Calcular dias de atraso respecto a la primera cuota pendiente/vencida
    cuota_pendiente = (
        db.query(Cuota)
        .filter(
            Cuota.prestamo_id == prestamo.id,
            Cuota.estado.in_(["pendiente", "vencida"]),
        )
        .order_by(Cuota.numero_cuota)
        .first()
    )
    dias_atraso = 0
    if cuota_pendiente:
        venc = cuota_pendiente.fecha_vencimiento
        pago_date = pago_fecha.date() if hasattr(pago_fecha, "date") else pago_fecha
        delta = (pago_date - venc).days
        dias_atraso = delta if delta > 0 else 0

    pago = Pago(
        prestamo_id=prestamo.id,
        monto_pagado=monto,
        fecha_pago=pago_fecha,
        dias_atraso=dias_atraso,
    )
    db.add(pago)
    db.flush()

    # Aplicar pago a cuotas pendientes/vencidas en orden
    pendientes = (
        db.query(Cuota)
        .filter(
            Cuota.prestamo_id == prestamo.id,
            Cuota.estado.in_(["pendiente", "vencida"]),
        )
        .order_by(Cuota.numero_cuota)
        .all()
    )
    restante = monto
    for c in pendientes:
        if restante >= float(c.monto):
            restante -= float(c.monto)
            c.estado = "pagada"
            db.add(c)
        else:
            break

    # Si todas las cuotas están pagadas, finalizar préstamo
    no_pagadas = (
        db.query(Cuota)
        .filter(Cuota.prestamo_id == prestamo.id, Cuota.estado != "pagada")
        .count()
    )
    if no_pagadas == 0:
        prestamo.estado = "finalizado"
        db.add(prestamo)

    db.commit()
    db.refresh(pago)
    return pago


@router.get("/", response_model=list[PagoRead])
def listar_pagos(
    prestamo_id: int = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(Pago)
    if prestamo_id:
        query = query.filter(Pago.prestamo_id == prestamo_id)
    return query.order_by(Pago.fecha_pago.desc()).all()
