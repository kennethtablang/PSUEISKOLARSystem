---
tags: [reference]
---
# Conventions & Patterns

House style for contributing. Related: [[Backend Architecture]] · [[Frontend Architecture]]

## Backend
- **Constants over magic strings:** roles, notification categories, announcement intents, privacy version live in `Models/Enums/` and are **mirrored** in the client `src/constants/`. Keep both sides in sync.
- **Audit sensitive actions** via `db.Audit(this, action, details)` / `AuditLog` rows.
- **Push counts to SQL** — avoid materializing whole tables then aggregating in memory (see `AnalyticsController`, deadline report batching).
- **Fresh scope for post-response work** — resolve services from `IServiceScopeFactory` when running after the HTTP response (fire-and-forget emails).
- **Shared helpers** — `ImageFileTypes` (image ext/content-type), `DeadlineHelper` (applicable scholars + batched variant).
- Failures visible: `EmailService` retries 3× and **logs**.

## Frontend
- **Toasts & confirms:** never `window.alert` / `window.confirm`. Use `useToast()` and `await useConfirm()(...)` from [[Frontend Architecture#Contexts|UIContext]]. Reuse `ConfirmDialog`.
- **Clay/neu utility classes** (see [[Frontend Architecture#Design system]]); theme via **CSS variables**, not hardcoded light hex. Prefer `var(--surface)`, `var(--text-strong)`, etc.
- **Inline field validation** in modals (email regex, password strength, GWA range) + disable submit while invalid.
- **List pages:** `TableSkeleton` while loading, `EmptyState` when empty, `overflow-x-auto` + `min-w` on tables, `Pagination` for server-paged data.
- **Shared inline styles** in `constants/ui.js` (`ctlStyle`), not per-page copies.
- **Responsive:** `p-4 sm:p-8` page padding; wrap headers; single-pane mobile where two panels exist.
- **Reduced motion** respected globally.

## Testing
- `PSUEISKOLARSystem.Server.Tests` (xUnit, **EF InMemory**) — `TestDb` helper seeds scholars/types/requirements. Note: InMemory validates logic, **not** SQL translation — smoke-test query-heavy endpoints against SQL Server.

## Build / verify
- Client: `npx vite build`. Server: `dotnet build` / `dotnet test`.
- ⚠️ If the app is **running**, it locks `Server/bin` — stop it before server builds, tests, or migrations.
