import sys
import os

# Forzar que se vea el output en Render
print(f"Python version: {sys.version}", flush=True)
print(f"DATABASE_URL set: {'DATABASE_URL' in os.environ}", flush=True)
print(f"PORT: {os.environ.get('PORT', 'NOT SET')}", flush=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import auth, clientes, prestamos, pagos, mora
from contextlib import asynccontextmanager

import models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating tables...", flush=True)
    Base.metadata.create_all(bind=engine)
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