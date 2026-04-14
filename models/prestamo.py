from sqlalchemy import Column, Integer, Float, ForeignKey, String, Date, Numeric
from sqlalchemy.orm import relationship
from database import Base


class Prestamo(Base):
    __tablename__ = "prestamos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(
        Integer, ForeignKey("clientes.id"), nullable=False, index=True
    )
    monto = Column(Numeric(12, 2), nullable=False)
    interes_total = Column(Float, nullable=False, default=0.0)  # porcentaje
    cuotas = Column(Integer, nullable=False)
    monto_cuota = Column(Numeric(12, 2), nullable=True)  # puede ser None si cuotas manuales
    fecha_inicio = Column(Date, nullable=True)
    estado = Column(String(30), nullable=False, default="activo", index=True)

    cliente = relationship("Cliente", back_populates="prestamos")
    cuotas_rel = relationship(
        "Cuota", back_populates="prestamo", cascade="all, delete-orphan"
    )
    pagos = relationship(
        "Pago", back_populates="prestamo", cascade="all, delete-orphan"
    )
