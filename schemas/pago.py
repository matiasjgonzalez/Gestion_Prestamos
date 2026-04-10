from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PagoCreate(BaseModel):
    prestamo_id: int
    monto_pagado: float
    fecha_pago: Optional[datetime] = None


class PagoRead(BaseModel):
    id: int
    prestamo_id: int
    monto_pagado: float
    fecha_pago: datetime
    dias_atraso: Optional[int] = None

    model_config = {"from_attributes": True}
