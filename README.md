# CREDIA — Simulador y Gestión de Préstamos

Aplicación web full-stack para simulación de créditos (sistema francés), gestión de clientes, flujo de solicitudes/aprobaciones, registro de pagos de cuotas y reportería de estados de cuenta.

## Arquitectura

- **Backend**: Node.js + Express (`backend/`), conectado a PostgreSQL (`pg`). Sirve la API REST bajo `/api/*` y, en producción, los archivos estáticos compilados del frontend (`frontend/dist`) con fallback SPA.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui (`frontend/`).

## Requisitos

- Node.js v18+ (probado con v22.17.0)
- npm v9+
- PostgreSQL 12+ (probado con PostgreSQL 18)

## Instalación

1. Clonar el repositorio:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd Credia-loan-simulator
   ```

2. Instalar dependencias:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Configurar variables de entorno:
   - Copiar `backend/.env.example` a `backend/.env` y completar credenciales de PostgreSQL, `JWT_SECRET` (obligatorio) y `ADMIN_INITIAL_*`.
   - Opcional en desarrollo: copiar `frontend/.env.example` a `frontend/.env` (`VITE_API_URL=/api` por defecto).

## Base de datos y usuario administrador inicial

El esquema oficial vive en `backend/database/init.sql` (esquemas `us`, `cl`, `op`, `pa` y `public.user_admin_profiles`, junto con parámetros iniciales en `pa.parametros`).

1. Crear una base de datos vacía en PostgreSQL (por ejemplo `credia_db`).
2. Definir en `backend/.env` las variables `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_USERNAME` y `ADMIN_INITIAL_PASSWORD` (y `SUPER_ADMIN_USERNAME` coincidiendo con `ADMIN_INITIAL_USERNAME`).
3. Ejecutar el inicializador idempotente desde `backend/`:
   ```bash
   node setupDatabase.js
   ```

## Arranque

### Desarrollo (dos terminales)
- Backend (`http://localhost:3000`):
  ```bash
  cd backend
  npm run dev
  ```
- Frontend (`http://localhost:5173`, con proxy `/api` hacia `:3000`):
  ```bash
  cd frontend
  npm run dev
  ```

### Producción (un solo proceso Express sirviendo el frontend compilado)
1. Compilar el frontend:
   ```bash
   cd frontend
   npm run build
   ```
2. Arrancar el backend:
   ```bash
   cd ../backend
   npm start
   ```
   Express servirá `frontend/dist` en `/` (configurable con `FRONTEND_DIST_PATH`), la API en `/api/*` y el healthcheck en `GET /api/health`.

Para más detalles de operación, ver [SETUP.md](./SETUP.md).
