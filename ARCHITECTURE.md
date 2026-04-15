# Architecture

## Purpose
This repo is a mobile-first loan management system for a lender.
The backend is the source of truth for all financial logic.
The frontend presents operational views and never calculates debt locally.

## Documentation Boundaries
Architecture is not the same thing as business specification.
This repo now treats them as separate sources.

Use:
- `ARCHITECTURE.md` for technical structure, module ownership, and dependency rules
- `spec/contracts.md` for data semantics and API expectations
- `spec/domain.md` for business rules
- `spec/validation.md` for regression expectations

This separation is intentional.
It prevents one large document from mixing technical boundaries, business behavior, and testing policy.
## Current Architecture Style
The project currently follows a modular monolith architecture:

- Backend: NestJS + Prisma + PostgreSQL (now prepared for Supabase Postgres)
- Frontend: Next.js app under `web/`
- Deployment shape: separate frontend and backend services, same codebase/repo

This is not a hexagonal architecture, not DDD in the strict sense, and not a microservices system.
It is a pragmatic modular monolith with domain-oriented Nest modules and a shared Prisma data layer.

## Reality Check
The repo does have an architecture.
What it did not have was a short, explicit definition of module ownership and boundaries.

Current status:
- module boundaries exist by convention
- service responsibilities exist and are mostly consistent
- architectural rules were not enforced with tooling
- some modules still read directly from Prisma instead of going through dedicated query/repository layers

That is acceptable for the current stage of the product, but it must be explicit.

## High-Level System Layout

```text
Client (Web / mobile browser)
  -> Next.js frontend (`web/`)
  -> NestJS HTTP API (`src/`)
  -> Prisma ORM
  -> PostgreSQL / Supabase Postgres
```

## Repository Layout

```text
src/
  app.module.ts
  prisma/
  lender/
  users/
  clients/
  loans/
  payments/
  reports/
  dashboard/
  common/

web/
  src/app/
  src/features/
  src/shared/
```

## Backend Architecture

### Layering
The backend is organized in four practical layers.

1. Transport layer
- controllers
- DTO validation
- request parsing
- no business calculations

2. Application/domain orchestration layer
- module services such as `LoansService`, `PaymentsService`, `ReportsService`, `DashboardService`
- coordinates business workflows
- may call specialized calculation services
- may read/write through Prisma

3. Financial calculation layer
- `InterestCalculationService`
- `PenaltyCalculationService`
- `PaymentDistributionService`
- contains specialized financial behavior
- used by orchestration services

4. Infrastructure/data layer
- `PrismaService`
- PostgreSQL / Supabase Postgres

### Core Rule
Financial truth lives in the backend.

That means:
- no frontend debt calculations
- no duplicated payoff logic in UI
- no mixed capital/interest/penalty figures without labels

## Backend Modules And Ownership

### `prisma`
Owner of database connectivity.

Responsibilities:
- Prisma client lifecycle
- database connection and retry behavior

Must not contain business rules.

### `loans`
Owner of loan lifecycle and operational loan state.

Responsibilities:
- create/update/cancel loans
- loan detail and summary
- debt snapshot building
- due today / overdue / portfolio operational views
- operational read repairs currently needed by the model

This module is the main owner of:
- loan state
- current principal semantics
- operational debt picture

### `payments`
Owner of payment registration and payment distribution.

Responsibilities:
- register payments
- simulate payments
- distribute payment across penalty, interest, principal
- early settlement logic
- interest generation helpers
- penalty generation helpers

This module is the main owner of:
- payment events
- payment application rules
- settlement behavior

### `clients`
Owner of client-facing operational read models for the lender.

Responsibilities:
- client list
- client portfolio view
- client detail composition

This module is read-heavy.
It should not become the owner of financial state transitions.

### `reports`
Owner of reporting read models.

Responsibilities:
- interest income
- penalty income
- payments history
- closed loans report
- portfolio summary for reports

This module is read-only from a product perspective.
It composes historical and aggregate data.

### `dashboard`
Owner of the lender home view aggregation.

Responsibilities:
- today dashboard
- high-value operational aggregates
- home screen composition

This module is also read-heavy.
Its job is to compose fast operational answers, not to own loan rules.

### `users`
Owner of internal users.
Currently limited.

### `lender`
Owner of lender entity reads/writes.
Currently limited.

## Dependency Rules
These are the rules the repo should follow from now on.

### Allowed dependencies
- controllers -> own module service
- `dashboard` -> `loans`, `reports`, `prisma` when necessary for composition
- `reports` -> `loans` for operational snapshots and read composition
- `clients` -> `loans` for portfolio/debt composition
- `loans` -> `payments` calculation services when loan snapshots require operational financial derivation
- all backend modules -> `prisma`
- cross-cutting helpers -> `common`

### Not allowed
- controllers talking directly to Prisma
- frontend calling the database directly
- frontend reproducing debt logic locally
- `reports` owning write-side financial rules
- `clients` owning write-side financial rules
- random cross-module financial behavior outside `loans` and `payments`

## Important Clarification About Strictness
Current boundaries are not hard-enforced.
For example, multiple services still inject `PrismaService` directly.

That means the architecture is:
- real
- documented
- but enforced mostly by discipline, not by tooling

This is acceptable for the current stage.
It should simply be acknowledged.

## Why We Keep This Shape
This architecture fits the current product constraints:
- one business domain
- one main operator persona
- backend-centered financial logic
- mobile-first web frontend
- no need yet for distributed services

It optimizes for:
- speed of iteration
- clear module ownership
- low operational complexity
- one deployment unit per app side

## Financial Invariants
These rules are architectural, not just business detail.

1. Capital, interest, and penalty are separate concepts.
2. Payment is an event, not a blind subtraction from balance.
3. Loan closure must be derived from explicit closure criteria.
4. Payoff/settlement numbers come from backend logic only.
5. Historical queries must not silently corrupt current financial state.

## Read vs Write Responsibility
A useful way to understand the backend is this:

Write-oriented modules:
- `loans`
- `payments`

Read/composition modules:
- `dashboard`
- `reports`
- `clients`

Support modules:
- `prisma`
- `users`
- `lender`
- `common`

This distinction matters.
Read modules should avoid becoming hidden owners of business state.

## Frontend Architecture
The frontend under `web/` is organized by route plus feature.

### Route layer
- `web/src/app/...`
- owns route entrypoints, page composition, loading states

### Feature layer
- `web/src/features/...`
- owns feature-specific components and API helpers
- examples: dashboard, portfolio, clients, loan-detail, payments, reports, loans

### Shared layer
- `web/src/shared/...`
- app shell
- shared UI and utilities

### Frontend rules
- no financial calculations in UI
- use backend endpoints explicitly
- loading/error/empty/success states are part of the architecture
- mobile-first is mandatory

## Current Weaknesses
These are known and accepted for now.

1. No strict boundary tooling
- no dependency-cruiser
- no import rules by module
- no architecture tests

2. Direct Prisma usage is widespread
- faster to build
- less strict than a repository/query-service approach

3. Some operational reads still trigger repair logic
- pragmatic for now
- not a fully separated read model architecture

## What We Are Not Doing Right Now
- microservices
- event sourcing
- CQRS with separate read store
- strict repository-per-aggregate design
- frontend-side financial logic
- client portal first

## Evolution Path
When the product needs more rigor, the next architectural steps should be incremental.

1. Add module boundary tooling
2. Separate read composition services more explicitly
3. Reduce unnecessary write-on-read behavior where possible
4. Introduce auth as a first-class architectural boundary
5. Keep backend and database in the same region in production

## Definition Of Architectural Compliance
A change is aligned with this architecture if:
- it respects module ownership
- it keeps financial logic in backend services
- it does not move debt rules into the frontend
- it does not make read modules accidental owners of write logic
- it preserves the separation between capital, interest, and penalty

## Short Version
If someone asks "what architecture does this repo use?", the answer is:

- modular monolith
- NestJS backend with domain-oriented modules
- Prisma as shared ORM/data access layer
- Next.js frontend organized by route and feature
- backend-owned financial logic
- boundaries enforced mainly by convention, not yet by tooling

