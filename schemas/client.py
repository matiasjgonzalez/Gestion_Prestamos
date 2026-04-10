from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ClienteBase(BaseModel):
    nombre: str
    apellido: str
    dni: str
    telefono: Optional[str] = None
    domicilio: Optional[str] = None
    score_riesgo: Optional[float] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteRead(ClienteBase):
    id: int
    fecha_creacion: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    domicilio: Optional[str] = None
    score_riesgo: Optional[float] = None
