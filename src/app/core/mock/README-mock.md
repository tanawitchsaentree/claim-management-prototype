# Mock Data Layer

Observable-based mock services that mirror the real API contract. Swap to real `HttpClient` calls in one place without changing any component.

## Directory structure

```
src/app/core/mock/
  data/
    claims.json       — 21 claim records (all statuses, all LOBs, edge cases)
    tasks.json        — 31 task records
    users.json        — 11 user records
    policies.json     — 11 policy records
    fnol.json         — 5 FNOL records
    lookups.json      — dropdown options for all fields
  services/
    mock-base.service.ts    — delay, error simulation, list/findById helpers
    mock-claim.service.ts   — Claims CRUD + filtering
    mock-task.service.ts    — Tasks CRUD + getByClaimId
    mock-fnol.service.ts    — FNOL submit + convertToClaim
    mock-lookup.service.ts  — all lookup lists
    index.ts
  mock-config.ts      — scenario definitions + ACTIVE_SCENARIO
  validation-rules.ts — field rules + validateFnol / validateClaim
  index.ts
```

## Switching scenarios

Edit `mock-config.ts` — change the key passed to `MOCK_SCENARIOS`:

```typescript
// src/app/core/mock/mock-config.ts
export const ACTIVE_SCENARIO = MOCK_SCENARIOS['slow'];      // 3 s delay
export const ACTIVE_SCENARIO = MOCK_SCENARIOS['flaky'];     // 30% network errors
export const ACTIVE_SCENARIO = MOCK_SCENARIOS['serverDown'];// always 500
export const ACTIVE_SCENARIO = MOCK_SCENARIOS['empty'];     // empty lists
export const ACTIVE_SCENARIO = MOCK_SCENARIOS['partial'];   // half the data
```

## Adding a new entity

1. Add JSON file to `data/`
2. Add model interface in `src/app/core/models/`
3. Create `mock-<entity>.service.ts` extending `MockBaseService`
4. Export from `services/index.ts` and `mock/index.ts`

## Swapping to real backend

Replace each service class body — keep the same method signatures so components require zero changes:

```typescript
// Before (mock)
getAll(): Observable<Claim[]> {
  return this.list(this.claims);
}

// After (real)
getAll(): Observable<Claim[]> {
  return this.http.get<Claim[]>('/api/claims');
}
```

The `Injectable({ providedIn: 'root' })` decorator stays the same — Angular DI handles the swap transparently.

## Edge-case scenarios in data

Each JSON record with a `_scenario` tag covers a specific UI/UX boundary:

| Tag | File | What it tests |
|-----|------|---------------|
| `long-description` | claims.json | Text truncation in table cells |
| `boundary-max-amount` | claims.json | Large number formatting (999,999,999) |
| `boundary-zero-amount` | claims.json / fnol.json | Zero amount display |
| `partial-data-no-broker` | claims.json | Missing optional field graceful render |
| `partial-data-no-location` | claims.json | Missing location block |
| `date-edge-5-years-old` | claims.json | Old date display |
| `date-edge-today` | claims.json / fnol.json | Today's date (2026-05-07) |
| `special-chars-client-name` | claims.json | UTF-8: Björn Ö'Brien & "Partners" |
| `empty-no-tasks` | claims.json | Claim with 0 tasks (empty state) |
| `long-title` | tasks.json | Long description ellipsis |
| `not-yet-converted` | fnol.json | FNOL without claimId |
| `no-attachments` | fnol.json | Empty attachments array |
