import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from services.mora_service import verificar_mora, obtener_cuotas_en_mora
from services.auth import get_current_user

router = APIRouter()


@router.post("/verificar")
def verificar(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """
    Revisa cuotas pendientes con fecha vencida, las marca como 'vencida'
    y retorna las que acaba de marcar.
    """
    nuevas_vencidas = verificar_mora(db)
    return {
        "nuevas_cuotas_vencidas": len(nuevas_vencidas),
        "detalle": nuevas_vencidas,
    }


@router.get("/")
def listar_mora(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Retorna todas las cuotas actualmente en mora con datos del cliente."""
    cuotas = obtener_cuotas_en_mora(db)
    return {
        "total_en_mora": len(cuotas),
        "cuotas": cuotas,
    }


@router.get("/export/csv")
def export_mora_csv(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cuotas = obtener_cuotas_en_mora(db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Préstamo ID", "Cliente", "DNI", "N° Cuota", "Vencimiento", "Monto", "Estado"])
    for c in cuotas:
        writer.writerow([
            c["prestamo_id"],
            c["cliente_nombre"],
            c["cliente_dni"],
            c["numero_cuota"],
            c["fecha_vencimiento"],
            c["monto"],
            c["estado"],
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mora.csv"},
    )
