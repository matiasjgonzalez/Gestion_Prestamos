import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from datetime import date
from database import get_db
from models.client import Cliente
from models.prestamo import Prestamo
from models.cuota import Cuota
from models.pago import Pago
from schemas.client import ClienteCreate, ClienteRead, ClienteUpdate
from services.auth import get_current_user

router = APIRouter()


@router.post("/", response_model=ClienteRead)
def create_cliente(
    payload: ClienteCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    existente = db.query(Cliente).filter(Cliente.dni == payload.dni).first()
    if existente:
        raise HTTPException(status_code=400, detail="DNI ya registrado")
    cliente = Cliente(**payload.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/", response_model=list[ClienteRead])
def list_clientes(
    offset: int = 0,
    limit: int = 100,
    search: str = Query(None, description="Buscar por nombre, apellido o DNI"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(Cliente)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Cliente.nombre.ilike(pattern))
            | (Cliente.apellido.ilike(pattern))
            | (Cliente.dni.ilike(pattern))
            | (func.concat(Cliente.nombre, ' ', Cliente.apellido).ilike(pattern))
        )
    clientes = query.order_by(Cliente.apellido, Cliente.nombre).offset(offset).limit(limit).all()

    # IDs de clientes con mora: ya marcadas como "vencida" O pendientes con fecha pasada
    ids_con_mora = set(
        row[0] for row in db.query(Prestamo.cliente_id)
        .join(Cuota, Cuota.prestamo_id == Prestamo.id)
        .filter(
            or_(
                Cuota.estado == "vencida",
                and_(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < date.today())
            )
        )
        .distinct()
        .all()
    )

    result = []
    for c in clientes:
        item = ClienteRead.model_validate(c)
        item.tiene_mora = c.id in ids_con_mora
        result.append(item)
    return result


@router.get("/{cliente_id}/resumen")
def get_cliente_resumen(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    prestamos = db.query(Prestamo).filter(Prestamo.cliente_id == cliente_id).all()
    prestamo_ids = [p.id for p in prestamos]

    total_cuotas = db.query(func.sum(Cuota.monto)).filter(Cuota.prestamo_id.in_(prestamo_ids)).scalar() or 0
    total_pagado = db.query(func.sum(Pago.monto_pagado)).filter(Pago.prestamo_id.in_(prestamo_ids)).scalar() or 0
    monto_mora = db.query(func.sum(Cuota.monto)).filter(
        Cuota.prestamo_id.in_(prestamo_ids),
        or_(
            Cuota.estado == "vencida",
            and_(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < date.today())
        )
    ).scalar() or 0

    return {
        "prestamos_total": len(prestamos),
        "prestamos_activos": sum(1 for p in prestamos if p.estado == "activo"),
        "deuda_total": round(float(total_cuotas) - float(total_pagado), 2),
        "tiene_mora": monto_mora > 0,
        "monto_mora": float(monto_mora),
    }


@router.get("/{cliente_id}", response_model=ClienteRead)
def get_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.put("/{cliente_id}", response_model=ClienteRead)
def update_cliente(
    cliente_id: int,
    payload: ClienteUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cliente, k, v)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/{cliente_id}/estado-cuenta/xlsx")
def estado_cuenta_xlsx(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Exporta estado de cuenta completo del cliente en Excel."""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    prestamos = (
        db.query(Prestamo)
        .options(joinedload(Prestamo.cuotas_rel), joinedload(Prestamo.pagos))
        .filter(Prestamo.cliente_id == cliente_id)
        .order_by(Prestamo.id)
        .all()
    )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Estado de Cuenta"

    accent = "0284C7"
    header_fill = PatternFill("solid", fgColor=accent)
    header_font = Font(bold=True, color="FFFFFF")
    sub_fill    = PatternFill("solid", fgColor="E2E8F0")
    bold        = Font(bold=True)

    def hrow(row, values, fill=None, font=None):
        for col, v in enumerate(values, 1):
            c = ws.cell(row=row, column=col, value=v)
            if fill: c.fill = fill
            if font: c.font = font
            c.alignment = Alignment(horizontal="left", vertical="center")

    r = 1
    ws.cell(r, 1, f"Estado de Cuenta — {cliente.nombre} {cliente.apellido}").font = Font(bold=True, size=13)
    r += 1
    ws.cell(r, 1, f"DNI: {cliente.dni}   Teléfono: {cliente.telefono or '—'}   Domicilio: {cliente.domicilio or '—'}")
    r += 2

    for p in prestamos:
        hrow(r, [f"Préstamo #{p.id}", f"Tipo: {p.tipo_prestamo or 'mensual'}", f"Monto: ${float(p.monto):,.2f}",
                 f"Interés: {p.interes_total}%", f"Estado: {p.estado}"], fill=header_fill, font=header_font)
        r += 1

        hrow(r, ["#", "Vencimiento", "Monto", "Estado"], fill=sub_fill, font=bold)
        r += 1
        for c in sorted(p.cuotas_rel, key=lambda x: x.numero_cuota):
            ws.append([""] * 0)
            ws.cell(r, 1, c.numero_cuota)
            ws.cell(r, 2, c.fecha_vencimiento.isoformat())
            ws.cell(r, 3, float(c.monto))
            ws.cell(r, 4, c.estado)
            r += 1

        if p.pagos:
            r += 1
            hrow(r, ["Pagos registrados", "Fecha", "Monto", "Días atraso"], fill=sub_fill, font=bold)
            r += 1
            for pg in sorted(p.pagos, key=lambda x: x.fecha_pago or date.min):
                ws.cell(r, 1, "")
                ws.cell(r, 2, pg.fecha_pago.strftime("%Y-%m-%d") if pg.fecha_pago else "—")
                ws.cell(r, 3, float(pg.monto_pagado))
                ws.cell(r, 4, pg.dias_atraso or 0)
                r += 1
        r += 2

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(
            (len(str(c.value or "")) for c in col), default=10
        ) + 4

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    nombre = f"{cliente.apellido}_{cliente.nombre}_estado_cuenta.xlsx".replace(" ", "_")
    return StreamingResponse(
        iter([out.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre}"},
    )


@router.delete("/{cliente_id}")
def delete_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(cliente)
    db.commit()
    return {"ok": True}
