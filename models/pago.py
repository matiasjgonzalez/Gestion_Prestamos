from sqlalchemy import Column, Integer, ForeignKey, DateTime, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    prestamo_id = Column(
        Integer, ForeignKey("prestamos.id"), nullable=False, index=True
    )
    monto_pagado = Column(Numeric(12, 2), nullable=False)
    fecha_pago = Column(DateTime(timezone=True), server_default=func.now())
    dias_atraso = Column(Integer, nullable=True)

    prestamo = relationship("Prestamo", back_populates="pagos")
