# PSU e-Iskolar — Deployment & Backup Guide

This guide covers building, configuring, deploying, and backing up the PSU e-Iskolar
system (NFR-2.3 / 5.5 / 6.2). The system is an **ASP.NET Core (net10.0)** API that also
serves the built **React (Vite)** single-page app as static files, backed by **SQL Server**.

---

## 1. Prerequisites

| Component | Version |
|-----------|---------|
| .NET SDK | 10.0+ |
| Node.js | 20 LTS+ (build only) |
| SQL Server | 2019+ (or Azure SQL) |
| SMTP account | for verification / reset / notification emails |

---

## 2. Configuration

Configuration lives in `PSUEISKOLARSystem.Server/appsettings.json`. **Do not commit real
secrets.** In production, override via environment variables or `appsettings.Production.json`
(never checked in). Environment variable names use `__` for nesting, e.g.
`ConnectionStrings__DefaultConnection`.

| Setting | Purpose |
|---------|---------|
| `ConnectionStrings:DefaultConnection` | SQL Server connection string |
| `JwtSettings:Key` | **Secret** signing key — generate a long random value (≥ 32 bytes) |
| `JwtSettings:Issuer` / `Audience` | JWT issuer/audience (your domain) |
| `EmailSettings:SmtpHost` / `SmtpPort` / `Username` / `Password` / `From` / `FromName` | SMTP delivery |
| `EmailSettings:AppBaseUrl` | Public base URL used in email links (e.g. `https://eiskolar.psu.edu.ph`) |
| `FileStorage:BasePath` | Absolute path for uploaded documents/images (default `./uploads`) |

Example (PowerShell, production host):

```powershell
setx ConnectionStrings__DefaultConnection "Server=DBHOST;Database=eIskolar;User Id=app;Password=...;TrustServerCertificate=True"
setx JwtSettings__Key "<64-char-random-secret>"
setx EmailSettings__Password "<smtp-password>"
setx ASPNETCORE_ENVIRONMENT "Production"
```

---

## 3. Build & publish

The client is built first; its `dist/` output is served by the API.

```bash
# 1. Build the React client
cd psueiskolarsystem.client
npm ci
npm run build            # outputs to dist/

# 2. Publish the server (bundles the built client as static assets)
cd ../PSUEISKOLARSystem.Server
dotnet publish -c Release -o ./publish
```

The `./publish` folder is self-contained; copy it to the host.

---

## 4. Database & migrations

Migrations are applied **automatically on startup** (`db.Database.MigrateAsync()` in
`Program.cs`), so a fresh deployment provisions its own schema. To apply migrations manually
(e.g. in a controlled release step):

```bash
cd PSUEISKOLARSystem.Server
dotnet ef database update
```

On first run the app also seeds default roles and an initial administrator (see `DbSeeder`).

---

## 5. Running in production

Run behind a reverse proxy (IIS, Nginx, or Azure App Service) terminating TLS:

```bash
cd publish
dotnet PSUEISKOLARSystem.Server.dll
```

Production security features already enabled in `Program.cs`:
- **HSTS** + HTTPS redirection (`app.UseHsts()` in non-Development).
- **Rate limiting** on `/api/auth/login`, `login-2fa`, `forgot-password`, and email checks.
- **Account lockout** (5 failed logins → 15-minute cooldown).

Confirm the reverse proxy forwards `X-Forwarded-For`/`Proto` so client IPs (used by the rate
limiter and audit log) are accurate.

---

## 6. Backup & restore

Two things must be backed up: **the database** and **the uploads folder**.

### Database (SQL Server)

```sql
-- Full backup
BACKUP DATABASE [eIskolar]
  TO DISK = N'D:\backups\eIskolar_YYYYMMDD.bak'
  WITH COMPRESSION, INIT;
```

Restore:

```sql
RESTORE DATABASE [eIskolar]
  FROM DISK = N'D:\backups\eIskolar_YYYYMMDD.bak'
  WITH REPLACE;
```

Schedule nightly full backups + transaction-log backups via SQL Server Agent (or
`az sql db` automated backups on Azure). Retain ≥ 30 days off-site.

### Uploaded files

Back up the `FileStorage:BasePath` directory (scholar COR/ID documents, announcement and
requirement-sample images). A daily archive is sufficient:

```powershell
Compress-Archive -Path "C:\eIskolar\uploads\*" -DestinationPath "D:\backups\uploads_$(Get-Date -Format yyyyMMdd).zip"
```

> Keep DB and file backups consistent: a document row in SQL references a file on disk, so
> restore both from the same date.

---

## 7. CI pipeline

A GitHub Actions workflow at `.github/workflows/ci.yml` builds the client, builds the
server, and runs the test suite on every push/PR. Extend it with a deploy job (publish +
copy to host / Azure) once a target environment exists.

---

## 8. Pre-go-live checklist

- [ ] `JwtSettings:Key` is a strong secret, unique per environment.
- [ ] `ASPNETCORE_ENVIRONMENT=Production` (enables HSTS, disables Swagger).
- [ ] SMTP credentials verified (send a test verification email).
- [ ] `EmailSettings:AppBaseUrl` points to the public URL.
- [ ] Database and uploads backups scheduled and test-restored once.
- [ ] TLS certificate installed on the reverse proxy.
- [ ] Firewall limits SQL Server to the app host only.
