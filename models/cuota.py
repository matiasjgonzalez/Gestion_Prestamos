from sqlalchemy import Column, Integer, ForeignKey, Date, Numeric, String, Index
from sqlalchemy.orm import relationship
from database import Base


class Cuota(Base):
    __tablename__ = "cuotas"

    id = Column(Integer, primary_key=True, index=True)
    prestamo_id = Column(
        Integer, ForeignKey("prestamos.id"), nullable=False, index=True
    )
    numero_cuota = Column(Integer, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False, index=True)
    monto = Column(Numeric(12, 2), nullable=False)
    monto_pagado_parcial = Column(Numeric(12, 2), nullable=True, default=0)
    estado = Column(String(30), nullable=False, default="pendiente", index=True)

    __table_args__ = (
        Index("ix_cuotas_estado_fecha", "estado", "fecha_vencimiento"),
    )

    prestamo = relationship("Prestamo", back_populates="cuotas_rel")
