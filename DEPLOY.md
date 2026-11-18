# Guía de Despliegue con Docker — CREDIA Loan Simulator

Esta guía describe cómo desplegar **CREDIA** en un VPS Linux usando Docker y Docker Compose sin interferir con otros servicios existentes en el mismo servidor.

---

## 1. Requisitos previos en el VPS

- **Git** instalado.
- **Docker Engine** y **Docker Compose v2** (`docker compose version`).
- **OpenSSL** (para generar contraseñas y secretos seguros).
- **Puerto disponible en localhost**: por defecto `3100` en `127.0.0.1` (configurable con `APP_PORT`).
- **Nginx** (u otro reverse proxy) ya configurado en el VPS para exponer el servicio con HTTPS.

> **Nota de aislamiento:** La base de datos (servicio `db`) NO publica puertos hacia el exterior ni hacia el host; solo es accesible desde la red interna del proyecto (`credia-net` con prefijo de `COMPOSE_PROJECT_NAME`). La aplicación (servicio `app`) solo escucha en `127.0.0.1:${APP_PORT:-3100}`.

---

## 2. Clonar el repositorio y seleccionar la rama

```bash
git clone -b feature/dockerizacion <URL_DEL_REPOSITORIO> credia
cd credia
```

Si el repositorio ya está clonado en el VPS:

```bash
cd credia
git fetch origin
git checkout feature/dockerizacion
git pull origin feature/dockerizacion
```

---

## 3. Configurar las variables de entorno

Copia la plantilla `.env.docker.example` a `.env.docker`:

```bash
cp .env.docker.example .env.docker
```

Genera secretos fuertes para `POSTGRES_PASSWORD`, `JWT_SECRET` y `ADMIN_INITIAL_PASSWORD`:

```bash
openssl rand -hex 32
```

Edita `.env.docker` (`nano .env.docker` o `vim .env.docker`) y configura como mínimo:

- `COMPOSE_PROJECT_NAME`: nombre único del proyecto en Docker Compose (por defecto `credia`). Si despliegas una segunda instancia en el mismo VPS, usa otro nombre (ej. `credia-cliente2`) junto con otro `APP_PORT` para aislar contenedores, volúmenes y red.
- `APP_PORT`: puerto local en `127.0.0.1` (por defecto `3100`).
- `POSTGRES_PASSWORD`: contraseña segura para PostgreSQL (obligatoria).
- `JWT_SECRET`: secreto largo y aleatorio de al menos 32 bytes hex (obligatorio).
- `ADMIN_INITIAL_PASSWORD`: contraseña del usuario administrador inicial (obligatoria).
- `ADMIN_INITIAL_USERNAME` y `SUPER_ADMIN_USERNAME`: deben coincidir (por defecto `admin`).
- `ADMIN_INITIAL_EMAIL`: correo del administrador inicial.
- `FRONTEND_URL`: **debe ser la URL pública final** desde donde accederán los usuarios (por ejemplo, `https://credia.tudominio.com`), para que CORS permita las peticiones correctamente.

> **Importante:** Nunca subas `.env.docker` al repositorio; ya está excluido en `.gitignore`.

---

## 4. Construir y levantar los contenedores

Ejecuta el build y levanta los servicios en segundo plano:

```bash
docker compose --env-file .env.docker up -d --build
```

Al iniciar:
1. Se levanta el servicio `db` (`postgres:16-alpine`) con volumen persistente `credia_pgdata` (aislado por `COMPOSE_PROJECT_NAME`).
2. Docker Compose espera a que `db` pase su healthcheck (`pg_isready`).
3. Se inicia el servicio `app`, ejecuta `node setupDatabase.js` (crea esquemas/tablas de forma idempotente y el usuario admin inicial si no existe) y arranca `node index.js`.

---

## 5. Comprobar que el despliegue funciona

### Ver estado de los contenedores

```bash
docker compose --env-file .env.docker ps
```

Ambos servicios (`db` y `app`) deben aparecer en estado `Up` y `(healthy)`.

### Revisar los logs

```bash
docker compose --env-file .env.docker logs -f app
```

Para ver los logs de la base de datos:

```bash
docker compose --env-file .env.docker logs -f db
```

### Probar el endpoint de salud

```bash
curl -i http://127.0.0.1:3100/api/health
```

Respuesta esperada (`HTTP 200`):

```json
{"status":"ok","database":"connected"}
```

---

## 6. Primer ingreso con el administrador inicial

Una vez configurado el proxy inverso hacia el dominio público:

1. Abre la URL pública configurada en `FRONTEND_URL` (por ejemplo, `https://credia.tudominio.com`).
2. Inicia sesión con:
   - **Usuario:** el valor de `ADMIN_INITIAL_USERNAME` (por defecto `admin`).
   - **Contraseña:** el valor de `ADMIN_INITIAL_PASSWORD` definido en `.env.docker`.
3. Cambia la contraseña desde la aplicación si lo deseas y crea los usuarios operativos necesarios.

---

## 7. Puerto para proxear desde Nginx del VPS

En la configuración del Nginx del VPS (server block del dominio de CREDIA), apunta el `proxy_pass` únicamente al puerto local configurado:

- **Destino del proxy:** `http://127.0.0.1:3100` (o el puerto que hayas puesto en `APP_PORT`).
- Asegúrate de que `FRONTEND_URL` en `.env.docker` coincida exactamente con el esquema y dominio público final (`https://...`), sin barra final.

---

## 8. Respaldo y restauración de la base de datos

### Crear un respaldo (`pg_dump`)

Reemplaza `credia_user` y `credia_db` si usaste otros valores en `PGUSER` y `PGDATABASE`:

```bash
mkdir -p backups
docker compose --env-file .env.docker exec -T db pg_dump -U credia_user -d credia_db -F c > ./backups/credia_$(date +%Y%m%d_%H%M%S).dump
```

También puedes generar un respaldo en SQL plano comprimido:

```bash
docker compose --env-file .env.docker exec -T db pg_dump -U credia_user -d credia_db | gzip > ./backups/credia_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restaurar un respaldo

Si es un archivo `.dump` (formato custom):

```bash
docker compose --env-file .env.docker exec -T db pg_restore -U credia_user -d credia_db --clean --if-exists < ./backups/ARCHIVO_RESPALDO.dump
```

Si es un archivo `.sql.gz`:

```bash
gunzip -c ./backups/ARCHIVO_RESPALDO.sql.gz | docker compose --env-file .env.docker exec -T db psql -U credia_user -d credia_db
```

---

## 9. Actualizar a una nueva versión sin perder datos

1. **Haz un respaldo previo** de la base de datos (sección 8).
2. Descarga los últimos cambios del código:
   ```bash
   git pull origin <rama_o_tag>
   ```
3. Reconstruye y recrea solo la aplicación manteniendo el volumen de datos intacto:
   ```bash
   docker compose --env-file .env.docker up -d --build
   ```
4. Verifica estado, logs y `/api/health` (sección 5).

> **Advertencia:** Nunca ejecutes `docker compose --env-file .env.docker down -v` en producción, ya que `-v` elimina el volumen de PostgreSQL y borra la base de datos.

---

## 10. Detener el servicio

Para detener y eliminar los contenedores (conservando el volumen de datos):

```bash
docker compose --env-file .env.docker down
```

---

## 11. Cómo revertir si algo falla

1. Si la nueva versión falla al arrancar, revisa los logs:
   ```bash
   docker compose --env-file .env.docker logs --tail=100 app
   ```
2. Vuelve al commit anterior que funcionaba:
   ```bash
   git log --oneline -n 5
   git checkout <COMMIT_ANTERIOR>
   ```
3. Reconstruye y levanta de nuevo:
   ```bash
   docker compose --env-file .env.docker up -d --build
   ```
4. Si además la actualización aplicó cambios en la base de datos que debas deshacer, detén `app` y restaura el respaldo previo (sección 8):
   ```bash
   docker compose --env-file .env.docker stop app
   # Restaurar el respaldo siguiendo la sección 8
   docker compose --env-file .env.docker start app
   ```
