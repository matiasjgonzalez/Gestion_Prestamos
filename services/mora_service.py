from datetime import date
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sqlfunc, or_
from models.cuota import Cuota
from models.prestamo import Prestamo
from models.client import Cliente


def obtener_clientes_en_mora(
    db: Session,
    search: str = "",
    limit: int = 10,
    offset: int = 0,
    sort_desc: bool = False,
) -> dict:
    """
    Retorna un cliente por fila (agrupado) con cuotas en mora.
    """
    hoy = date.today()

    filters = [Cuota.estado == "vencida"]
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                (Cliente.nombre + " " + Cliente.apellido).ilike(term),
                Cliente.dni.ilike(term),
            )
        )

    base = (
        db.query(
            Cliente.id.label("cliente_id"),
            Cliente.nombre.label("nombre"),
            Cliente.apellido.label("apellido"),
            Cliente.dni.label("dni"),
            sqlfunc.count(Cuota.id).label("cuotas_en_mora"),
            sqlfunc.sum(Cuota.monto).label("monto_total"),
            sqlfunc.min(Cuota.fecha_vencimiento).label("fecha_primera_mora"),
        )
        .select_from(Cuota)
        .join(Prestamo, Cuota.prestamo_id == Prestamo.id)
        .join(Cliente, Prestamo.cliente_id == Cliente.id)
        .filter(*filters)
        .group_by(Cliente.id, Cliente.nombre, Cliente.apellido, Cliente.dni)
    )

    # Count distinct clients
    total = db.query(sqlfunc.count()).select_from(base.subquery()).scalar() or 0

    order = (Cliente.apellido.desc(), Cliente.nombre.desc()) if sort_desc else (Cliente.apellido, Cliente.nombre)
    rows = (
        base
        .order_by(*order)
        .offset(offset)
        .limit(limit)
        .all()
    )

    total_monto = db.query(
        sqlfunc.coalesce(sqlfunc.sum(Cuota.monto), 0)
    ).select_from(Cuota).join(Prestamo, Cuota.prestamo_id == Prestamo.id).join(
        Cliente, Prestamo.cliente_id == Cliente.id
    ).filter(*filters).scalar()

    items = [
        {
            "cliente_id": r.cliente_id,
            "cliente_nombre": r.nombre,
            "cliente_apellido": r.apellido,
            "cliente_dni": r.dni,
            "cuotas_en_mora": r.cuotas_en_mora,
            "monto_total": float(r.monto_total or 0),
            "dias_atraso": (hoy - r.fecha_primera_mora).days if r.fecha_primera_mora else 0,
        }
        for r in rows
    ]
    return {"total": total, "total_monto": float(total_monto or 0), "clientes": items}


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
            "cliente_id": (
                c.prestamo.cliente.id
                if c.prestamo and c.prestamo.cliente else None
            ),
            "cliente_nombre": (
                c.prestamo.cliente.nombre
                if c.prestamo and c.prestamo.cliente else None
            ),
            "cliente_apellido": (
                c.prestamo.cliente.apellido
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
