# Sistema de Gestión de Préstamos

Sistema multi-prestamista con separación estricta entre capital, intereses y mora.

## 🏗️ Arquitectura

Este sistema está diseñado siguiendo principios de ingeniería sólidos:

### Principios de Diseño

1. **Multi-prestamista**: Cada prestamista (Lender) tiene sus propios datos aislados
2. **Separación estricta**: Capital, intereses y mora NUNCA se mezclan
3. **Pagos como eventos**: Cada pago es un evento que el backend distribuye automáticamente
4. **No capitalización automática**: Los intereses NO se suman al capital
5. **Lógica en backend**: Todo cálculo financiero ocurre en el servidor

### Estructura de Módulos

```
src/
├── prisma/          # Módulo Prisma (Global)
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── lender/          # Módulo de Prestamistas
│   ├── lender.controller.ts
│   ├── lender.service.ts
│   ├── lender.module.ts
│   └── dto/
├── users/           # Módulo de Usuarios (ADMIN/CLIENT)
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── dto/
├── clients/         # Módulo de Clientes
│   ├── clients.controller.ts
│   ├── clients.service.ts
│   ├── clients.module.ts
│   └── dto/
├── loans/           # Módulo de Préstamos
│   ├── loans.controller.ts
│   ├── loans.service.ts
│   ├── loans.module.ts
│   └── dto/
└── payments/        # Módulo de Pagos
    ├── payments.controller.ts
    ├── payments.service.ts
    ├── payments.module.ts
    ├── dto/
    └── services/    # Servicios de cálculo
        ├── interest-calculation.service.ts
        ├── penalty-calculation.service.ts
        └── payment-distribution.service.ts
```

## 📊 Modelo de Datos

### Entidades Principales

1. **Lender** (Prestamista)
2. **User** (Usuario: ADMIN o CLIENT)
3. **Client** (Perfil financiero del cliente)
4. **Loan** (Préstamo)
5. **LoanInterest** (Intereses generados por período)
6. **LoanPenalty** (Mora)
7. **Payment** (Pagos)
8. **Installment** (Cuotas para préstamos de cuotas fijas)

### Tipos de Préstamos

- `FIXED_INSTALLMENTS`: Cuotas fijas
- `DAILY_INTEREST`: Interés diario
- `MONTHLY_INTEREST`: Interés mensual

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### Pasos

1. **Clonar o navegar al proyecto**

```bash
cd c:\Users\pc\Desktop\Cobro
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Crear archivo `.env` basado en `.env.example`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/loans_db?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
BCRYPT_ROUNDS=10
```

4. **Generar cliente de Prisma**

```bash
npm run prisma:generate
```

5. **Ejecutar migraciones**

```bash
npm run prisma:migrate
```

6. **Iniciar servidor de desarrollo**

```bash
npm run start:dev
```

El servidor estará disponible en: `http://localhost:3000/api`

## 📝 Uso de la API

### Endpoints Principales

#### Lenders (Prestamistas)

```bash
POST   /api/lenders          # Crear prestamista
GET    /api/lenders          # Listar prestamistas
GET    /api/lenders/:id      # Obtener prestamista
PATCH  /api/lenders/:id      # Actualizar prestamista
DELETE /api/lenders/:id      # Desactivar prestamista
```

#### Users (Usuarios)

```bash
POST   /api/users            # Crear usuario
GET    /api/users            # Listar usuarios (filtro opcional: ?lenderId=xxx)
GET    /api/users/:id        # Obtener usuario
PATCH  /api/users/:id        # Actualizar usuario
DELETE /api/users/:id        # Desactivar usuario
```

#### Clients (Clientes)

```bash
POST   /api/clients          # Crear cliente
GET    /api/clients          # Listar clientes (filtro opcional: ?lenderId=xxx)
GET    /api/clients/:id      # Obtener cliente
PATCH  /api/clients/:id      # Actualizar cliente
DELETE /api/clients/:id      # Desactivar cliente
```

#### Loans (Préstamos)

```bash
POST   /api/loans            # Crear préstamo
GET    /api/loans            # Listar préstamos (filtros: ?lenderId=xxx&clientId=xxx)
GET    /api/loans/:id        # Obtener préstamo con detalles
GET    /api/loans/:id/summary # Obtener resumen financiero
PATCH  /api/loans/:id        # Actualizar préstamo
DELETE /api/loans/:id        # Cancelar préstamo
```

#### Payments (Pagos)

```bash
POST   /api/payments                    # Crear pago (se distribuye automáticamente)
GET    /api/payments                    # Listar pagos (filtros: ?loanId=xxx&clientId=xxx)
GET    /api/payments/:id                # Obtener pago
GET    /api/payments/simulate/:loanId?amount=1000  # Simular distribución de pago
```

### Ejemplo: Crear un préstamo

```json
POST /api/loans
{
  "lenderId": "uuid-del-prestamista",
  "clientId": "uuid-del-cliente",
  "type": "MONTHLY_INTEREST",
  "principalAmount": 10000,
  "monthlyInterestRate": 0.05,
  "paymentFrequency": "MONTHLY",
  "startDate": "2025-01-01",
  "expectedEndDate": "2026-01-01"
}
```

En prÃ©stamos `FIXED_INSTALLMENTS`, `expectedEndDate` se deriva en backend a partir de `startDate`, `paymentFrequency` y `totalInstallments`.

### Ejemplo: Registrar un pago

```json
POST /api/payments
{
  "loanId": "uuid-del-prestamo",
  "clientId": "uuid-del-cliente",
  "totalAmount": 1500
}
```

El backend automáticamente distribuirá el pago:

1. Primero a mora (si existe)
2. Luego a intereses pendientes
3. Finalmente al capital

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Servidor con hot-reload

# Producción
npm run build              # Compilar
npm run start:prod         # Iniciar en producción

# Prisma
npm run prisma:generate    # Generar cliente Prisma
npm run prisma:migrate     # Ejecutar migraciones
npm run prisma:studio      # Abrir Prisma Studio

# Testing
npm run test               # Tests unitarios
npm run test:watch         # Tests en modo watch
npm run test:cov           # Tests con coverage
```

## 📐 Reglas de Negocio

### ❌ Cosas que NO se pueden hacer

- ❌ Mezclar capital e intereses
- ❌ Cálculos financieros en frontend
- ❌ Capitalización automática de intereses
- ❌ Lógica financiera en controllers

### ✅ Cosas que SÍ se deben hacer

- ✅ Servicios dedicados a cálculos
- ✅ Transacciones DB para pagos
- ✅ Validaciones en DTOs
- ✅ Separación de responsabilidades

## 🎯 Lógica de Distribución de Pagos

Implementada en `PaymentDistributionService`:

```
1. ¿Hay mora pendiente? → Aplicar primero a mora
2. ¿Hay intereses pendientes? → Aplicar luego a intereses
3. ¿Queda dinero? → Aplicar al capital principal
4. ¿Queda más dinero? → Se devuelve como "sobrante"
```

Esta lógica es **inmutable** y está en el backend.

## 📚 Servicios de Cálculo

### InterestCalculationService

- Calcula intereses diarios/mensuales
- Genera registros de interés por período
- NO capitaliza automáticamente
- Aplica pagos a intereses (FIFO)

### PenaltyCalculationService

- Calcula mora basada en días de atraso
- Registra mora sin cobrarla automáticamente
- Aplica pagos a mora (FIFO)

### PaymentDistributionService

- Distribuye pagos según orden: mora → intereses → capital
- Actualiza estado del préstamo
- Marca cuotas como pagadas (si aplica)
- Permite simular pagos sin aplicarlos

## 🗄️ Base de Datos

### Crear base de datos

```sql
CREATE DATABASE loans_db;
```

### Ejecutar migraciones

```bash
npm run prisma:migrate
```

### Ver datos con Prisma Studio

```bash
npm run prisma:studio
```

## 🔐 Seguridad

- Contraseñas hasheadas con bcrypt
- Validación de datos con class-validator
- Soft deletes para preservar historial
- Aislamiento de datos por lenderId

## 📖 Documentación Adicional

- [Prisma Docs](https://www.prisma.io/docs/)
- [NestJS Docs](https://docs.nestjs.com/)

## 🤝 Contribuir

Este proyecto sigue principios de ingeniería estrictos. Cualquier contribución debe:

1. Mantener la separación capital/intereses/mora
2. Incluir validaciones adecuadas
3. Documentar la lógica de negocio
4. Incluir tests

## 📄 Licencia

UNLICENSED - Proyecto privado
