"""
Script para cargar datos de prueba.
Ejecutar desde la carpeta del backend:
  python seed_data.py
"""
from database import engine, Base, SessionLocal
import models  # noqa
from models.client import Cliente
from models.prestamo import Prestamo
from models.cuota import Cuota
from datetime import date, timedelta

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# 10 Clientes
clientes_data = [
    {"nombre": "Carlos", "apellido": "Gómez", "dni": "25678901", "telefono": "351-4567890", "domicilio": "Av. Colón 1234, Córdoba", "score_riesgo": 8.5},
    {"nombre": "María", "apellido": "López", "dni": "30123456", "telefono": "351-5551234", "domicilio": "Bv. San Juan 567, Córdoba", "score_riesgo": 7.2},
    {"nombre": "Juan", "apellido": "Martínez", "dni": "28456789", "telefono": "351-6789012", "domicilio": "Caseros 890, Córdoba", "score_riesgo": 6.0},
    {"nombre": "Ana", "apellido": "Fernández", "dni": "33789012", "telefono": "351-3456789", "domicilio": "Dean Funes 345, Córdoba", "score_riesgo": 9.1},
    {"nombre": "Lucas", "apellido": "Rodríguez", "dni": "27345678", "telefono": "351-7890123", "domicilio": "Chacabuco 678, Córdoba", "score_riesgo": 5.5},
    {"nombre": "Valentina", "apellido": "García", "dni": "31567890", "telefono": "351-2345678", "domicilio": "Vélez Sarsfield 901, Córdoba", "score_riesgo": 8.0},
    {"nombre": "Diego", "apellido": "Pérez", "dni": "26890123", "telefono": "351-8901234", "domicilio": "Ituzaingó 234, Córdoba", "score_riesgo": 4.8},
    {"nombre": "Sofía", "apellido": "Sánchez", "dni": "34012345", "telefono": "351-1234567", "domicilio": "27 de Abril 567, Córdoba", "score_riesgo": 7.7},
    {"nombre": "Martín", "apellido": "Díaz", "dni": "29234567", "telefono": "351-9012345", "domicilio": "Humberto Primo 890, Córdoba", "score_riesgo": 6.3},
    {"nombre": "Camila", "apellido": "Torres", "dni": "32456789", "telefono": "351-0123456", "domicilio": "San Jerónimo 123, Córdoba", "score_riesgo": 8.9},
]

print("Creando clientes...")
clientes = []
for data in clientes_data:
    existente = db.query(Cliente).filter(Cliente.dni == data["dni"]).first()
    if existente:
        clientes.append(existente)
        print(f"  Ya existe: {data['nombre']} {data['apellido']}")
    else:
        c = Cliente(**data)
        db.add(c)
        db.flush()
        clientes.append(c)
        print(f"  Creado: {data['nombre']} {data['apellido']}")

db.commit()

# Crear algunos préstamos de ejemplo
print("\nCreando préstamos de ejemplo...")
hoy = date.today()

prestamos_data = [
    # Carlos Gómez - préstamo activo con cuotas por vencer
    {"cliente_idx": 0, "monto": 500000, "interes": 25, "cuotas": [
        {"n": 1, "fecha": hoy - timedelta(days=60), "monto": 125000},
        {"n": 2, "fecha": hoy - timedelta(days=30), "monto": 125000},
        {"n": 3, "fecha": hoy + timedelta(days=30), "monto": 125000},
        {"n": 4, "fecha": hoy + timedelta(days=60), "monto": 125000},
        {"n": 5, "fecha": hoy + timedelta(days=90), "monto": 125000},
    ]},
    # María López - préstamo con cuotas vencidas (mora)
    {"cliente_idx": 1, "monto": 200000, "interes": 20, "cuotas": [
        {"n": 1, "fecha": hoy - timedelta(days=90), "monto": 80000},
        {"n": 2, "fecha": hoy - timedelta(days=60), "monto": 80000},
        {"n": 3, "fecha": hoy - timedelta(days=30), "monto": 80000},
    ]},
    # Ana Fernández - préstamo chico
    {"cliente_idx": 3, "monto": 100000, "interes": 15, "cuotas": [
        {"n": 1, "fecha": hoy + timedelta(days=15), "monto": 38333},
        {"n": 2, "fecha": hoy + timedelta(days=45), "monto": 38333},
        {"n": 3, "fecha": hoy + timedelta(days=75), "monto": 38334},
    ]},
    # Lucas Rodríguez - préstamo grande
    {"cliente_idx": 4, "monto": 1000000, "interes": 30, "cuotas": [
        {"n": 1, "fecha": hoy - timedelta(days=15), "monto": 216667},
        {"n": 2, "fecha": hoy + timedelta(days=15), "monto": 216667},
        {"n": 3, "fecha": hoy + timedelta(days=45), "monto": 216667},
        {"n": 4, "fecha": hoy + timedelta(days=75), "monto": 216667},
        {"n": 5, "fecha": hoy + timedelta(days=105), "monto": 216667},
        {"n": 6, "fecha": hoy + timedelta(days=135), "monto": 216665},
    ]},
    # Diego Pérez - préstamo con mora severa
    {"cliente_idx": 6, "monto": 300000, "interes": 35, "cuotas": [
        {"n": 1, "fecha": hoy - timedelta(days=120), "monto": 101250},
        {"n": 2, "fecha": hoy - timedelta(days=90), "monto": 101250},
        {"n": 3, "fecha": hoy - timedelta(days=60), "monto": 101250},
        {"n": 4, "fecha": hoy - timedelta(days=30), "monto": 101250},
    ]},
]

for pdata in prestamos_data:
    cliente = clientes[pdata["cliente_idx"]]
    num_cuotas = len(pdata["cuotas"])
    total = pdata["monto"] * (1 + pdata["interes"] / 100)
    monto_cuota = round(total / num_cuotas, 2)

    p = Prestamo(
        cliente_id=cliente.id,
        monto=pdata["monto"],
        interes_total=pdata["interes"],
        cuotas=num_cuotas,
        monto_cuota=monto_cuota,
        fecha_inicio=hoy,
        estado="activo",
    )
    db.add(p)
    db.flush()

    for cdata in pdata["cuotas"]:
        cuota = Cuota(
            prestamo_id=p.id,
            numero_cuota=cdata["n"],
            fecha_vencimiento=cdata["fecha"],
            monto=cdata["monto"],
            estado="pendiente",
        )
        db.add(cuota)

    print(f"  Préstamo #{p.id}: {cliente.nombre} {cliente.apellido} - ${pdata['monto']:,} ({num_cuotas} cuotas)")

db.commit()
db.close()

print("\n✓ Datos de prueba cargados correctamente!")
print("  - 10 clientes")
print("  - 5 préstamos (algunos con cuotas vencidas para probar mora)")
