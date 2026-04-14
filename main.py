import sys
import os

print(f"Python version: {sys.version}", flush=True)
print(f"DATABASE_URL set: {'DATABASE_URL' in os.environ}", flush=True)
print(f"PORT: {os.environ.get('PORT', 'NOT SET')}", flush=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base
from routes import auth, clientes, prestamos, pagos, mora
from contextlib import asynccontextmanager

import models  # noqa: F401


_INDEX_SQL = [
    "CREATE INDEX IF NOT EXISTS ix_prestamos_estado ON prestamos (estado)",
    "CREATE INDEX IF NOT EXISTS ix_cuotas_estado ON cuotas (estado)",
    "CREATE INDEX IF NOT EXISTS ix_cuotas_fecha_vencimiento ON cuotas (fecha_vencimiento)",
    "CREATE INDEX IF NOT EXISTS ix_cuotas_estado_fecha ON cuotas (estado, fecha_vencimiento)",
]

_MIGRATE_SQL = [
    "ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS tipo_prestamo VARCHAR(20) NOT NULL DEFAULT 'mensual'",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating tables...", flush=True)
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for sql in _MIGRATE_SQL + _INDEX_SQL:
            conn.execute(text(sql))
        conn.commit()
    print("Tables created OK", flush=True)
    yield


app = FastAPI(title="Gestión de Préstamos", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(clientes.router, prefix="/clientes", tags=["Clientes"])
app.include_router(prestamos.router, prefix="/prestamos", tags=["Préstamos"])
app.include_router(pagos.router, prefix="/pagos", tags=["Pagos"])
app.include_router(mora.router, prefix="/mora", tags=["Mora"])


@app.get("/")
def root():
    return {"message": "API de Gestión de Préstamos activa"}
