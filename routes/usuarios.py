from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.usuario import Usuario
from schemas.user import UsuarioCreate, UsuarioRead, PasswordChange, PasswordReset
from services.auth import get_current_user, get_admin_user, hash_password, verify_password

router = APIRouter()


@router.get("/", response_model=list[UsuarioRead])
def listar_usuarios(
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    return db.query(Usuario).order_by(Usuario.username).all()


@router.post("/", response_model=UsuarioRead)
def crear_usuario(
    payload: UsuarioCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    if db.query(Usuario).filter(Usuario.username == payload.username).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    user = Usuario(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        is_admin=payload.is_admin,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    user = db.query(Usuario).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.hashed_password = hash_password(payload.temp_password)
    user.must_change_password = True
    db.add(user)
    db.commit()
    return {"ok": True, "message": f"Contraseña de '{user.username}' reseteada"}


@router.put("/{user_id}/toggle-active")
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    user = db.query(Usuario).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="No podés desactivar tu propio usuario")
    user.is_active = not user.is_active
    db.add(user)
    db.commit()
    return {"ok": True, "is_active": user.is_active}


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.add(current_user)
    db.commit()
    return {"ok": True}
