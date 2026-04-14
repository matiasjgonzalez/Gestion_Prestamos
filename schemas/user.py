from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False
    is_admin: bool = False


class UsuarioCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False


class UsuarioRead(BaseModel):
    id: int
    username: str
    is_admin: bool
    must_change_password: bool
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PasswordChange(BaseModel):
    new_password: str


class PasswordReset(BaseModel):
    temp_password: str
