---
tags: [reference]
---
# API Reference

Controllers in `PSUEISKOLARSystem.Server/Controllers/`. All under `/api`. Related: [[Backend Architecture]] · [[User Roles & Permissions]]

> Convention note: most endpoints currently return **anonymous objects** rather than response DTOs (a tracked cleanup — see [[Roadmap & Status]]).

## Auth — `/api/auth`
`login`, `login-2fa`, `register-scholar`, `register` (admin), `me`, `forgot-password`, `reset-password`, `resend-verification`, `email-available`, `verify-email`, `accept-consent`, 2FA enable/disable, notification preferences. Rate-limited on the sensitive ones.

## Users — `/api/users` (admin)
Paged/filtered list (`role`, `search`, `isActive`, page/pageSize — server-side), get, update (incl. **email/login**), set status (archive/restore), delete, **send-password-reset**, `archive-inactive`.

## Scholars — `/api/scholars`
List (search + program/type/status filters, paged), detail, upsert profile, grades (`GET`/`POST {id}/grades`), lifecycle status, export data (own — Data Privacy).

## Documents & requirements
- `/api/documents` — submissions: upload, preview, download, review (+ batch), history.
- `/api/document-requirements` — CRUD, sample image, **`{id}/scholarship-types`** (get/set — bulk assign).
- `/api/deadlines` — CRUD + **`report`**.
- `/api/scholarship-types`, `/api/lookups` (programs/types), `/api/active-semester`.

## Engagement
- `/api/announcements` — CRUD + image.
- `/api/notifications` — list, unread-count, mark read/**unread**/read-all, **delete**.
- `/api/messages` — threads (SQL-aggregated), thread, send, unread-count.
- `/api/search` — global search (staff).

## Insight / ops
- `/api/analytics/overview` (campus~~ removed~~, period filter).
- `/api/reports` — scholars.xlsx, submissions.xlsx.
- `/api/audit-log` — list (admin), `recent` (staff), **export.xlsx**, actions.
- `/api/admin` — seed sample data.
- `/hubs/notifications` — SignalR.
