from datetime import date
from typing import List
from sqlalchemy.orm import Session
from models.prestamo import Prestamo
from models.cuota import Cuota
from schemas.cuota import CuotaInput


def create_prestamo(
    db: Session,
    cliente_id: int,
    monto: float,
    interes_total: float,
    num_cuotas: int,
    cuotas_detalle: List[CuotaInput],
    fecha_inicio: date | None = None,
    tipo_prestamo: str = "mensual",
) -> Prestamo:
    if fecha_inicio is None:
        fecha_inicio = date.today()

    total = float(monto) * (1 + float(interes_total) / 100.0)
    monto_cuota = round(total / float(num_cuotas), 2)

    prestamo = Prestamo(
        cliente_id=cliente_id,
        monto=monto,
        interes_total=interes_total,
        cuotas=num_cuotas,
        monto_cuota=monto_cuota,
        fecha_inicio=fecha_inicio,
        estado="activo",
        tipo_prestamo=tipo_prestamo,
    )
    db.add(prestamo)
    db.flush()

    # Crear cuotas con datos manuales
    for c in cuotas_detalle:
        cuota = Cuota(
            prestamo_id=prestamo.id,
            numero_cuota=c.numero_cuota,
            fecha_vencimiento=c.fecha_vencimiento,
            monto=c.monto,
            estado="pendiente",
        )
        db.add(cuota)

    db.commit()
    db.refresh(prestamo)
    return prestamo


def calcular_deuda_restante(db: Session, prestamo: Prestamo) -> float:
    total_pagado = sum([float(p.monto_pagado) for p in prestamo.pagos])
    total_cuotas = sum([float(c.monto) for c in prestamo.cuotas_rel])
    return round(total_cuotas - total_pagado, 2)
