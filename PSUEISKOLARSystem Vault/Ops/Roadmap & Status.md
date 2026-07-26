---
tags: [ops, status]
---
# Roadmap & Status

Source of truth: **`psueiskolarsystem.client/src/assets/tobeaddedfunctionsandfixes.md`** (checked off as items ship). Related: [[Home]] · [[Deployment & Ops]]

## Snapshot
- **54 items done** and checked off.
- Whole sections complete: **Performance, Security, Validation, Code Quality**, plus most of Auth, User Management, Dashboard, Notifications, Settings, Reports.

## Highlights delivered
- **Security:** lockout, rate limiting, failed-login audit, magic-byte upload validation, HSTS, staff-scoped `AnalyticsChanged`, enumeration throttle.
- **Performance (all 4):** server-side Users pagination, analytics pushed to SQL, deadline-report N+1 batching, SQL-aggregated message threads.
- **UX:** `alert/confirm` → toasts/`ConfirmDialog`, inline modal validation, loading skeletons + empty states, dark-mode fixes (incl. theme-aware stat tiles), responsive padding/headers, route transitions.
- **Features:** global search, recent-activity feed, scholar next-action nudge, bulk requirement→type assignment, archive/restore flow, resend verification, live email check, admin password reset, config inactivity timeout, privacy-notice versioning, activity-log export, Help/FAQ page, **spotlight guided tour**, new-scholar onboarding gate, favicon, logout confirm.

## ⚠️ Campus removal — partially done
"Remove other campuses (single Lingayen campus)" — **client-side is fully removed** (all pickers/filters/columns/dropdowns gone, everything defaults to Lingayen). **Backend not yet dropped** (`Campus` entity, `CampusId` column, `CampusController`, seeding) — needs a **migration**, which is blocked while the app is running. This also moots "coordinator multi-campus" and "cross-campus comparison".

## Remaining (all currently blocked)
Every open item needs the app **stopped** (migration / `dotnet test` / server verify) or a **package restore**:

**Needs a migration:** avatar upload · scholarship renewal workflow · slots/quota · requirement display-order · category muting · SMTP UI config · announcement scheduling · one-click DB backup · (campus backend drop).

**Needs a package + restore:** PDF export · web-push · API versioning.

**Server refactor (verify-blocked):** remember-me / refresh tokens · response DTOs (replace anonymous objects).

**Moot under single campus:** coordinator multi-campus · cross-campus comparison.

## To unblock
Stop the running server (it locks `Server/bin`), then: `dotnet build` + `dotnet test` (8 tests), run migrations, restart. See [[Deployment & Ops]] and [[Conventions & Patterns]].
