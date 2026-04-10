from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import auth, clientes, prestamos, pagos, mora
from contextlib import asynccontextmanager

# Importar models para que SQLAlchemy los registre
import models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crear tablas al iniciar
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Gestión de Préstamos", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(clientes.router, prefix="/clientes", tags=["Clientes"])
app.include_router(prestamos.router, prefix="/prestamos", tags=["Préstamos"])
app.include_router(pagos.router, prefix="/pagos", tags=["Pagos"])
app.include_router(mora.router, prefix="/mora", tags=["Mora"])


@app.get("/")
def root():
    return {"message": "API de Gestión de Préstamos activa"}
