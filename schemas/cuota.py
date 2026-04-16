from pydantic import BaseModel, Field
from datetime import date


class CuotaInput(BaseModel):
    numero_cuota: int
    fecha_vencimiento: date
    monto: float = Field(..., gt=0, description="El monto de la cuota debe ser mayor a 0")


class CuotaRead(BaseModel):
    id: int
    prestamo_id: int
    numero_cuota: int
    fecha_vencimiento: date
    monto: float
    estado: str

    model_config = {"from_attributes": True}


class CuotaUpdate(BaseModel):
    fecha_vencimiento: date | None = None
    monto: float | None = None
