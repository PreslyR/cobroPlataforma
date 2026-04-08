# Arquitectura del Sistema de Préstamos

## 📋 Índice

1. [Visión General](#visión-general)
2. [Principios Arquitectónicos](#principios-arquitectónicos)
3. [Capas de la Aplicación](#capas-de-la-aplicación)
4. [Flujo de Datos](#flujo-de-datos)
5. [Servicios de Cálculo](#servicios-de-cálculo)
6. [Reglas de Negocio](#reglas-de-negocio)

---

## Visión General

Este sistema implementa una arquitectura modular basada en NestJS siguiendo los principios SOLID y separación de responsabilidades.

```
┌─────────────────────────────────────────────────────────┐
│                      Cliente (API)                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Controllers Layer                     │
│  (Validación de entrada, Autorización, Serialización)   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Services Layer                        │
│         (Lógica de negocio, Orquestación)               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Calculation Services Layer                  │
│   (Cálculos puros: intereses, mora, distribución)       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 Prisma Service (ORM)                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 PostgreSQL Database                      │
└─────────────────────────────────────────────────────────┘
```

---

## Principios Arquitectónicos

### 1. Separación Estricta de Conceptos

**Capital, Intereses y Mora NUNCA se mezclan**

```typescript
// ❌ INCORRECTO
loan.totalDebt = loan.principal + loan.interest + loan.penalty;

// ✅ CORRECTO
const summary = {
  principal: loan.currentPrincipal,
  interestPending: calculatePendingInterest(loan),
  penaltyPending: calculatePendingPenalty(loan),
};
```

### 2. Pagos como Eventos

Los pagos NO modifican directamente el capital. Se registran y se distribuyen.

```typescript
// El servicio de distribución decide cómo aplicar el pago
const distribution = await paymentDistribution.processPayment(
  loanId,
  clientId,
  amount,
);

// Resultado: { appliedToPenalty, appliedToInterest, appliedToPrincipal }
```

### 3. Lógica en Backend

Todo cálculo financiero ocurre en el servidor. El frontend solo presenta datos.

### 4. Inmutabilidad de Registros Financieros

Los registros de pagos, intereses y mora nunca se modifican, solo se marcan como aplicados.

### 5. Multi-tenancy

Cada prestamista (Lender) tiene sus datos aislados.

---

## Capas de la Aplicación

### 1. Controllers Layer

**Responsabilidad**: Manejar HTTP, validar entrada, delegar a servicios.

```typescript
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    // Solo delega, NO contiene lógica de negocio
    return this.paymentsService.create(createPaymentDto);
  }
}
```

**Principios**:
- Controllers delgados (thin controllers)
- Solo validación de entrada (DTOs con class-validator)
- Sin lógica de negocio
- Sin acceso directo a base de datos

### 2. Services Layer (Business Logic)

**Responsabilidad**: Orquestar operaciones, aplicar reglas de negocio.

```typescript
@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private paymentDistribution: PaymentDistributionService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    // Orquesta la operación completa
    const result = await this.paymentDistribution.processPayment(
      createPaymentDto.loanId,
      createPaymentDto.clientId,
      createPaymentDto.totalAmount,
    );
    return result;
  }
}
```

**Principios**:
- Orquestación de operaciones complejas
- Validaciones de negocio
- Delegación a servicios especializados
- Acceso a base de datos via Prisma

### 3. Calculation Services Layer

**Responsabilidad**: Cálculos puros, sin efectos secundarios directos.

```typescript
@Injectable()
export class InterestCalculationService {
  // Calcula interés sin modificar la base de datos directamente
  calculateDailyInterest(
    principal: number,
    monthlyRate: number,
    days: number,
  ): number {
    const dailyRate = monthlyRate / 30;
    return principal * dailyRate * days;
  }
}
```

**Servicios especializados**:

1. **InterestCalculationService**
   - Cálculo de intereses diarios/mensuales
   - Generación de registros de interés
   - Aplicación de pagos a intereses (FIFO)

2. **PenaltyCalculationService**
   - Cálculo de mora
   - Generación de registros de mora
   - Aplicación de pagos a mora (FIFO)

3. **PaymentDistributionService**
   - Distribución automática de pagos
   - Actualización de estado de préstamos
   - Simulación de pagos

**Principios**:
- Funciones puras cuando es posible
- Cálculos independientes del estado
- Reutilizables
- Testeables

### 4. Data Access Layer (Prisma)

**Responsabilidad**: Acceso a base de datos.

```typescript
@Injectable()
export class PrismaService extends PrismaClient 
  implements OnModuleInit, OnModuleDestroy {
  // Maneja conexión y desconexión
}
```

**Configuración Global**:
- `@Global()` en `PrismaModule`
- Una instancia compartida
- Pool de conexiones automático

---

## Flujo de Datos

### Flujo 1: Crear Préstamo

```
Cliente → Controller → LoansService → Prisma → DB
                              ↓
                    Generar Cuotas (si aplica)
```

1. Cliente envía POST `/api/loans`
2. Controller valida DTO
3. LoansService valida tipo de préstamo
4. Se crea el préstamo en DB
5. Si es `FIXED_INSTALLMENTS`, se generan cuotas automáticamente

### Flujo 2: Registrar Pago (El más complejo)

```
Cliente → Controller → PaymentsService → PaymentDistributionService
                                                    ↓
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                        PenaltyCalculationService   InterestCalculationService
                                    ↓                               ↓
                            Aplicar a Mora                  Aplicar a Intereses
                                    ↓                               ↓
                                    └───────────────┬───────────────┘
                                                    ▼
                                            Aplicar a Capital
                                                    ↓
                                        Actualizar Estado Préstamo
                                                    ↓
                                          Crear Registro de Pago
```

**Orden de aplicación**:
1. Mora pendiente (FIFO)
2. Intereses pendientes (FIFO)
3. Capital principal
4. Sobrante (si existe)

### Flujo 3: Calcular Intereses (Job Programado)

```
Scheduler/Manual → InterestCalculationService → Crear LoanInterest
```

Este proceso debe ejecutarse periódicamente (diario/mensual) según el tipo de préstamo.

---

## Servicios de Cálculo

### InterestCalculationService

#### Métodos Principales

```typescript
// Calcula y persiste interés para un período
async calculateAndGenerateInterest(
  loanId: string,
  periodStartDate: Date,
  periodEndDate: Date,
): Promise<LoanInterest>

// Obtiene total de intereses pendientes
async getTotalPendingInterest(loanId: string): Promise<number>

// Aplica pago a intereses (FIFO)
async applyPaymentToInterest(
  loanId: string,
  paymentAmount: number,
): Promise<{ applied: number; remaining: number }>
```

#### Fórmulas

**Interés Diario**:
```
interés = principal × (tasaMensual / 30) × días
```

**Interés Mensual**:
```
interés = principal × tasaMensual
```

### PenaltyCalculationService

#### Métodos Principales

```typescript
// Calcula mora (NO la cobra automáticamente)
async calculatePenalty(
  loanId: string,
  daysLate: number,
  penaltyRate?: number,
): Promise<LoanPenalty>

// Obtiene mora pendiente no cobrada
async getTotalPendingPenalty(loanId: string): Promise<number>

// Aplica pago a mora (FIFO)
async applyPaymentToPenalty(
  loanId: string,
  paymentAmount: number,
): Promise<{ applied: number; remaining: number }>
```

#### Fórmula de Mora

```
mora = capitalPendiente × tasaMora × (díasAtraso / 30)
```

### PaymentDistributionService

#### Método Principal

```typescript
async processPayment(
  loanId: string,
  clientId: string,
  totalAmount: number,
  paymentDate?: Date,
): Promise<PaymentResult>
```

#### Algoritmo de Distribución

```typescript
remainingAmount = totalAmount

// PASO 1: Aplicar a mora
if (hasPendingPenalty) {
  { applied, remaining } = applyToPenalty(remainingAmount)
  appliedToPenalty = applied
  remainingAmount = remaining
}

// PASO 2: Aplicar a intereses
if (hasPendingInterest) {
  { applied, remaining } = applyToInterest(remainingAmount)
  appliedToInterest = applied
  remainingAmount = remaining
}

// PASO 3: Aplicar a capital
if (remainingAmount > 0) {
  appliedToPrincipal = min(remainingAmount, currentPrincipal)
  currentPrincipal -= appliedToPrincipal
  remainingAmount -= appliedToPrincipal
}

// PASO 4: Registrar pago
createPayment({
  totalAmount,
  appliedToPenalty,
  appliedToInterest,
  appliedToPrincipal,
})
```

---

## Reglas de Negocio

### ❌ Prohibiciones Estrictas

1. **NO mezclar capital e intereses**
   ```typescript
   // ❌ NUNCA hacer esto
   loan.principal += interest.amount;
   ```

2. **NO capitalización automática**
   ```typescript
   // ❌ NUNCA hacer esto
   if (interest.isPastDue) {
     loan.principal += interest.amount;
   }
   ```

3. **NO cálculos en frontend**
   ```typescript
   // ❌ En el frontend
   const totalDebt = principal + interest + penalty; // NO
   
   // ✅ En el backend
   const summary = await loansService.getLoanSummary(loanId);
   ```

4. **NO lógica financiera en controllers**
   ```typescript
   // ❌ En controller
   @Post('payment')
   create(@Body() dto: CreatePaymentDto) {
     const interest = loan.principal * 0.05; // NO
   }
   
   // ✅ En service
   @Post('payment')
   create(@Body() dto: CreatePaymentDto) {
     return this.paymentsService.create(dto); // Sí
   }
   ```

### ✅ Obligaciones Estrictas

1. **Usar servicios dedicados para cálculos**
   ```typescript
   const interest = await this.interestService.calculateInterest(...);
   ```

2. **Transacciones para pagos**
   ```typescript
   await this.prisma.$transaction(async (tx) => {
     // Todas las operaciones del pago
   });
   ```

3. **Validaciones en DTOs**
   ```typescript
   export class CreateLoanDto {
     @IsNumber()
     @Min(0)
     principalAmount: number;
   }
   ```

4. **Separación de responsabilidades**
   - Controllers: HTTP
   - Services: Negocio
   - Calculation Services: Cálculos
   - Prisma: Base de datos

---

## Patrones Utilizados

### 1. Dependency Injection

```typescript
@Injectable()
export class PaymentDistributionService {
  constructor(
    private prisma: PrismaService,
    private interestService: InterestCalculationService,
    private penaltyService: PenaltyCalculationService,
  ) {}
}
```

### 2. Repository Pattern (via Prisma)

```typescript
// Prisma actúa como repository
this.prisma.loan.findUnique(...)
this.prisma.payment.create(...)
```

### 3. Strategy Pattern (tipos de préstamos)

```typescript
switch (loan.type) {
  case LoanType.DAILY_INTEREST:
    return this.calculateDailyInterest(...);
  case LoanType.MONTHLY_INTEREST:
    return this.calculateMonthlyInterest(...);
  case LoanType.FIXED_INSTALLMENTS:
    return null; // Interés implícito en cuotas
}
```

### 4. Command Pattern (pagos como comandos)

```typescript
const command: CreatePaymentDto = {
  loanId,
  clientId,
  totalAmount,
};

const result = await this.paymentsService.create(command);
```

---

## Extensibilidad

### Agregar Nuevo Tipo de Préstamo

1. Agregar enum en `schema.prisma`:
   ```prisma
   enum LoanType {
     FIXED_INSTALLMENTS
     DAILY_INTEREST
     MONTHLY_INTEREST
     WEEKLY_INTEREST  // Nuevo
   }
   ```

2. Agregar lógica en `InterestCalculationService`:
   ```typescript
   case LoanType.WEEKLY_INTEREST:
     return this.calculateWeeklyInterest(...);
   ```

### Agregar Nuevo Método de Cálculo de Mora

1. Modificar `PenaltyCalculationService`:
   ```typescript
   async calculateProgressivePenalty(
     loanId: string,
     daysLate: number,
   ): Promise<LoanPenalty> {
     // Nueva lógica
   }
   ```

### Agregar Nuevo Tipo de Pago

1. Crear nuevo servicio:
   ```typescript
   @Injectable()
   export class AdvancedPaymentService {
     // Lógica especializada
   }
   ```

2. Inyectar en `PaymentsModule`

---

## Testing

### Unit Tests

```typescript
describe('InterestCalculationService', () => {
  it('should calculate daily interest correctly', () => {
    const result = service.calculateDailyInterest(10000, 0.05, 30);
    expect(result).toBe(500); // 5% de 10000
  });
});
```

### Integration Tests

```typescript
describe('PaymentDistributionService', () => {
  it('should distribute payment correctly', async () => {
    // Setup: crear préstamo con intereses y mora
    // Act: procesar pago
    // Assert: verificar distribución
  });
});
```

---

## Monitoreo y Logs

### Logs Importantes

```typescript
this.logger.log(`Payment processed: ${paymentId}`);
this.logger.warn(`High penalty detected: ${penaltyAmount}`);
this.logger.error(`Payment processing failed: ${error.message}`);
```

### Métricas Clave

- Tiempo de procesamiento de pagos
- Número de préstamos activos
- Intereses generados vs cobrados
- Tasa de mora

---

## Seguridad

### Validación de Entrada

```typescript
@IsNumber()
@Min(0.01)
@Max(1000000)
principalAmount: number;
```

### Aislamiento de Datos

```typescript
// Siempre filtrar por lenderId
where: {
  lenderId: currentUser.lenderId,
  id: loanId,
}
```

### Contraseñas

```typescript
const hash = await bcrypt.hash(password, 10);
```

---

## Conclusión

Esta arquitectura garantiza:

- ✅ Separación clara de responsabilidades
- ✅ Código mantenible y testeable
- ✅ Escalabilidad
- ✅ Cumplimiento de reglas de negocio
- ✅ Trazabilidad de operaciones financieras
