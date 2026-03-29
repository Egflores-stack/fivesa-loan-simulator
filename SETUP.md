# CREDIA Loan Simulator - Guía de Instalación y Prueba

## 🚀 Configuración Rápida

### 1. Requisitos Previos
- Node.js (v18 o superior)
- PostgreSQL (v12 o superior)
- Git

### 2. Clonar el Proyecto
```bash
git clone <URL-del-repositorio>
cd Credia-loan-simulator
```

### 3. Configurar Base de Datos PostgreSQL

#### Opción A: Usando pgAdmin (GUI)
1. Abre pgAdmin y conéctate a tu servidor PostgreSQL
2. Crea una nueva base de datos llamada `credia_db`
3. Haz clic derecho en la base de datos → Query Tool
4. Abre el archivo `backend/database/schema.sql` y ejecuta todo el contenido

#### Opción B: Usando CLI
```bash
# Crear base de datos
createdb credia_db

# Importar esquema
psql -d credia_db -f backend/database/schema.sql
```

### 4. Configurar Variables de Entorno

#### Backend
```bash
cd backend
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:
```env
# Base de datos PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=credia_db
PGUSER=tu_usuario_postgres
PGPASSWORD=tu_password

# Servidor
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=credia_jwt_secret_key_2024_super_segura
JWT_EXPIRES_IN=24h

# Demo global
DEMO_MODE_ENABLED=false
DEMO_MODE_EXPIRES_AT=2026-12-31T23:59:59-06:00
SUPER_ADMIN_USERNAME=emathews

# CORS
FRONTEND_URL=http://localhost:5173
```

#### Frontend
```bash
cd ../frontend
```

Crea un archivo `.env`:
```env
VITE_API_URL=http://localhost:3000/api
VITE_BCN_OFFICIAL_RATE=36.6243
```

### 5. Instalar Dependencias
```bash
# Backend
cd backend
npm install

# Frontend (en otra terminal)
cd ../frontend
npm install
```

### 6. Iniciar el Servidor de Desarrollo

#### Backend (Terminal 1)
```bash
cd backend
npm run dev
```
Deberías ver:
```
🚀 Servidor CREDIA corriendo en http://localhost:3000
📊 Sistema de Gestión de Préstamos
👉 Prueba el login: POST http://localhost:3000/api/auth/login
✅ Conectado a PostgreSQL
```

#### Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
La aplicación se abrirá en: http://localhost:5173

## 🔐 Credenciales de Prueba

### Usuario Administrador
- **Email**: admin@credia.com
- **Password**: admin123

## 📋 Flujo de Prueba Completo

### 1. Autenticación
1. Ve a http://localhost:5173
2. Ingresa con las credenciales de administrador
3. Serás redirigido al dashboard

### 2. Dashboard
- Visualiza estadísticas en tiempo real
- Revisa gráficos de préstamos por mes
- Explora la distribución por tipo de préstamo
- Consulta solicitudes recientes

### 3. Simulador de Crédito
1. Haz clic en "Simulador" en el menú
2. Configura los parámetros del préstamo:
   - Monto: C$100,000
   - Plazo: 24 meses
   - Tasa: 3.5% mensual
3. Observa los cálculos en tiempo real
4. Haz clic en "Solicitar Crédito"
5. Completa los datos del cliente
6. Envía la solicitud

### 4. Gestión de Solicitudes
1. Ve a la página "Solicitudes"
2. Verás la solicitud que acabas de crear con estado "Pendiente"
3. Haz clic en el icono de ojo (👁️) para ver detalles
4. Aproba la solicitud con el ícono de check (✅)
5. El préstamo cambiará a estado "Aprobado"

### 5. Actualización en Tiempo Real
- Vuelve al dashboard
- Las estadísticas deberían reflejar el nuevo préstamo aprobado
- Haz clic en "Refrescar" para ver los datos actualizados

## 🛠️ Funcionalidades Implementadas

### ✅ Completadas
- [x] Autenticación con JWT
- [x] Dashboard con datos dinámicos
- [x] Simulador de crédito funcional
- [x] Gestión de solicitudes con aprobación/rechazo
- [x] Gestión completa de clientes
- [x] Base de datos PostgreSQL con esquema completo
- [x] API RESTful completa

### 🔄 En Progreso
- [ ] Reportes y exportación de datos
- [ ] Notificaciones por email
- [ ] Sistema de pagos

## 🔍 Endpoints API Disponibles

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/profile` - Obtener perfil

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas del dashboard

### Clientes
- `POST /api/clients` - Crear cliente
- `GET /api/clients` - Listar clientes
- `GET /api/clients/:id` - Detalles de cliente
- `PUT /api/clients/:id` - Actualizar cliente

### Préstamos
- `POST /api/loans/calculate` - Calcular préstamo
- `POST /api/loans` - Crear solicitud de préstamo
- `GET /api/loans` - Listar préstamos
- `GET /api/loans/:id` - Detalles de préstamo
- `PUT /api/loans/:id/approve` - Aprobar préstamo
- `PUT /api/loans/:id/reject` - Rechazar préstamo

## 🐛 Solución de Problemas Comunes

### Error de Conexión a PostgreSQL
```bash
# Verifica que PostgreSQL esté corriendo
pg_ctl status

# Verifica credenciales en .env
cat backend/.env
```

### Error de CORS
Asegúrate que `FRONTEND_URL` en el backend .env coincida con la URL del frontend.

### Error de Autenticación
Limpia el localStorage del navegador y vuelve a intentar el login.

### Control de Acceso para Demo
Si quieres que toda la demo venza automáticamente en una fecha exacta, activa estas variables en `backend/.env`:

```env
DEMO_MODE_ENABLED=true
DEMO_MODE_EXPIRES_AT=2026-03-31T23:59:59-06:00
```

Cuando llegue esa fecha y hora exacta, ningún usuario podrá iniciar sesión ni seguir usando el sistema con un token ya abierto.

## 📱 Características Técnicas

### Backend
- Node.js + Express
- PostgreSQL con conexión Pool
- JWT para autenticación
- API RESTful
- Manejo de errores centralizado

### Frontend
- React + TypeScript
- Vite como bundler
- Tailwind CSS + shadcn/ui
- React Query para manejo de datos
- React Router para navegación

### Base de Datos
- PostgreSQL con relaciones bien definidas
- Índices optimizados para rendimiento
- Triggers para timestamps
- Vistas para estadísticas

## 🚀 Próximos Pasos

1. **Configurar** el entorno siguiendo los pasos anteriores
2. **Probar** todas las funcionalidades
3. **Personalizar** los colores y branding
4. **Agregar** funcionalidades adicionales según necesites
5. **Desplegar** en producción cuando esté listo

## 📞 Soporte

Si tienes algún problema durante la configuración, revisa:
1. Los logs del servidor backend
2. La consola del navegador (F12)
3. Las variables de entorno
4. La conexión a la base de datos

¡Listo! Ahora puedes probar tu sistema completo de gestión de préstamos CREDIA. 🎉
