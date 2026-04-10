from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models.client import Cliente
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
    skip: int = 0,
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
        )
    return query.offset(skip).limit(limit).all()


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
