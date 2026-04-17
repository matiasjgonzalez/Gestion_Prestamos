from datetime import date
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sqlfunc, or_
from models.cuota import Cuota
from models.prestamo import Prestamo
from models.client import Cliente


def verificar_mora(db: Session) -> list[dict]:
    """
    Marca en bulk las cuotas pendientes vencidas como 'vencida'.
    Retorna las que acaba de actualizar.
    """
    hoy = date.today()
    # Fetch first para poder retornar los datos
    cuotas = (
        db.query(Cuota)
        .filter(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < hoy)
        .all()
    )
    if not cuotas:
        return []

    # UPDATE directo sin construir lista de IDs intermedia (#9)
    db.query(Cuota).filter(
        Cuota.estado == "pendiente",
        Cuota.fecha_vencimiento < hoy,
    ).update({"estado": "vencida"}, synchronize_session=False)
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
    Retorna las cuotas en mora paginadas. Busca por nombre o DNI (#5).
    Usa queries separadas para count/sum y datos para evitar conflicto
    entre joinedload y with_entities (#11).
    """
    hoy = date.today()

    # Filtros base reutilizables
    filters = [Cuota.estado == "vencida"]
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                (Cliente.nombre + " " + Cliente.apellido).ilike(term),
                Cliente.dni.ilike(term),
            )
        )

    def _base_q():
        return (
            db.query(Cuota)
            .join(Cuota.prestamo)
            .join(Prestamo.cliente)
            .filter(*filters)
        )

    # Count y sum en queries limpias sin joinedload (#11)
    total = _base_q().count()
    total_monto = (
        _base_q()
        .with_entities(sqlfunc.coalesce(sqlfunc.sum(Cuota.monto), 0))
        .scalar()
    )

    # Query de datos con joinedload para evitar N+1
    cuotas = (
        _base_q()
        .options(joinedload(Cuota.prestamo).joinedload(Prestamo.cliente))
        .order_by(Cuota.fecha_vencimiento)
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        {
            "cuota_id": c.id,
            "prestamo_id": c.prestamo_id,
            "numero_cuota": c.numero_cuota,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
            "monto": float(c.monto),
            "dias_atraso": (hoy - c.fecha_vencimiento).days,
            "cliente_nombre": (
                f"{c.prestamo.cliente.nombre} {c.prestamo.cliente.apellido}"
                if c.prestamo and c.prestamo.cliente else None
            ),
            "cliente_dni": (
                c.prestamo.cliente.dni
                if c.prestamo and c.prestamo.cliente else None
            ),
        }
        for c in cuotas
    ]
    return {"total": total, "total_monto": float(total_monto), "cuotas": items}
