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
6. In the current auth contract, lender scope is resolved from the authenticated internal user, not from a URL query parameter.

## Auth Contract

### Backend auth boundary
Current operational endpoints are protected.
The backend expects:
- `Authorization: Bearer <access_token>`
- a valid Supabase access token
- an internal active `User` mapped by email
- `User.role = ADMIN`
- an active lender linked to that internal user

If any of those conditions fail, the request must not proceed as an authenticated operational request.

### `/api/auth/me`
Current purpose:
- confirm that the Supabase session is valid for this app
- resolve the internal admin user
- resolve the active lender context

The response contract returns:
- authenticated internal user summary
- resolved lender summary

### Frontend auth boundary
The web app currently assumes:
- Supabase session in browser/server context
- server-side reads send the bearer token to the backend
- browser-side writes send the bearer token to the backend
- route access is guarded before rendering operational pages
- protected operational routes must invalidate the web session after `30` minutes without user activity
- when inactivity timeout is reached, the user must authenticate again before continuing

### Scope rule
Operational frontend routes must not depend on `lenderId` in the URL to decide tenant scope.
`lenderId` may still appear in backend payloads and read models as data, but it is no longer the primary input contract for navigation or authorization.

## Core Entities

### Lender
Represents the business owner or operator context.

Relevant contract expectations:
- all operational data is scoped to one lender
- dashboard, portfolio, clients, loans, payments, and reports must not leak across lenders

### User
Represents an internal user.

Current role in the repo:
- internal auth boundary for the lender-side product
- currently expected to map to a Supabase auth account by email
- only active internal admin users can operate the current product

### Client
Represents a borrower.

Contract expectations:
- belongs to one lender
- can have multiple loans
- can appear in client portfolio and operational debt views
- may be created from an approved client-intake submission
- keeps optional contact data such as `email`, `phone`, and `address`

### Client Intake Submission
Represents a captured client record before it is approved into `clients`.

Contract expectations:
- belongs to one lender
- is not an operational borrower yet
- stores normalized client data plus raw webhook payload
- moves through `PENDING`, `APPROVED`, or `REJECTED`
- must not create or mutate `clients` until an internal admin approves it
- may carry duplicate flags to support safe review

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

### Client intake endpoints
Current intake flow is designed for external form capture and internal approval.

#### `POST /api/client-intake/tally/:lenderId`
Purpose:
- receive a public Tally webhook for one lender
- normalize captured client data
- persist a staging record in `client_intake_submissions`

Contract expectations:
- endpoint is public by design
- lender is chosen by path parameter, not bearer token
- if `TALLY_WEBHOOK_SIGNING_SECRET` is configured, the request must contain a valid `Tally-Signature` header
- successful processing must return `2xx` quickly so Tally does not retry
- payload must not create a real `Client` directly

#### `GET /api/client-intake/submissions`
Purpose:
- list pending or historical intake submissions for the authenticated lender

Contract expectations:
- tenant scope comes from authenticated admin user
- optional status filter may be applied

#### `POST /api/client-intake/submissions/:id/approve`
Purpose:
- approve one pending intake submission
- create the real `Client`
- link the submission to the created client

Contract expectations:
- only `PENDING` submissions can be approved
- duplicate conflicts against existing clients must be rejected explicitly

#### `POST /api/client-intake/submissions/:id/reject`
Purpose:
- mark one pending intake submission as rejected without creating a client

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
4. The web app must use the authenticated session as the primary tenant input.
5. The UI must not require `lenderId` in the URL for normal navigation.

## Short Version
This document answers:
- what data exists?
- what does each field mean?
- what does the API promise to the UI?
