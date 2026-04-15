from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from .cuota import CuotaRead, CuotaInput


class PrestamoBase(BaseModel):
    cliente_id: int
    monto: float = Field(..., gt=0, description="Monto debe ser mayor a 0")
    interes_total: float = Field(..., ge=0, description="Interés no puede ser negativo")
    cuotas: int = Field(..., ge=1, description="Debe tener al menos 1 cuota")
    fecha_inicio: Optional[date] = None
    tipo_prestamo: str = "mensual"


class PrestamoCreate(PrestamoBase):
    cuotas_detalle: List[CuotaInput]


class PrestamoRead(PrestamoBase):
    id: int
    monto_cuota: Optional[float] = None
    estado: str
    cuotas_rel: Optional[List[CuotaRead]] = []

    model_config = {"from_attributes": True}
