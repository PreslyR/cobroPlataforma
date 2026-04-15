# Contracts

## Purpose
This document defines the current contracts of the system.
It focuses on:
- entities
- field semantics
- API expectations
- contract-level invariants

This is not the place for detailed financial policy.
That belongs in `domain.md`.

## Contract Principles
1. The backend is the source of truth for all financial values.
2. Capital, interest, and penalty are separate values and must remain separately addressable.
3. The frontend consumes backend results and presents them.
4. The frontend must not derive payoff totals, debt balances, or settlement values locally.
5. Data is tenant-scoped by `lenderId`.

## Core Entities

### Lender
Represents the business owner or operator context.

Relevant contract expectations:
- all operational data is scoped to one lender
- dashboard, portfolio, clients, loans, payments, and reports must not leak across lenders

### User
Represents an internal user.

Current role in the repo:
- limited operational use
- not yet the main auth boundary of the product

### Client
Represents a borrower.

Contract expectations:
- belongs to one lender
- can have multiple loans
- can appear in client portfolio and operational debt views

### Loan
Represents a financial agreement.

Current active types:
1. `FIXED_INSTALLMENTS`
2. `MONTHLY_INTEREST`

Non-priority type:
- `DAILY_INTEREST`

Core fields and semantics:
- `principalAmount`: original capital granted
- `currentPrincipal`: current pending capital only
- `monthlyInterestRate`: monthly rate for monthly-interest loans
- `installmentAmount`: required for fixed-installment loans
- `totalInstallments`: required for fixed-installment loans
- `paymentFrequency`: cadence contract used by the loan type
- `startDate`: business start date of the loan
- `expectedEndDate`: derived end date for fixed-installment plans
- `status`: persisted state such as `ACTIVE`, `PAID`, `CANCELLED`
- `earlySettlementInterestMode`: settlement policy for monthly-interest loans

Important invariant:
- `currentPrincipal` is never the same thing as total debt.

### Installment
Represents a scheduled fixed-installment obligation.

Contract expectations:
- belongs to one loan
- carries installment order and due date
- status moves operationally through `PENDING`, `LATE`, `PAID`

### Loan Interest
Represents an interest obligation separate from capital.

Contract expectations:
- belongs to one loan
- can represent planned interest in fixed-installment loans
- can represent generated monthly periods in monthly-interest loans
- pending interest must remain separately queryable

### Loan Penalty
Represents penalty charges separate from capital and interest.

Contract expectations:
- belongs to one loan
- may optionally belong to one installment
- unpaid penalty must remain separately queryable

### Payment
Represents a payment event.

Contract expectations:
- belongs to one loan and one client
- has a business date
- stores the applied totals produced by backend rules
- may be marked as early settlement when applicable

## Loan-Type-Specific Data Contracts

### Fixed Installments Loan Contract
Required at creation:
- `principalAmount`
- `installmentAmount`
- `totalInstallments`
- `paymentFrequency`
- `startDate`

Derived by backend:
- installments
- planned interest rows
- `expectedEndDate`

### Monthly Interest Loan Contract
Required at creation:
- `principalAmount`
- `monthlyInterestRate`
- `paymentFrequency = MONTHLY`
- `startDate`

Optional but meaningful:
- `earlySettlementInterestMode`

Derived by backend:
- monthly interest periods
- operational penalties
- payoff preview

## Persisted Status vs Operational State
Persisted loan status is not the same as every operational label shown in the UI.

Persisted examples:
- `ACTIVE`
- `PAID`
- `CANCELLED`

Operational labels may include:
- due today
- overdue
- current

Contract rule:
- operational read models may derive labels without changing persisted status unless a real state transition is required.

## API Contract Expectations

### Read endpoints
Operational reads must return explicitly labeled financial concepts.
The UI must be able to distinguish:
- pending principal
- pending interest
- pending penalty
- total collectible or payoff amount

### Create-loan endpoints
The backend owns validation and derived schedule generation.
The frontend sends the declared inputs and displays the backend result.

### Payment endpoints
The backend owns distribution and closure logic.
The frontend must not attempt to simulate settlement locally.

### Payoff preview endpoint
The payoff preview contract is authoritative for settlement amounts.
It exists so the frontend does not calculate settlement totals on its own.

## Historical-Date Contract
The system distinguishes:
- a historical read
- a backdated business event

Contract rule:
- a historical read is a query contract
- a backdated payment is a write contract

Those two operations must not be treated as equivalent.

## Frontend Contract Rules
1. Never display an unlabeled single number that mixes principal, interest, and penalty.
2. Always call explicit backend endpoints for debt breakdown, payment simulation, and payoff preview.
3. Treat backend monetary results as authoritative.
4. Keep lender scope explicit until auth replaces the URL-driven lender context.

## Short Version
This document answers:
- what data exists?
- what does each field mean?
- what does the API promise to the UI?
