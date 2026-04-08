# Ejemplos de Uso de la API

Este archivo contiene ejemplos prácticos de cómo usar la API del sistema de préstamos.

## 1. Configuración Inicial

### Crear un Prestamista (Lender)

```bash
POST http://localhost:3000/api/lenders
Content-Type: application/json

{
  "name": "Financiera XYZ",
  "isActive": true
}
```

### Crear un Usuario Admin

```bash
POST http://localhost:3000/api/users
Content-Type: application/json

{
  "email": "admin@financiera.com",
  "password": "SecurePass123",
  "role": "ADMIN",
  "lenderId": "uuid-del-lender"
}
```

## 2. Gestión de Clientes

### Crear un Cliente

```bash
POST http://localhost:3000/api/clients
Content-Type: application/json

{
  "lenderId": "uuid-del-lender",
  "fullName": "Juan Pérez",
  "documentNumber": "12345678",
  "phone": "+1234567890",
  "address": "Calle Principal 123",
  "notes": "Cliente frecuente"
}
```

### Listar Clientes de un Prestamista

```bash
GET http://localhost:3000/api/clients?lenderId=uuid-del-lender
```

## 3. Crear Préstamos

### Préstamo con Cuotas Fijas

```bash
POST http://localhost:3000/api/loans
Content-Type: application/json

{
  "lenderId": "uuid-del-lender",
  "clientId": "uuid-del-cliente",
  "type": "FIXED_INSTALLMENTS",
  "principalAmount": 5000,
  "installmentAmount": 500,
  "totalInstallments": 12,
  "paymentFrequency": "MONTHLY",
  "startDate": "2025-01-15"
}
```

`expectedEndDate` se calcula automÃ¡ticamente en backend con base en `startDate`, `paymentFrequency` y `totalInstallments`.

### Préstamo con Interés Mensual

```bash
POST http://localhost:3000/api/loans
Content-Type: application/json

{
  "lenderId": "uuid-del-lender",
  "clientId": "uuid-del-cliente",
  "type": "MONTHLY_INTEREST",
  "principalAmount": 10000,
  "monthlyInterestRate": 0.05,
  "paymentFrequency": "MONTHLY",
  "startDate": "2025-01-01",
  "expectedEndDate": "2026-01-01"
}
```

### Préstamo con Interés Diario

```bash
POST http://localhost:3000/api/loans
Content-Type: application/json

{
  "lenderId": "uuid-del-lender",
  "clientId": "uuid-del-cliente",
  "type": "DAILY_INTEREST",
  "principalAmount": 3000,
  "monthlyInterestRate": 0.06,
  "paymentFrequency": "DAILY",
  "startDate": "2025-01-01"
}
```

## 4. Gestión de Pagos

### Registrar un Pago

```bash
POST http://localhost:3000/api/payments
Content-Type: application/json

{
  "loanId": "uuid-del-prestamo",
  "clientId": "uuid-del-cliente",
  "totalAmount": 1500,
  "paymentDate": "2025-01-20"
}
```

**Respuesta esperada:**

```json
{
  "payment": {
    "id": "uuid",
    "loanId": "uuid",
    "clientId": "uuid",
    "totalAmount": 1500,
    "appliedToPenalty": 0,
    "appliedToInterest": 500,
    "appliedToPrincipal": 1000,
    "paymentDate": "2025-01-20",
    "createdAt": "2025-01-20T10:00:00Z"
  },
  "distribution": {
    "totalAmount": 1500,
    "appliedToPenalty": 0,
    "appliedToInterest": 500,
    "appliedToPrincipal": 1000,
    "remaining": 0
  },
  "loanStatus": {
    "currentPrincipal": 9000,
    "isPaid": false
  }
}
```

### Simular un Pago (sin aplicarlo)

```bash
GET http://localhost:3000/api/payments/simulate/uuid-del-prestamo?amount=2000
```

**Respuesta esperada:**

```json
{
  "totalAmount": 2000,
  "appliedToPenalty": 100,
  "appliedToInterest": 400,
  "appliedToPrincipal": 1500,
  "remaining": 0
}
```

### Listar Pagos de un Préstamo

```bash
GET http://localhost:3000/api/payments?loanId=uuid-del-prestamo
```

### Listar Pagos de un Cliente

```bash
GET http://localhost:3000/api/payments?clientId=uuid-del-cliente
```

## 5. Consultas de Préstamos

### Obtener Detalles de un Préstamo

```bash
GET http://localhost:3000/api/loans/uuid-del-prestamo
```

**Respuesta incluye:**

- Datos del préstamo
- Cliente
- Prestamista
- Todos los intereses generados
- Todas las moras
- Todos los pagos
- Todas las cuotas (si aplica)

### Obtener Resumen Financiero de un Préstamo

```bash
GET http://localhost:3000/api/loans/uuid-del-prestamo/summary
```

**Respuesta esperada:**

```json
{
  "loan": {
    "id": "uuid",
    "type": "MONTHLY_INTEREST",
    "status": "ACTIVE",
    "startDate": "2025-01-01",
    "expectedEndDate": "2026-01-01"
  },
  "capital": {
    "principalAmount": 10000,
    "currentPrincipal": 8000,
    "totalPaid": 2000
  },
  "interest": {
    "totalGenerated": 1200,
    "totalPaid": 800,
    "totalPending": 400
  },
  "penalty": {
    "totalAmount": 150,
    "totalCharged": 50,
    "totalPending": 100
  },
  "payments": {
    "totalAmount": 2850,
    "appliedToInterest": 800,
    "appliedToPrincipal": 2000,
    "appliedToPenalty": 50,
    "count": 3
  },
  "profit": {
    "netProfit": 850
  }
}
```

### Listar Préstamos de un Cliente

```bash
GET http://localhost:3000/api/loans?clientId=uuid-del-cliente
```

### Listar Préstamos de un Prestamista

```bash
GET http://localhost:3000/api/loans?lenderId=uuid-del-lender
```

## 6. Actualización de Datos

### Actualizar Estado de un Préstamo

```bash
PATCH http://localhost:3000/api/loans/uuid-del-prestamo
Content-Type: application/json

{
  "status": "DEFAULTED"
}
```

### Actualizar Datos de un Cliente

```bash
PATCH http://localhost:3000/api/clients/uuid-del-cliente
Content-Type: application/json

{
  "phone": "+9876543210",
  "address": "Nueva Dirección 456"
}
```

## 7. Escenarios Completos

### Escenario 1: Préstamo Simple con Pago

```bash
# 1. Crear préstamo de $5000 con interés mensual del 5%
POST http://localhost:3000/api/loans
{
  "lenderId": "lender-uuid",
  "clientId": "client-uuid",
  "type": "MONTHLY_INTEREST",
  "principalAmount": 5000,
  "monthlyInterestRate": 0.05,
  "paymentFrequency": "MONTHLY",
  "startDate": "2025-01-01"
}

# 2. Primer mes: generar interés de $250 (5% de $5000)
# Esto se haría con un servicio programado, pero para ejemplo manual:
# El interés se calcula automáticamente

# 3. Cliente paga $600
POST http://localhost:3000/api/payments
{
  "loanId": "loan-uuid",
  "clientId": "client-uuid",
  "totalAmount": 600
}

# Distribución automática:
# - $250 a intereses
# - $350 al capital
# Capital pendiente: $4650
```

### Escenario 2: Préstamo con Mora

```bash
# 1. Cliente tiene préstamo activo con atraso
# 2. Se calcula mora del 5% sobre capital pendiente

# 3. Cliente hace pago de $1000
POST http://localhost:3000/api/payments
{
  "loanId": "loan-uuid",
  "clientId": "client-uuid",
  "totalAmount": 1000
}

# Distribución automática:
# - Primero cubre la mora (ej. $150)
# - Luego intereses pendientes (ej. $400)
# - Finalmente capital (ej. $450)
```

### Escenario 3: Préstamo de Cuotas Fijas

```bash
# 1. Crear préstamo de $6000 en 12 cuotas de $500
POST http://localhost:3000/api/loans
{
  "lenderId": "lender-uuid",
  "clientId": "client-uuid",
  "type": "FIXED_INSTALLMENTS",
  "principalAmount": 6000,
  "installmentAmount": 500,
  "totalInstallments": 12,
  "paymentFrequency": "MONTHLY",
  "startDate": "2025-01-01"
}

# El sistema crea automáticamente 12 cuotas con fechas de vencimiento

# 2. Cliente paga primera cuota
POST http://localhost:3000/api/payments
{
  "loanId": "loan-uuid",
  "clientId": "client-uuid",
  "totalAmount": 500
}

# El sistema marca la primera cuota como PAID
```

## 8. Consultas Útiles

### Obtener todos los préstamos activos de un prestamista

```bash
GET http://localhost:3000/api/loans?lenderId=uuid&status=ACTIVE
```

### Ver el historial completo de pagos de un cliente

```bash
GET http://localhost:3000/api/payments?clientId=uuid
```

### Verificar cuánto debe un cliente

```bash
GET http://localhost:3000/api/loans/uuid/summary
```

## 9. Notas Importantes

### Distribución Automática de Pagos

El sistema SIEMPRE distribuye los pagos en este orden:

1. **Mora** (penalties no cobradas)
2. **Intereses** (intereses pendientes, FIFO)
3. **Capital** (principal pendiente)

### No Capitalización

Los intereses **NUNCA** se suman al capital automáticamente. Se mantienen como registros separados en `LoanInterest`.

### Soft Deletes

Las entidades no se eliminan físicamente. Se usa `isActive: false` o estados como `CANCELLED`.

### Validaciones

Todos los endpoints validan:

- Tipos de datos
- Valores mínimos/máximos
- Campos requeridos según el tipo de préstamo
- Relaciones existentes (lender, client, loan)
