# Guía de Inicio Rápido

## 🚀 Iniciar el Proyecto

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Base de Datos

Crear archivo `.env`:

```env
DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/loans_db?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=change-this-secret
BCRYPT_ROUNDS=10
```

### 3. Crear Base de Datos

```bash
# Opción 1: Usando psql
psql -U postgres
CREATE DATABASE loans_db;
\q

# Opción 2: Usando pgAdmin (interfaz gráfica)
```

### 4. Generar Cliente Prisma

```bash
npm run prisma:generate
```

### 5. Ejecutar Migraciones

```bash
npm run prisma:migrate
```

Cuando solicite un nombre, escribir: `init`

### 6. Iniciar Servidor

```bash
npm run start:dev
```

✅ El servidor estará disponible en: `http://localhost:3000/api`

---

## 📝 Comandos Útiles

### Desarrollo

```bash
# Iniciar en modo desarrollo (con hot-reload)
npm run start:dev

# Iniciar en modo debug
npm run start:debug

# Ver la base de datos visualmente
npm run prisma:studio
```

### Prisma

```bash
# Generar cliente después de cambios en schema.prisma
npm run prisma:generate

# Crear nueva migración
npm run prisma:migrate dev --name nombre_migracion

# Aplicar migraciones pendientes
npm run prisma:migrate deploy

# Resetear base de datos (¡CUIDADO!)
npm run prisma:migrate reset

# Ver estado de migraciones
npx prisma migrate status

# Formatear schema.prisma
npx prisma format
```

### Producción

```bash
# Compilar
npm run build

# Iniciar en producción
npm run start:prod
```

### Testing

```bash
# Ejecutar tests
npm run test

# Tests en modo watch
npm run test:watch

# Tests con coverage
npm run test:cov
```

---

## 🧪 Probar la API

### Opción 1: Usando cURL (Windows PowerShell)

```powershell
# Crear un prestamista
Invoke-RestMethod -Uri "http://localhost:3000/api/lenders" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"name":"Mi Financiera","isActive":true}'

# Listar prestamistas
Invoke-RestMethod -Uri "http://localhost:3000/api/lenders" -Method GET
```

### Opción 2: Usando Postman

1. Importar colección desde `API_EXAMPLES.md`
2. Configurar Base URL: `http://localhost:3000/api`

### Opción 3: Usando VS Code REST Client

Crear archivo `test.http`:

```http
### Crear Lender
POST http://localhost:3000/api/lenders
Content-Type: application/json

{
  "name": "Mi Financiera",
  "isActive": true
}

### Listar Lenders
GET http://localhost:3000/api/lenders
```

---

## 📊 Flujo de Trabajo Típico

### 1. Configurar Prestamista

```bash
POST /api/lenders
{
  "name": "Financiera XYZ"
}
```

Guardar el `id` retornado.

### 2. Crear Usuario Admin

```bash
POST /api/users
{
  "email": "admin@financiera.com",
  "password": "SecurePass123",
  "role": "ADMIN",
  "lenderId": "uuid-del-lender"
}
```

### 3. Crear Cliente

```bash
POST /api/clients
{
  "lenderId": "uuid-del-lender",
  "fullName": "Juan Pérez",
  "documentNumber": "12345678",
  "phone": "+1234567890"
}
```

Guardar el `id` del cliente.

### 4. Crear Préstamo

```bash
POST /api/loans
{
  "lenderId": "uuid-del-lender",
  "clientId": "uuid-del-cliente",
  "type": "MONTHLY_INTEREST",
  "principalAmount": 10000,
  "monthlyInterestRate": 0.05,
  "paymentFrequency": "MONTHLY",
  "startDate": "2025-01-01"
}
```

Guardar el `id` del préstamo.

### 5. Registrar Pago

```bash
POST /api/payments
{
  "loanId": "uuid-del-prestamo",
  "clientId": "uuid-del-cliente",
  "totalAmount": 1500
}
```

### 6. Ver Resumen del Préstamo

```bash
GET /api/loans/{uuid-del-prestamo}/summary
```

---

## 🔍 Verificar que Todo Funciona

### Verificar Servidor

```bash
# Debería retornar datos
curl http://localhost:3000/api/lenders
```

### Verificar Base de Datos

```bash
# Opción 1: Prisma Studio
npm run prisma:studio

# Opción 2: psql
psql -U postgres -d loans_db
\dt
SELECT * FROM lenders;
\q
```

---

## 🐛 Troubleshooting

### El servidor no inicia

```bash
# Verificar que no hay otro proceso en el puerto 3000
netstat -ano | findstr :3000

# Cambiar puerto en .env
PORT=3001
```

### Error de conexión a base de datos

```bash
# Verificar que PostgreSQL está corriendo
net start | findstr postgres

# Verificar credenciales en .env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/loans_db"
```

### Errores de TypeScript

```bash
# Limpiar y reinstalar
Remove-Item -Recurse -Force node_modules, dist
npm install
npm run build
```

### Errores de Prisma

```bash
# Regenerar cliente
npm run prisma:generate

# Verificar migraciones
npx prisma migrate status

# Si hay problemas, resetear (CUIDADO: borra datos)
npm run prisma:migrate reset
```

---

## 📁 Estructura del Proyecto

```
Cobro/
├── prisma/
│   └── schema.prisma          # Modelos de base de datos
├── src/
│   ├── clients/               # Módulo de clientes
│   ├── lender/                # Módulo de prestamistas
│   ├── loans/                 # Módulo de préstamos
│   ├── payments/              # Módulo de pagos
│   │   └── services/          # Servicios de cálculo
│   ├── prisma/                # Módulo Prisma
│   ├── users/                 # Módulo de usuarios
│   ├── app.module.ts          # Módulo principal
│   └── main.ts                # Punto de entrada
├── .env                       # Variables de entorno (no versionar)
├── .env.example               # Ejemplo de variables
├── package.json               # Dependencias
├── tsconfig.json              # Configuración TypeScript
├── nest-cli.json              # Configuración NestJS
├── README.md                  # Documentación principal
├── API_EXAMPLES.md            # Ejemplos de API
├── ARCHITECTURE.md            # Documentación de arquitectura
└── DATABASE_SETUP.md          # Configuración de BD
```

---

## 🎯 Próximos Pasos

1. ✅ Instalar y configurar proyecto
2. ✅ Crear primer prestamista
3. ✅ Crear primer usuario
4. ✅ Crear primer cliente
5. ✅ Crear primer préstamo
6. ✅ Registrar primer pago
7. 🔄 Implementar autenticación JWT
8. 🔄 Agregar jobs programados para intereses
9. 🔄 Implementar notificaciones
10. 🔄 Crear dashboard frontend

---

## 📚 Documentación Adicional

- **README.md**: Visión general del proyecto
- **API_EXAMPLES.md**: Ejemplos detallados de endpoints
- **ARCHITECTURE.md**: Arquitectura y patrones
- **DATABASE_SETUP.md**: Configuración de PostgreSQL

---

## 🆘 Ayuda

### Logs del Servidor

Los logs aparecerán en la consola donde ejecutaste `npm run start:dev`

### Prisma Studio

Interfaz visual para ver/editar datos:

```bash
npm run prisma:studio
```

Abre en: `http://localhost:5555`

### PostgreSQL

Ver datos directamente:

```bash
psql -U postgres -d loans_db
SELECT * FROM loans LIMIT 5;
```

---

## ✅ Checklist de Instalación

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL 14+ instalado
- [ ] Repositorio clonado/descargado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Archivo `.env` configurado
- [ ] Base de datos creada
- [ ] Cliente Prisma generado
- [ ] Migraciones ejecutadas
- [ ] Servidor iniciado correctamente
- [ ] Primer endpoint probado

Si completaste todos estos pasos, ¡el sistema está listo para usar! 🎉
