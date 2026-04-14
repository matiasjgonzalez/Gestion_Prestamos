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


def obtener_cuotas_en_mora(
    db: Session,
    search: str = "",
    limit: int = 10,
    offset: int = 0,
) -> dict:
    """
    Retorna las cuotas en mora paginadas, con búsqueda por nombre de cliente.
    """
    from models.client import Cliente
    hoy = date.today()
    q = (
        db.query(Cuota)
        .options(joinedload(Cuota.prestamo).joinedload(Prestamo.cliente))
        .join(Cuota.prestamo)
        .join(Prestamo.cliente)
        .filter(Cuota.estado == "vencida")
    )
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            (Cliente.nombre + " " + Cliente.apellido).ilike(term)
        )
    total = q.count()
    cuotas = q.order_by(Cuota.fecha_vencimiento).offset(offset).limit(limit).all()
    items = [
        {
            "cuota_id": c.id,
            "prestamo_id": c.prestamo_id,
            "numero_cuota": c.numero_cuota,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
            "monto": float(c.monto),
            "dias_atraso": (hoy - c.fecha_vencimiento).days,
            "cliente_nombre": f"{c.prestamo.cliente.nombre} {c.prestamo.cliente.apellido}" if c.prestamo and c.prestamo.cliente else None,
            "cliente_dni": c.prestamo.cliente.dni if c.prestamo and c.prestamo.cliente else None,
        }
        for c in cuotas
    ]
    return {"total": total, "cuotas": items}
