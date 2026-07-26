---
tags: [architecture, reference]
---
# Tech Stack

Related: [[Backend Architecture]] · [[Frontend Architecture]] · [[Deployment & Ops]]

## Solution layout (`PSUEISKOLARSystem.slnx`)
- `PSUEISKOLARSystem.Server/` — ASP.NET Core API (also serves the built SPA).
- `psueiskolarsystem.client/` — React (Vite) SPA (`.esproj`).
- `PSUEISKOLARSystem.Server.Tests/` — xUnit tests (EF InMemory).

## Backend
| Concern | Choice |
|---|---|
| Runtime | **.NET `net10.0`**, ASP.NET Core |
| ORM / DB | **EF Core** + **SQL Server** (`ConnectionStrings:DefaultConnection`) |
| Auth | ASP.NET **Identity** + **JWT bearer**; lockout & rate limiting |
| Realtime | **SignalR** (`Hubs/NotificationHub.cs`) |
| Email | **MailKit / MimeKit** (SMTP) — `Services/EmailService.cs` |
| Excel export | **ClosedXML** — `Reports`, `AuditLog` controllers |
| Mapping | **AutoMapper** (`Mappings/`) |
| Migrations | Applied on startup via `db.Database.MigrateAsync()` |

## Frontend
| Concern | Choice |
|---|---|
| Framework | **React** + **Vite** |
| Routing | **react-router-dom** |
| Styling | **Tailwind CSS v4** (`@import "tailwindcss"`) + CSS variables for theming |
| Charts | **recharts** |
| Icons | **lucide-react** |
| Realtime client | **@microsoft/signalr** |
| State | React Context (see [[Frontend Architecture#Contexts]]) |

## Hosting model
Dev uses **SpaProxy** (`npm run dev` at `https://localhost:56806`). In production the server serves the built client via `UseDefaultFiles` + `MapStaticAssets` + `MapFallbackToFile("/index.html")`. See [[Deployment & Ops]].

## Config keys (`appsettings.json`)
`ConnectionStrings:DefaultConnection`, `JwtSettings:{Key,Issuer,Audience}`, `EmailSettings:{SmtpHost,SmtpPort,Username,Password,From,FromName,AppBaseUrl}`, `FileStorage:BasePath`.
