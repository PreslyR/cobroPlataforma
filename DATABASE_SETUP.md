# Configuración de Base de Datos PostgreSQL

## Instalación de PostgreSQL

### Windows

1. Descargar PostgreSQL desde: https://www.postgresql.org/download/windows/
2. Ejecutar el instalador
3. Durante la instalación:
   - Puerto por defecto: `5432`
   - Crear contraseña para usuario `postgres`
   - Instalar pgAdmin 4 (opcional, útil para administración)

### Verificar Instalación

```bash
psql --version
```

## Crear Base de Datos

### Opción 1: Usando pgAdmin

1. Abrir pgAdmin
2. Conectarse al servidor local
3. Click derecho en "Databases" → "Create" → "Database"
4. Nombre: `loans_db`
5. Owner: `postgres`
6. Save

### Opción 2: Usando línea de comandos

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE loans_db;

# Verificar
\l

# Salir
\q
```

## Configurar Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Formato: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/loans_db?schema=public"

PORT=3000
NODE_ENV=development
JWT_SECRET=change-this-to-a-secure-random-string
BCRYPT_ROUNDS=10
```

**Importante**: Reemplazar `tu_password` con la contraseña real de PostgreSQL.

## Ejecutar Migraciones

Una vez configurada la base de datos:

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npm run prisma:generate

# Crear y ejecutar migración inicial
npm run prisma:migrate

# Dar un nombre a la migración cuando se solicite, por ejemplo: "init"
```

Este proceso creará todas las tablas definidas en `prisma/schema.prisma`.

## Verificar las Tablas Creadas

### Usando psql

```bash
# Conectarse a la base de datos
psql -U postgres -d loans_db

# Listar todas las tablas
\dt

# Ver estructura de una tabla
\d lenders
\d loans
\d payments

# Salir
\q
```

### Usando Prisma Studio

```bash
npm run prisma:studio
```

Esto abrirá una interfaz web en `http://localhost:5555` donde puedes:
- Ver todas las tablas
- Crear, editar y eliminar registros
- Ejecutar consultas

## Tablas Creadas

El sistema creará las siguientes tablas:

1. **lenders** - Prestamistas
2. **users** - Usuarios (ADMIN/CLIENT)
3. **clients** - Clientes
4. **loans** - Préstamos
5. **loan_interests** - Intereses generados
6. **loan_penalties** - Moras
7. **payments** - Pagos
8. **installments** - Cuotas (para préstamos de cuotas fijas)
9. **_prisma_migrations** - Control de migraciones

## Datos de Prueba (Opcional)

### Crear un Prestamista de Prueba

```sql
INSERT INTO lenders (id, name, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Financiera Demo',
  true,
  NOW(),
  NOW()
);
```

### Crear un Usuario Admin de Prueba

Primero necesitas el ID del lender creado arriba, luego:

```sql
-- Reemplazar 'LENDER_UUID' con el ID real del lender
INSERT INTO users (id, email, "passwordHash", role, "lenderId", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@demo.com',
  -- Hash de "password123" con bcrypt
  '$2b$10$rqZQqK8f4QKJZV4Z8rJGxO8HZQ4.Rj7tF3Z4YzJ7Z4Z4Z4Z4Z4Z4Z4',
  'ADMIN',
  'LENDER_UUID',
  true,
  NOW(),
  NOW()
);
```

**Nota**: Para generar un hash real, usa la API o un script:

```javascript
// script.js
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('password123', 10);
console.log(hash);
```

## Comandos Útiles de Prisma

### Resetear la base de datos (¡CUIDADO! Elimina todos los datos)

```bash
npm run prisma:migrate reset
```

### Crear una nueva migración después de cambios en schema.prisma

```bash
npm run prisma:migrate dev --name nombre_de_la_migracion
```

### Aplicar migraciones pendientes

```bash
npm run prisma:migrate deploy
```

### Ver el estado de las migraciones

```bash
npx prisma migrate status
```

### Formatear schema.prisma

```bash
npx prisma format
```

## Backup y Restore

### Crear Backup

```bash
# Backup completo
pg_dump -U postgres -d loans_db -F c -b -v -f loans_db_backup.backup

# Solo esquema
pg_dump -U postgres -d loans_db -s -f loans_db_schema.sql

# Solo datos
pg_dump -U postgres -d loans_db -a -f loans_db_data.sql
```

### Restaurar Backup

```bash
# Restaurar desde archivo .backup
pg_restore -U postgres -d loans_db -v loans_db_backup.backup

# Restaurar desde SQL
psql -U postgres -d loans_db -f loans_db_backup.sql
```

## Troubleshooting

### Error: "password authentication failed"

1. Verificar contraseña en `.env`
2. Verificar que PostgreSQL esté corriendo:
   ```bash
   # Windows
   net start postgresql-x64-14  # Ajustar versión
   ```

### Error: "database does not exist"

Crear la base de datos manualmente:
```bash
psql -U postgres
CREATE DATABASE loans_db;
\q
```

### Error: "relation does not exist"

Ejecutar migraciones:
```bash
npm run prisma:migrate deploy
```

### Puerto 5432 en uso

Cambiar puerto en `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5433/loans_db"
```

Y configurar PostgreSQL para usar el puerto 5433.

## Conexión Remota (Opcional)

Si necesitas conectar desde otra máquina:

### 1. Editar `postgresql.conf`

Buscar y modificar:
```conf
listen_addresses = '*'
```

### 2. Editar `pg_hba.conf`

Agregar línea:
```conf
host    all    all    0.0.0.0/0    md5
```

### 3. Reiniciar PostgreSQL

```bash
# Windows
net stop postgresql-x64-14
net start postgresql-x64-14
```

### 4. Actualizar DATABASE_URL

```env
DATABASE_URL="postgresql://postgres:password@IP_REMOTA:5432/loans_db"
```

## Monitoreo

### Ver conexiones activas

```sql
SELECT * FROM pg_stat_activity WHERE datname = 'loans_db';
```

### Ver tamaño de la base de datos

```sql
SELECT pg_size_pretty(pg_database_size('loans_db'));
```

### Ver tamaño de cada tabla

```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Mejores Prácticas

1. **Backups regulares**: Configurar backups automáticos diarios
2. **Índices**: Prisma crea índices automáticos en FKs
3. **Conexiones**: Prisma maneja el pool de conexiones automáticamente
4. **Migraciones**: Siempre versionar con `prisma migrate`
5. **Seguridad**: Nunca commitear `.env` al repositorio
