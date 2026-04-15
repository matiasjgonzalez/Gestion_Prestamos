from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models.cuota import Cuota
from models.prestamo import Prestamo
from models.client import Cliente
from services.auth import get_current_user

router = APIRouter()


def _cuota_dict(c):
    return {
        "cuota_id": c.id,
        "prestamo_id": c.prestamo_id,
        "numero_cuota": c.numero_cuota,
        "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
        "monto": float(c.monto),
        "estado": c.estado,
        "cliente_nombre": (
            f"{c.prestamo.cliente.nombre} {c.prestamo.cliente.apellido}"
            if c.prestamo and c.prestamo.cliente
            else "—"
        ),
    }


@router.get("")
def get_calendario(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(..., ge=2000),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    from datetime import date
    from calendar import monthrange

    _, ultimo_dia = monthrange(anio, mes)
    fecha_inicio = date(anio, mes, 1)
    fecha_fin = date(anio, mes, ultimo_dia)

    base_query = (
        lambda: db.query(Cuota)
        .options(joinedload(Cuota.prestamo).joinedload(Prestamo.cliente))
        .join(Cuota.prestamo)
        .join(Prestamo.cliente)
    )

    # Cuotas del mes (todos los estados: pendiente, vencida, pagada)
    cuotas_mes = (
        base_query()
        .filter(
            Cuota.fecha_vencimiento >= fecha_inicio,
            Cuota.fecha_vencimiento <= fecha_fin,
        )
        .order_by(Cuota.fecha_vencimiento, Cliente.apellido)
        .all()
    )

    # Cuotas vencidas de meses anteriores (sin pagar, de préstamos activos)
    vencidas_anteriores = (
        base_query()
        .filter(
            Cuota.fecha_vencimiento < fecha_inicio,
            Cuota.estado == "vencida",
            Prestamo.estado == "activo",
        )
        .order_by(Cuota.fecha_vencimiento, Cliente.apellido)
        .all()
    )

    por_dia = {}
    for c in cuotas_mes:
        dia = c.fecha_vencimiento.day
        if dia not in por_dia:
            por_dia[dia] = []
        por_dia[dia].append(_cuota_dict(c))

    return {
        "mes": mes,
        "anio": anio,
        "dias": por_dia,
        "vencidas_anteriores": [_cuota_dict(c) for c in vencidas_anteriores],
    }
