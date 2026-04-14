from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ClienteBase(BaseModel):
    nombre: str
    apellido: str
    dni: str
    telefono: Optional[str] = None
    domicilio: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteRead(ClienteBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    tiene_mora: bool = False

    model_config = {"from_attributes": True}


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    domicilio: Optional[str] = None
