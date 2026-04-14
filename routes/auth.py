from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from schemas.user import Token
from services.auth import authenticate_user, create_access_token, get_current_user
from database import get_db
from datetime import timedelta

router = APIRouter()


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token(
        {"sub": user.username},
        expires_delta=timedelta(hours=24),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
        "is_admin": user.is_admin,
    }


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return {
        "username": current_user.username,
        "is_admin": current_user.is_admin,
        "must_change_password": current_user.must_change_password,
    }
