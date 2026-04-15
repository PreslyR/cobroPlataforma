# Spec

## Purpose
This folder is the product and business specification package for the repo.
It exists to support a spec-driven development workflow.

The spec is the deterministic input that should guide changes in:
- contracts
- business behavior
- validation coverage

This folder does not replace the code.
It defines what the code is expected to implement.

## Structure
The spec is intentionally split into three parts.

1. `contracts.md`
- data shapes
- field semantics
- API-level expectations
- invariants that belong to the contract of the system

2. `domain.md`
- business rules
- financial behavior
- operational semantics
- rules for loan lifecycle, payments, penalties, and settlement

3. `validation.md`
- regression matrix
- critical scenarios that must stay covered
- validation expectations before considering a business change safe

## Source Of Truth Order
For product and business behavior, use this order:

1. implemented backend code in `src/`
2. regression tests in `*.spec.ts`
3. `spec/domain.md`
4. `spec/contracts.md`
5. `spec/validation.md`
6. other docs and examples

If the spec and the code disagree, do not hand-wave it.
Resolve the mismatch explicitly by updating either the code or the spec.

## Relationship To Other Docs
- `AGENTS.md`: product priorities, UX rules, operator focus
- `ARCHITECTURE.md`: technical structure, ownership, and module boundaries
- `spec/`: contracts, domain rules, and validation expectations

## Change Discipline
A business change is not complete if it changes behavior without updating the spec.

A safe change should keep these three artifacts aligned:
1. contract
2. domain rule
3. validation coverage

## Short Version
Use this folder when the question is:
- what data shape does the system promise?
- what business rule should the backend enforce?
- what scenarios must remain tested?
