from sqlalchemy import Column, Integer, String, DateTime, LargeBinary, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Archivo(Base):
    __tablename__ = "archivos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # "pagare" | "recibo_sueldo"
    nombre_archivo = Column(String(200), nullable=False)
    contenido = Column(LargeBinary, nullable=False)
    fecha_subida = Column(DateTime(timezone=True), server_default=func.now())

    cliente = relationship("Cliente", back_populates="archivos")
