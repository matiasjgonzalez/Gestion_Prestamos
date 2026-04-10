from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from .cuota import CuotaRead, CuotaInput


class PrestamoBase(BaseModel):
    cliente_id: int
    monto: float
    interes_total: float
    cuotas: int
    fecha_inicio: Optional[date] = None


class PrestamoCreate(PrestamoBase):
    cuotas_detalle: List[CuotaInput]


class PrestamoRead(PrestamoBase):
    id: int
    monto_cuota: Optional[float] = None
    estado: str
    cuotas_rel: Optional[List[CuotaRead]] = []

    model_config = {"from_attributes": True}
