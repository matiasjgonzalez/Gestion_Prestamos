from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import HTTPException
from schemas.user import Token
from services.auth import authenticate_user, create_access_token
from datetime import timedelta

router = APIRouter()


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if not authenticate_user(form_data.username, form_data.password):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    access_token_expires = timedelta(minutes=60 * 24)
    token = create_access_token(
        {"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": token, "token_type": "bearer"}
