---
tags: [architecture]
---
# Backend Architecture

`PSUEISKOLARSystem.Server/` — layered ASP.NET Core Web API. Related: [[Tech Stack]] · [[Data Model]] · [[API Reference]] · [[Conventions & Patterns]]

## Layers / folders
- **`Controllers/`** — HTTP endpoints (see [[API Reference]]).
- **`Services/`** — business logic & integrations (see below).
- **`Models/`** — EF entities (see [[Data Model]]).
- **`DTOs/`** — request/response shapes (auth, users, scholars).
- **`Data/`** — `ApplicationDbContext`, `DbSeeder`, `SampleDataSeeder`.
- **`Mappings/`** — AutoMapper profiles.
- **`Hubs/`** — `NotificationHub` (SignalR).
- **`Interfaces/`**, **`Settings/`**, **`Exceptions/`**, **`Migrations/`**.

## Services
| Service | Responsibility |
|---|---|
| `AuthService` | Login, register, 2FA, email verification + resend, forgot/reset password, lockout, email-availability |
| `EmailService` | SMTP via MailKit; **central `SendMessageAsync` with 3× retry + logging** |
| `NotificationService` | Persists [[Announcements & Notifications|notifications]] + pushes via SignalR; `BroadcastAsync` → **staff group** |
| `DeadlineHelper` | Resolves *applicable scholars* per requirement; **batched** variant avoids N+1 |
| `DeadlineReminderService` | Background service emitting deadline reminders |
| `LocalFileStorageService` | Saves uploads with size + extension + **magic-byte signature** validation |
| `ImageFileTypes` | Shared image extension/content-type helper (announcement & requirement images) |

## Cross-cutting concerns (`Program.cs`)
- **Identity + JWT**: password policy (8+, upper/lower/digit/nonalnum), **lockout** (5 fails → 15-min), unique email.
- **Rate limiting**: `auth` policy (10/min/IP) on login, login-2fa, forgot-password; `emailcheck` (20/min) on the email-availability probe.
- **HSTS** in production; HTTPS redirect.
- **Audit logging**: `db.Audit(...)` / `AuditLog` rows for sensitive actions incl. **failed logins**.
- Migrations + seeding run on startup.

## Realtime
`NotificationHub` (`[Authorize]`). Staff join a **`staff` group** on connect. `NotificationService.BroadcastAsync("AnalyticsChanged")` targets that group; per-user pushes use `Clients.User(id)`.

## Background email caveat
Fire-and-forget emails (announcements/messages) resolve a **fresh `IEmailService` from a new DI scope** (`IServiceScopeFactory`) so the request-scoped service isn't used after the response returns.
