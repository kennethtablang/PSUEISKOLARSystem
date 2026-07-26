---
tags: [ops]
---
# Deployment & Ops

Full guide lives in the repo at **`DEPLOYMENT.md`**; CI at `.github/workflows/ci.yml`. Related: [[Tech Stack]] · [[Backend Architecture]]

## Build & publish
1. Client: `cd psueiskolarsystem.client && npm ci && npm run build` (→ `dist/`).
2. Server: `cd PSUEISKOLARSystem.Server && dotnet publish -c Release -o ./publish` (bundles the built client as static assets).

## Config (production via env vars / `appsettings.Production.json`, never commit secrets)
`ConnectionStrings__DefaultConnection`, `JwtSettings__Key` (strong secret), `EmailSettings__*`, `EmailSettings__AppBaseUrl`, `FileStorage__BasePath`, `ASPNETCORE_ENVIRONMENT=Production`.

## Database
- Migrations apply **automatically on startup** (`db.Database.MigrateAsync()`); or `dotnet ef database update`.
- `DbSeeder` seeds roles + initial admin; `SampleDataSeeder` for demo data (admin-triggered).

## Runtime security (already enabled)
HSTS + HTTPS redirect (prod), rate limiting on auth endpoints, account lockout. Ensure the reverse proxy forwards `X-Forwarded-For`/`Proto` (accurate client IPs for rate limiter + audit).

## Backup (NFR-2.3 / 5.5 / 6.2)
- **Database:** SQL Server `BACKUP DATABASE` nightly full + log backups, ≥30 days off-site.
- **Files:** archive `FileStorage:BasePath` (COR/ID docs, announcement/sample images) daily. Keep DB + file backups **date-consistent**.

## CI
GitHub Actions builds the client, builds the server, runs the test suite on push/PR. Add a deploy job when a target environment exists.

## ⚠️ Local gotcha
A running server **locks `Server/bin`**, which breaks `dotnet build` / `dotnet test` / `dotnet ef migrations`. Stop the app (and Visual Studio's debugger) first.
