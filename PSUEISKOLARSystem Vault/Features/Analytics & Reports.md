---
tags: [feature]
---
# Analytics & Reports

Backend: `AnalyticsController`, `ReportsController`, `AuditLogController`. Client: `AnalyticsPage`, `ActivityLogPage`, dashboard. Related: [[Documents & Compliance]] · [[Backend Architecture]]

## Analytics overview (`GET /api/analytics/overview`)
Returns, all aggregated **in SQL** (no full-table materialization):
- Total scholars; **compliant / non-compliant / no-GWA** (from each scholar's latest grade).
- Scholars **by program** and **by scholarship type**.
- Submission stats (total / verified / pending / incomplete) and **by academic period**.
- `availablePeriods` for the period filter.

**Filters:** academic period (`academicYear` + `semester`). *(Campus filter removed — single campus.)*

## Charts
`AnalyticsPage` uses **recharts** — compliance donut, program/type bars, submission trends. KPI **stat tiles** are theme-aware (`color-mix` for dark mode).

## Real-time
The page auto-refreshes on the `AnalyticsChanged` SignalR signal (staff group) plus a periodic fallback. Emitted after grade/submission/profile changes.

## Exports
- **Scholar roster** and **submissions** → Excel (`ReportsController`, ClosedXML).
- **Activity Log** → Excel, honoring current filters (`AuditLogController`).
- *(PDF export is a future item.)*

## Activity log
- `AuditLog` rows for sensitive actions (user CRUD, reviews, grades, logins incl. **failed**, config changes).
- Admin-only full log + export; staff get a **recent-activity feed** on the dashboard (`/api/audit-log/recent`).
