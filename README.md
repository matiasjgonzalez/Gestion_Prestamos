# Gestión de Préstamos

Sistema de gestión de préstamos personales con FastAPI + React.

## Estructura

```
gestion_prest/
├── main.py                 # Entry point FastAPI
├── database.py             # Configuración SQLAlchemy
├── requirements.txt        # Dependencias Python
├── .env.example            # Variables de entorno
├── models/                 # Modelos SQLAlchemy
│   ├── client.py
│   ├── prestamo.py
│   ├── cuota.py
│   └── pago.py
├── schemas/                # Schemas Pydantic
│   ├── client.py
│   ├── prestamo.py
│   ├── cuota.py
│   ├── pago.py
│   └── user.py
├── routes/                 # Endpoints FastAPI
│   ├── auth.py
│   ├── clientes.py
│   ├── prestamos.py
│   ├── pagos.py
│   └── mora.py
├── services/               # Lógica de negocio
│   ├── auth.py
│   ├── prestamo_service.py
│   └── mora_service.py
└── frontend/               # React (Vite)
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── context/
        ├── components/
        ├── pages/
        └── services/
```

## Setup - Backend

```bash
# Crear entorno virtual
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
.venv\Scripts\activate      # Windows

# Instalar dependencias
pip install -r requirements.txt

# Copiar y configurar .env
cp .env.example .env

# Ejecutar
uvicorn main:app --reload --port 8000
```

La API queda en `http://localhost:8000`
Docs interactivos: `http://localhost:8000/docs`

## Setup - Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend queda en `http://localhost:5173`
(El proxy de Vite redirige las peticiones API a localhost:8000)

## Credenciales por defecto

- **Usuario:** admin
- **Contraseña:** admin123

## Funcionalidades

- **Clientes:** CRUD completo con búsqueda
- **Préstamos:** Creación con cuotas manuales (fecha y monto de cada cuota)
- **Pagos:** Registro con cálculo automático de días de atraso
- **Mora:** Detección automática de cuotas vencidas
- **Dashboard:** Resumen de totales y cuotas en mora
- **Auth:** JWT con protección en todas las rutas

## Base de datos

- **Desarrollo:** SQLite (archivo local `gestion_prest.db`)
- **Producción:** PostgreSQL/Supabase (cambiar `DATABASE_URL` en `.env`)

Para Supabase, cambiar en `.env`:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```
Y agregar `psycopg2-binary` a requirements.txt.
