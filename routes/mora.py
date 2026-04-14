import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
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
    _user=Depends(get_current_user),
):
    nuevas_vencidas = verificar_mora(db)
    return {
        "nuevas_cuotas_vencidas": len(nuevas_vencidas),
        "detalle": nuevas_vencidas,
    }


@router.get("/")
def listar_mora(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    cuotas = obtener_cuotas_en_mora(db)
    return {
        "total_en_mora": len(cuotas),
        "cuotas": cuotas,
    }


@router.get("/export/xlsx")
def export_mora_xlsx(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    cuotas = obtener_cuotas_en_mora(db)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Mora"

    headers = ["Préstamo ID", "Cliente", "DNI", "N° Cuota", "Vencimiento", "Monto", "Días Atraso"]
    header_fill = PatternFill("solid", fgColor="E11D48")
    header_font = Font(bold=True, color="FFFFFF")
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for c in cuotas:
        ws.append([
            c["prestamo_id"],
            c["cliente_nombre"],
            c["cliente_dni"],
            c["numero_cuota"],
            c["fecha_vencimiento"],
            c["monto"],
            c["dias_atraso"],
        ])

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 4

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        iter([output.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=mora.xlsx"},
    )
