# CREDIA Loan Simulator — Guía de Instalación y Operación

## 1. Requisitos Previos
- Node.js v18 o superior
- PostgreSQL v12 o superior
- Git

## 2. Clonar e Instalar Dependencias
```bash
git clone <URL_DEL_REPOSITORIO>
cd Credia-loan-simulator

cd backend && npm install
cd ../frontend && npm install
```

## 3. Configurar Variables de Entorno

### Backend (`backend/.env`)
```bash
cd backend
cp .env.example .env
```
Variables principales (ver `backend/.env.example`):
```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=credia_db
PGUSER=postgres
PGPASSWORD=CAMBIAR_PASSWORD_DB

PORT=3000
NODE_ENV=development

# Obligatorio: el servidor no arranca si falta
JWT_SECRET=CAMBIAR_POR_SECRETO_LARGO_ALEATORIO
JWT_EXPIRES_IN=24h

# Origen permitido por CORS (en produccion usar la URL real del sitio)
FRONTEND_URL=http://localhost:5173
# FRONTEND_DIST_PATH=../frontend/dist

# Debe coincidir con ADMIN_INITIAL_USERNAME para gestionar parametrizacion
SUPER_ADMIN_USERNAME=admin

# Usuario administrador inicial (usado por setupDatabase.js)
ADMIN_INITIAL_EMAIL=admin@credia.local
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=CAMBIAR_CLAVE_ADMIN
```

### Frontend (`frontend/.env`, opcional en desarrollo)
```bash
cd frontend
cp .env.example .env
```
Por defecto el frontend usa `VITE_API_URL=/api` (funciona tanto con el proxy de Vite en desarrollo como servido desde Express en producción).

## 4. Inicializar Base de Datos (Esquemas `us`, `cl`, `op`, `pa`)

1. Crea la base de datos vacía en PostgreSQL:
   ```bash
   createdb credia_db
   ```
2. Ejecuta el script idempotente de inicialización (aplica `backend/database/init.sql`, siembra `pa.parametros` y crea el usuario administrador inicial desde `ADMIN_INITIAL_*`):
   ```bash
   cd backend
   node setupDatabase.js
   ```

## 5. Arranque

### Modo desarrollo
- Terminal 1 (Backend en `http://localhost:3000`):
  ```bash
  cd backend
  npm run dev
  ```
- Terminal 2 (Frontend en `http://localhost:5173`):
  ```bash
  cd frontend
  npm run dev
  ```

### Modo producción (Express + `frontend/dist`)
```bash
cd frontend
npm run build
cd ../backend
npm start
```
- Healthcheck: `GET /api/health` (verifica conexión a PostgreSQL).
- La aplicación web se sirve desde `/` con fallback SPA para rutas que no comiencen con `/api`.

## 6. Endpoints API Principales

### Públicos
- `GET /api/health` — Estado del servicio y base de datos
- `POST /api/auth/login` — Iniciar sesión

### Protegidos (`Authorization: Bearer <token>`)
- `POST /api/auth/register` — Registrar usuario (requiere rol `Administrador`)
- `GET /api/auth/profile` — Perfil del usuario autenticado
- `POST /api/auth/change-password` — Cambiar contraseña propia
- `GET /api/dashboard/stats` — Estadísticas del dashboard
- `GET/POST /api/clients`, `GET /api/clients/exists`, `GET/PUT /api/clients/:id` — Clientes
- `POST /api/loans/calculate` — Calcular préstamo y tabla de amortización
- `GET/POST /api/loans`, `GET /api/loans/:id` — Solicitudes/préstamos y detalle
- `PUT /api/loans/:id/approve`, `PUT /api/loans/:id/reject` — Aprobación/rechazo (`Administrador`/`Supervisor`)
- `PUT /api/loans/:id/installments/:installmentNumber/pay` — Registrar pago de cuota (`Administrador`/`Supervisor`)
- `GET/POST/PATCH/DELETE /api/config/users` — Gestión de usuarios (`Administrador`)
- `GET/PUT /api/config/parameters` — Parámetros del sistema (`Super Admin`)
