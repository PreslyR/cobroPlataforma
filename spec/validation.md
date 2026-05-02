# Validation

## Purpose
This document defines the validation expectations for business behavior.
It does not replace automated tests.
It defines what must remain covered and what should be checked before considering a change safe.

## Validation Principles
1. A business change is not complete if it changes behavior without tests.
2. Manual DB checks are useful, but they do not replace regression coverage.
3. Domain-critical transitions must have explicit test cases.
4. A historical example in the database is evidence of past behavior, not proof that the current code still enforces it.
5. Auth and lender scoping changes are contract changes, not just UI changes.

## Validation Layers

### 1. Unit and service tests
Primary layer for business validation.
Use these for:
- payment distribution
- settlement behavior
- penalty generation
- interest schedule behavior
- loan closure criteria
- auth token resolution and internal user mapping rules when business access depends on them

### 2. Integration checks
Use these for:
- controller to service flow
- Prisma persistence behavior
- end-to-end write paths that depend on DB semantics
- auth guard enforcement on protected endpoints
- lender scoping through authenticated user context

### 3. Manual operational validation
Use this only as a complement.
Examples:
- verify a known loan in the DB after a payment
- compare dashboard output with expected totals
- confirm a historical scenario still behaves correctly
- confirm operational pages work without `lenderId` in the URL when a valid session exists

Manual validation is valuable, but it is weaker than codified regression coverage.

## Minimum Regression Matrix
These scenarios should remain covered by tests.

### Fixed installments
1. partial payment keeps loan active
2. exact payment closes the loan
3. weekly loan behavior
4. biweekly loan behavior
5. monthly loan behavior
6. overdue installment with penalty
7. payment ordering penalty -> interest -> principal
8. repair path that reopens an incorrectly closed fixed-installment loan when balance is still positive

### Monthly interest
1. regular partial payment keeps loan active
2. regular payment that clears pending interest and principal closes the loan
3. early settlement in `FULL_MONTH`
4. early settlement in `PRORATED_BY_DAYS`
5. early settlement with pending penalty
6. insufficient early settlement is rejected
7. closure logic uses the updated effective balance, not stale pre-payment values

### Historical behavior
1. historical reads do not desmaterialize current penalty state
2. backdated payments do recalculate business state

### Reporting and read composition
1. read models do not silently own write-side transitions
2. debt breakdown and payoff preview remain authoritative for the UI

### Auth and tenant scope
1. protected operational endpoints reject requests without bearer token
2. token verification rejects invalid issuer, audience, or expired token
3. authenticated request resolves the internal admin user and lender scope from the token email mapping
4. a valid Supabase session without internal admin mapping is rejected for operational access
5. web operational navigation works without `lenderId` in the URL when auth session exists
6. protected web routes invalidate the session after `30` minutes of inactivity and redirect back to login

### Client intake
1. public Tally webhook accepts valid `FORM_RESPONSE` payloads and creates a staging submission
2. webhook signature validation rejects invalid signatures when signing secret is configured
3. intake normalization maps form labels into `fullName`, `documentNumber`, `email`, `phone`, and `address`
4. approving a pending submission creates exactly one `Client`
5. rejecting a pending submission does not create a `Client`
6. duplicate conflicts are surfaced before approval writes to `clients`

## Critical Business Assertions
The following assertions are important enough that they should always have direct coverage.

1. `currentPrincipal` reaching zero is not by itself enough unless the applicable collectible balance is also zero.
2. A loan that is fully settled must not remain `ACTIVE` due to stale closure inputs.
3. Penalty, interest, and principal must never collapse into one unlabeled business value.
4. Early settlement must fail atomically if the amount is insufficient.
5. Historical reads must not mutate current operational state.
6. Tenant scope must come from authenticated identity, not from an arbitrary URL parameter.
7. Public client-intake capture must not bypass the internal approval boundary.

## Change Checklist
Before considering a business change done, verify:

1. The contract impact is documented in `spec/contracts.md` if data semantics changed.
2. The business rule impact is documented in `spec/domain.md` if behavior changed.
3. Regression coverage exists for the changed rule.
4. Existing tests still pass.
5. At least one representative operational path was validated manually when the change affects persistence, auth, or reporting.

## When Manual Validation Is Not Enough
Manual validation alone is not enough when:
- the rule affects closure state
- the rule affects payment distribution
- the rule affects penalty generation
- the rule affects settlement totals
- the rule affects historical-date behavior
- the rule affects auth, tenant scoping, or protected-route access

In those cases, automated regression tests are required.

## Short Version
This document answers:
- what must be tested?
- what kind of validation is strong enough?
- when is a business change actually safe?
