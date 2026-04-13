from datetime import date
from sqlalchemy.orm import Session, joinedload
from models.cuota import Cuota
from models.prestamo import Prestamo


def verificar_mora(db: Session) -> list[dict]:
    """
    Marca en bulk las cuotas pendientes vencidas como 'vencida'.
    Retorna las que acaba de actualizar.
    """
    hoy = date.today()
    cuotas = (
        db.query(Cuota)
        .filter(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < hoy)
        .all()
    )
    if not cuotas:
        return []

    ids = [c.id for c in cuotas]
    db.query(Cuota).filter(Cuota.id.in_(ids)).update(
        {"estado": "vencida"}, synchronize_session=False
    )
    db.commit()

    return [
        {
            "cuota_id": c.id,
            "prestamo_id": c.prestamo_id,
            "numero_cuota": c.numero_cuota,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
            "monto": float(c.monto),
            "dias_atraso": (hoy - c.fecha_vencimiento).days,
        }
        for c in cuotas
    ]


def obtener_cuotas_en_mora(db: Session) -> list[dict]:
    """
    Retorna las cuotas en mora con datos del cliente en una sola query (JOIN).
    """
    hoy = date.today()
    cuotas = (
        db.query(Cuota)
        .options(joinedload(Cuota.prestamo).joinedload(Prestamo.cliente))
        .filter(Cuota.estado == "vencida")
        .order_by(Cuota.fecha_vencimiento)
        .all()
    )
    return [
        {
            "cuota_id": c.id,
            "prestamo_id": c.prestamo_id,
            "numero_cuota": c.numero_cuota,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
            "monto": float(c.monto),
            "dias_atraso": (hoy - c.fecha_vencimiento).days,
            "cliente_nombre": c.prestamo.cliente.nombre if c.prestamo and c.prestamo.cliente else None,
            "cliente_apellido": c.prestamo.cliente.apellido if c.prestamo and c.prestamo.cliente else None,
        }
        for c in cuotas
    ]
