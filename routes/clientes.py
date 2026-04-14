from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from datetime import date
from database import get_db
from models.client import Cliente
from models.prestamo import Prestamo
from models.cuota import Cuota
from models.pago import Pago
from schemas.client import ClienteCreate, ClienteRead, ClienteUpdate
from services.auth import get_current_user

router = APIRouter()


@router.post("/", response_model=ClienteRead)
def create_cliente(
    payload: ClienteCreate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    existente = db.query(Cliente).filter(Cliente.dni == payload.dni).first()
    if existente:
        raise HTTPException(status_code=400, detail="DNI ya registrado")
    cliente = Cliente(**payload.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/", response_model=list[ClienteRead])
def list_clientes(
    offset: int = 0,
    limit: int = 100,
    search: str = Query(None, description="Buscar por nombre, apellido o DNI"),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    query = db.query(Cliente)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Cliente.nombre.ilike(pattern))
            | (Cliente.apellido.ilike(pattern))
            | (Cliente.dni.ilike(pattern))
            | (func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(pattern))
        )
    clientes = query.order_by(Cliente.apellido, Cliente.nombre).offset(offset).limit(limit).all()

    # IDs de clientes con mora: ya marcadas como "vencida" O pendientes con fecha pasada
    ids_con_mora = set(
        row[0] for row in db.query(Prestamo.cliente_id)
        .join(Cuota, Cuota.prestamo_id == Prestamo.id)
        .filter(
            or_(
                Cuota.estado == "vencida",
                and_(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < date.today())
            )
        )
        .distinct()
        .all()
    )

    result = []
    for c in clientes:
        item = ClienteRead.model_validate(c)
        item.tiene_mora = c.id in ids_con_mora
        result.append(item)
    return result


@router.get("/{cliente_id}/resumen")
def get_cliente_resumen(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cliente = db.query(Cliente).get(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    prestamos = db.query(Prestamo).filter(Prestamo.cliente_id == cliente_id).all()
    prestamo_ids = [p.id for p in prestamos]

    total_cuotas = db.query(func.sum(Cuota.monto)).filter(Cuota.prestamo_id.in_(prestamo_ids)).scalar() or 0
    total_pagado = db.query(func.sum(Pago.monto_pagado)).filter(Pago.prestamo_id.in_(prestamo_ids)).scalar() or 0
    monto_mora = db.query(func.sum(Cuota.monto)).filter(
        Cuota.prestamo_id.in_(prestamo_ids),
        or_(
            Cuota.estado == "vencida",
            and_(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < date.today())
        )
    ).scalar() or 0

    return {
        "prestamos_total": len(prestamos),
        "prestamos_activos": sum(1 for p in prestamos if p.estado == "activo"),
        "deuda_total": round(float(total_cuotas) - float(total_pagado), 2),
        "tiene_mora": monto_mora > 0,
        "monto_mora": float(monto_mora),
    }


@router.get("/{cliente_id}", response_model=ClienteRead)
def get_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cliente = db.query(Cliente).get(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.put("/{cliente_id}", response_model=ClienteRead)
def update_cliente(
    cliente_id: int,
    payload: ClienteUpdate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cliente = db.query(Cliente).get(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cliente, k, v)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}")
def delete_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cliente = db.query(Cliente).get(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(cliente)
    db.commit()
    return {"ok": True}
