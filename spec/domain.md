# Domain

## Purpose
This document defines the business rules currently implemented in the system.
It is not a product wishlist.
It is a description of the rules that the backend is expected to enforce today.

## Source Of Truth
For business behavior, use this priority order:

1. Implemented backend code in `src/`
2. Regression tests in `*.spec.ts`
3. This document
4. Other docs and examples

If this document disagrees with backend code or tests, the mismatch must be resolved explicitly.
Do not assume the document is automatically correct.

## Product Scope Covered By These Rules
Current operational scope:
- lender-facing operation
- loan creation
- payment registration
- portfolio and dashboard reads
- reports
- client operational views

Not prioritized right now:
- client portal
- advanced background automation
- deep refinement of `DAILY_INTEREST`

## Core Financial Invariants
These rules apply everywhere.

1. Capital, interest, and penalty are separate concepts.
2. Interest is not capitalized automatically.
3. Penalty is not capitalized automatically.
4. Payments are registered as events and then distributed by backend rules.
5. Frontend does not calculate debt.
6. All payoff and settlement numbers come from backend logic.

## Multi-Tenancy Rule
Each lender owns an isolated business space.
Data must remain scoped by `lenderId`.

## Active Loan Types
The system currently works with:

1. `FIXED_INSTALLMENTS`
2. `MONTHLY_INTEREST`

`DAILY_INTEREST` exists in the model, but is not the current priority.

## Loan Statuses
The key statuses are:
- `ACTIVE`
- `PAID`
- `CANCELLED`

Operational read models may also show states such as:
- due today
- overdue
- current

Those are operational views, not necessarily the persisted loan status.

## Current Principal Semantics
`currentPrincipal` means capital pending.
It is not:
- total debt
- capital + interest
- capital + penalty

### For `FIXED_INSTALLMENTS`
`currentPrincipal` represents real principal pending.
The contractual balance of the plan is derived from:
- installments
- planned interest rows
- applied payments

### For `MONTHLY_INTEREST`
`currentPrincipal` is the current capital pending of the loan.
Monthly interest is generated separately in `loan_interests`.

## Payment Distribution Order
Regular payments are applied in this strict order:

1. pending penalty
2. pending interest
3. principal

This order is one of the core business rules of the system.

## Regular Payment Rules

### Common rules
1. Future payment dates are not allowed.
2. Inactive loans do not accept regular payments.
3. If a payment does not apply to anything and the loan is already effectively closed, the payment must be rejected.

### Exception for fixed installments
If a fixed-installment loan is marked `PAID` but still has positive outstanding balance according to installments/payments, the system may reopen it to `ACTIVE` during payment processing.
This is a repair path, not a normal business flow.

## Fixed Installments Rules

### Creation
A `FIXED_INSTALLMENTS` loan requires:
- `installmentAmount`
- `totalInstallments`
- `paymentFrequency`

`expectedEndDate` is derived in backend from:
- `startDate`
- `paymentFrequency`
- `totalInstallments`

### Supported frequencies currently used operationally
- `WEEKLY`
- `BIWEEKLY`
- `MONTHLY`

### Installments
1. Installments are generated at loan creation.
2. Planned interest rows for the plan are generated separately.
3. Installment status moves through `PENDING`, `LATE`, `PAID`.

### Fixed-installment interest model
1. Planned interest is distributed across installment periods.
2. Interest rows are separate from capital.
3. The last planned interest row absorbs any residual rounding difference.

### Fixed-installment payment behavior
1. Penalty is generated incrementally for overdue installments.
2. Payment first covers penalty.
3. Then the system distributes the remaining amount between pending planned interest and principal according to outstanding installment structure.
4. After successful payment processing, covered installments are marked `PAID`.

### Fixed-installment closure rule
A fixed-installment loan is considered paid when the outstanding operational balance reaches zero.
That includes the relevant pending plan components that are still collectible.

## Monthly Interest Rules

### Creation
A `MONTHLY_INTEREST` loan requires:
- `principalAmount`
- `monthlyInterestRate`
- `paymentFrequency = MONTHLY`

### Interest schedule
1. Monthly-interest loans generate monthly interest periods.
2. Interest periods are created up to the date being processed when needed.
3. Interest amount is calculated from principal at the start of each period.
4. Interest remains a separate record in `loan_interests`.

### Monthly interest payment behavior
For a regular payment:
1. generate missing monthly interest periods up to the payment date if needed
2. generate incremental penalties for overdue monthly-interest periods if needed
3. apply payment to pending penalty
4. apply payment to pending interest
5. apply remaining amount to principal

### Monthly-interest closure rule
A monthly-interest loan must become `PAID` when the effective closing balance reaches zero after payment distribution.
This includes both:
- regular payment that clears pending interest and principal
- early settlement that clears penalty, relevant interest, and principal

## Penalty Rules
Penalty is tracked in `loan_penalties`.
Penalty rows are separate from both capital and interest.

### Fixed-installment penalty
Rules currently implemented:
1. penalty base: overdue installment amount
2. monthly rate: `20%`
3. late days: calendar day difference
4. rounding: ceil to the next `1000`
5. generation is incremental and idempotent by covered period

### Monthly-interest penalty
Rules currently implemented:
1. penalty base: `interestAmount` of an overdue monthly-interest period
2. monthly rate: `20%`
3. trigger: interest period passed its `periodEndDate` and still has pending interest
4. generation is incremental by uncovered late days/periods

### Penalty payment rule
Pending penalty is paid FIFO by oldest calculated rows first.

## Interest Payment Rule
Pending interest is paid FIFO.
This applies both to normal interest payment and to payoff/settlement flows.

## Early Settlement Rules
Early settlement is supported only for `MONTHLY_INTEREST`.

### Allowed modes
1. `FULL_MONTH`
2. `PRORATED_BY_DAYS`

### Settlement order
For early settlement, the system applies payment in this order:
1. pending penalty
2. overdue interest
3. current-period interest according to selected mode
4. principal

### Full month mode
In `FULL_MONTH`, the current period charges the full pending interest of the active period.

### Prorated mode
In `PRORATED_BY_DAYS`:
1. current-period interest is prorated by elapsed days in the current period
2. elapsed days are capped at 30
3. the prorated amount is rounded up to the nearest `10000`
4. the adjusted current-period interest cannot be lower than what has already been paid in that period
5. the current interest row is updated to reflect the adjusted amount and settlement cutoff date

### Early settlement sufficiency rule
If the provided payment amount is less than the required settlement amount, the operation must fail.
The backend must not partially execute an early settlement.

### Early settlement cleanup
When a monthly-interest loan is settled early:
1. future unpaid penalties beyond the settlement cutoff are deleted
2. future unpaid interest rows beyond the settlement cutoff are deleted

## Payoff Preview Rule
The UI must use backend payoff preview endpoints.
The frontend must not derive settlement totals locally.

## Historical Date Rules
The system distinguishes between:
- reading a historical date
- applying a payment with a historical date

### Historical read
Reading a past date must not silently destroy current operational state.
A historical query is allowed to produce a past operational picture, but it must not desmaterialize current penalty state just because the user navigated to an older date.

### Backdated payment
A payment registered with a past date is a real business event.
It is allowed to recalculate:
- penalty
- interest
- operational balance
- closure result

## Reporting Rules
Reports are read models.
They do not own business state transitions.
They reflect persisted financial events and derived summaries.

## Frontend Rules Derived From Business Logic
1. The UI must label capital, interest, penalty, and collectible totals separately.
2. The UI must not merge them into one unnamed figure.
3. The UI must call explicit backend endpoints for:
- debt breakdown
- payment simulation
- payoff preview

## Known Scope Notes
1. The current architecture still contains some repair-on-read behavior in backend services.
2. That is an implementation choice, not a change to financial invariants.
3. `DAILY_INTEREST` should not be treated as product-complete.

## Short Version
The business model of this repo is:
- backend-owned financial truth
- strict separation of capital, interest, and penalty
- payments distributed penalty -> interest -> principal
- fixed-installment and monthly-interest loans as the active core products
- early settlement supported only for monthly-interest loans
