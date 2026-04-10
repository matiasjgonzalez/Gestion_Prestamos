from datetime import date
from sqlalchemy.orm import Session
from models.cuota import Cuota


def verificar_mora(db: Session) -> list[dict]:
    """
    Revisa todas las cuotas pendientes con fecha_vencimiento pasada,
    las marca como 'vencida' y retorna un resumen de las cuotas en mora.
    """
    hoy = date.today()
    cuotas_vencidas = (
        db.query(Cuota)
        .filter(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < hoy)
        .all()
    )

    resultado = []
    for cuota in cuotas_vencidas:
        dias_atraso = (hoy - cuota.fecha_vencimiento).days
        cuota.estado = "vencida"
        db.add(cuota)
        resultado.append(
            {
                "cuota_id": cuota.id,
                "prestamo_id": cuota.prestamo_id,
                "numero_cuota": cuota.numero_cuota,
                "fecha_vencimiento": cuota.fecha_vencimiento.isoformat(),
                "monto": float(cuota.monto),
                "dias_atraso": dias_atraso,
            }
        )

    if resultado:
        db.commit()

    return resultado


def obtener_cuotas_en_mora(db: Session) -> list[dict]:
    """
    Retorna todas las cuotas actualmente marcadas como 'vencida'
    con los días de atraso calculados.
    """
    hoy = date.today()
    cuotas = db.query(Cuota).filter(Cuota.estado == "vencida").all()

    resultado = []
    for cuota in cuotas:
        dias_atraso = (hoy - cuota.fecha_vencimiento).days
        resultado.append(
            {
                "cuota_id": cuota.id,
                "prestamo_id": cuota.prestamo_id,
                "numero_cuota": cuota.numero_cuota,
                "fecha_vencimiento": cuota.fecha_vencimiento.isoformat(),
                "monto": float(cuota.monto),
                "dias_atraso": dias_atraso,
                "cliente_nombre": None,
                "cliente_apellido": None,
            }
        )

    # Enriquecer con datos del cliente
    if resultado:
        from models.prestamo import Prestamo
        from models.client import Cliente

        for item in resultado:
            prestamo = db.query(Prestamo).get(item["prestamo_id"])
            if prestamo and prestamo.cliente:
                item["cliente_nombre"] = prestamo.cliente.nombre
                item["cliente_apellido"] = prestamo.cliente.apellido

    return resultado
