from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), nullable=False)
    apellido = Column(String(120), nullable=False)
    dni = Column(String(50), unique=True, nullable=False, index=True)
    telefono = Column(String(50), nullable=True)
    domicilio = Column(String(250), nullable=True)
    empleo = Column(String(250), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    prestamos = relationship(
        "Prestamo", back_populates="cliente", cascade="all, delete-orphan"
    )
    archivos = relationship(
        "Archivo", back_populates="cliente", cascade="all, delete-orphan"
    )
