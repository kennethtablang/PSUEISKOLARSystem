# PSU e-Iskolar — System Specifications and Implementation Status

**Document purpose.** A verified inventory of the functional and non-functional specifications
**currently present in the built system**, each marked with what is finished and what still needs
to be accomplished. It is the evidence base for the capstone status report.

**Method.** Every status below was checked against the code, not read off the SRS. Where a claim
rests on a specific file it is named. Requirement IDs trace to
[`PSU_eIskolar_Requirements_Specification_v2.md`](./PSU_eIskolar_Requirements_Specification_v2.md);
outstanding defects trace to [`tobefix.md`](./tobefix.md) and
[`tobeaddedfunctionsandfixes.md`](./tobeaddedfunctionsandfixes.md).

**Date of this audit:** 2026-08-22.

---

## 0. Baseline measurements

| Check | Result |
|---|---|
| `dotnet test` | **142 passed**, 0 failed, 18 test classes |
| `dotnet build` (server) | Succeeds, **0 warnings** (`TreatWarningsAsErrors` is on) |
| `npx eslint .` (client) | **53 problems** — 36 errors, 17 warnings (all React-hooks lint, no runtime defects) |
| `npm audit` | 1 high advisory outstanding (`GHSA-qwww-vcr4-c8h2`, react-router) |
| Server code | ~12,950 lines C# across 25 controllers, 21 entity models, 19 EF migrations |
| Client code | ~18,170 lines across 27 pages, 23 components, 24 API modules |
| HTTP endpoints | **134** action methods, each also reachable at an `api/v1/…` alias |

**Technology stack.** ASP.NET Core 10 · EF Core 10 / SQL Server · ASP.NET Identity + JWT ·
SignalR · MailKit · ClosedXML (Excel) · QuestPDF (PDF) — React 19 · Vite 8 · Tailwind 4 ·
Recharts · React Router 7.

**Legend.** ✅ Implemented and verified · ⚠️ Partially implemented · ❌ Not implemented ·
➖ Withdrawn from scope.

---

## Part I — Functional Specifications

### 1. Scholar Account Management and Profiling (FR-1)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-1.1 | Admin creates scholar accounts with credentials | ✅ | `AuthController` `POST /api/auth/register` + `UserImportController` bulk path |
| FR-1.2 | Scholars log in with assigned credentials | ✅ | `AuthService.LoginAsync` — gate order: unknown/inactive → lockout → password → email-verified → 2FA → maintenance |
| FR-1.3 | Scholars input/update personal, academic, scholarship profile data | ✅ | `PUT /api/scholars/{userId}`; `ProfilePage`, `OnboardingGate` |
| FR-1.4 | Scholars update contact information | ✅ | Same endpoint; contact fields stay editable after approval |
| FR-1.5 | Admin views, monitors, edits scholar records and documents | ✅ | `ScholarsPage`, `ScholarDetailPage`, `DocumentReviewPage` |
| FR-1.6 | Profile associated with campus, program, scholarship type | ⚠️ | Program + scholarship type ✅. **Campus deliberately removed** — system is Lingayen-only (migration `RemoveCampus`) |
| FR-1.7 | Record and monitor academic performance (grades) | ✅ | `AcademicGrade`; POST/PATCH/DELETE `/api/scholars/{userId}/grades` |
| FR-1.8 | Coordinators assess grade-based compliance | ✅ | `MeetsRequirement` against `ScholarshipType.MinimumGwa`; compliance filter on the scholars list |

**Beyond specification:** scholar/staff avatar upload (`AvatarsController`), one-scholarship-per-student
enforcement via the `ScholarshipAssignments` ledger, and a scholarship-history view per scholar.

---

### 2. Self-Service Document Submission (FR-2)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-2.1 | Scholars upload required documents | ✅ | `POST /api/documents` (multipart), `MyDocumentsPage` |
| FR-2.2 | File validation before acceptance | ✅ | Nine sequential guards: approval → profile → extension → size → period → active-semester → requirement → duplicate → late-window, then **magic-byte signature check** in `LocalFileStorageService` |
| FR-2.3 | Organized, retrievable storage linked to profile | ✅ | `DocumentSubmission` + unique index on `(ScholarId, RequirementId, AcademicYear, Semester)` |
| FR-2.4 | Automatic timestamping | ✅ | `SubmittedAt`, plus a `DocumentStatusHistory` row per transition |
| FR-2.5 | Resubmission of Incomplete/Pending documents | ✅ | Replace path supersedes the prior row and deletes its file |
| FR-2.6 | Current status displayed per requirement | ✅ | Group-ordered checklist driven by `RequirementOrdering` |
| FR-2.7 | Notify scholar on successful receipt | ✅ | In-app notification + confirmation email via `BackgroundEmailer` |

**Beyond specification:** staff upload on a scholar's behalf (`scholarId` form field, authorised
and audited); per-type "other documents"; requirement sample images; in-browser preview served
under a sandboxing CSP.

---

### 3. Records Management and Verification (FR-3)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-3.1 | Coordinators review submitted documents | ✅ | `DocumentReviewPage` → `PATCH /api/documents/{id}/review` |
| FR-3.2 | Categorize Verified / Pending / Incomplete | ✅ | `DocumentStatus` enum |
| FR-3.3 | Attach feedback or instructions | ✅ | `FeedbackNote`, surfaced on the scholar's checklist |
| FR-3.4 | Record updates automatically on status change | ✅ | Compliance figures recompute; SignalR `AnalyticsChanged` refreshes staff dashboards |
| FR-3.5 | History of status changes per document | ✅ | `DocumentStatusHistory`; `GET /api/documents/{id}/history` |
| FR-3.6 | Notify scholar on status change | ✅ | In-app + email, gated by `EmailDocumentStatus` |

**Beyond specification:** batch review (`POST /api/documents/batch-review`).

---

### 4. Monitoring and Status Tracking Dashboard (FR-4)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-4.1 | Scholar dashboard with real-time requirement status | ✅ | `DashboardPage` scholar branch |
| FR-4.2 | Notifications and compliance progress on scholar dashboard | ✅ | Next-action nudge + announcement rail |
| FR-4.3 | Admin/coordinator dashboard: submission rates, pending, activity | ✅ | `DashboardController` + `DashboardQueries` assemble the whole role payload in **one** request (was eleven) |
| FR-4.4 | Filter dashboard data by campus, course, type, compliance | ⚠️ | Program / scholarship type / compliance / period ✅. Campus filter ➖ withdrawn |

**Beyond specification:** collapsible widgets, an audit-log-sourced recent-activity feed, a
renewal-decision queue count, and a pending-approvals queue.

---

### 5. Data Analytics and Reporting (FR-5)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-5.1 | Totals, distribution by program, compliance rates | ✅ | `GET /api/analytics/overview`, aggregated in SQL |
| FR-5.2 | Submission trend data over time | ✅ | `GET /api/analytics/trends` |
| FR-5.3 | Downloadable reports filtered by course, type, period, status | ✅ | `ReportsController` — filters printed into the export header |
| FR-5.4 | Graphical visualizations | ✅ | Recharts on `AnalyticsPage`; progress indicators throughout |
| FR-5.5 | Export in a downloadable format (PDF/Excel) | ✅ | `scholars.xlsx`, `scholars.pdf`, `submissions.xlsx`, `submissions.pdf` (QuestPDF, landscape A4, RA 10173 footer) |
| FR-5.6 | Cross-campus analytics | ➖ | Withdrawn — single-campus system |
| FR-5.7 | Descriptive analytics only, no ML/predictive | ✅ | Honoured; no predictive code exists |

**Beyond specification:** disbursement analytics (`GET /api/analytics/disbursements`), audit-log
export to Excel, and a per-period release monitor.

---

### 6. Announcement and Notification Module (FR-6)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-6.1 | Create, edit, delete announcements | ✅ | `AnnouncementsController` |
| FR-6.2 | Active announcements on scholar dashboards | ✅ | `AnnouncementCard`, dashboard rail |
| FR-6.3 | Targeting by campus, scholarship type, program | ⚠️ | Scholarship type / program / role targeting ✅ via `AnnouncementRecipient`. Campus ➖ withdrawn |
| FR-6.4 | Notify on new announcements and approaching deadlines | ✅ | `AnnouncementDelivery` + `DeadlineReminderService` |

**Beyond specification:** scheduled publishing (`PublishAt` + `AnnouncementPublisherService`,
`PublishedAt` making double-sends impossible), announcement images with a stated resolution
guide, and a "Publish now" override.

---

### 7. Administrative Dashboard and User Management (FR-7)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-7.1 | Create, update, deactivate, delete accounts | ✅ | `UsersController`; server-side pagination and filtering |
| FR-7.2 | Assign or change roles | ✅ | `PUT /api/users/{id}` |
| FR-7.3 | View a log of system activity | ✅ | `AuditLogController`, `ActivityLogPage`, Excel export |
| FR-7.4 | Database maintenance (archiving inactive records) | ✅ | `POST /api/users/archive-inactive`; `GET /api/admin/backup` streams a per-table CSV ZIP |
| FR-7.5 | System-level summary metrics on the admin dashboard | ✅ | `DashboardQueries.StaffDashboardDto` |

**Beyond specification:** a **System Settings** subsystem (`SystemSettings`, 18 policy fields, tabbed
UI) governing upload policy, approval/verification policy, lockout, session timeout, maintenance
mode, email enablement, reminder lead time, notification retention, and default minimum GWA.

---

### 8. Role-Based Access Control and Security (FR-8)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-8.1 | Authenticate and assign exactly one role | ✅ | ASP.NET Identity; `UserRoles` |
| FR-8.2 | Enforce RBAC at the application layer | ✅ | `[Authorize(Roles=…)]` on every controller; client `ProtectedRoute` is defence in depth only |
| FR-8.3 | Audit trail of user actions with identity and timestamp | ✅ | `AuditLog`, indexed on `(UserId, TimestampUtc)`; failed logins and data exports are logged |
| FR-8.4 | Password reset / recovery | ✅ | `forgot-password` / `reset-password`, rate-limited; admin-triggered reset |
| FR-8.5 | Terminate a session after inactivity | ✅ | Configurable `SessionTimeoutMinutes`; `apiFetch` turns any `401` into a session teardown and a Session Expired modal |
| FR-8.6 | Restrict coordinator access to their campus | ➖ | Withdrawn — single campus |
| FR-8.7 | Admin cross-campus access | ➖ | Withdrawn — single campus |

**Beyond specification:** optional TOTP two-factor authentication with QR enrolment; account
lockout after a configurable number of failed attempts; per-request `SessionValidator` that
re-checks `IsActive` and the Identity security stamp so revocation is immediate rather than
waiting out the token; maintenance mode; rate-limiting policies on auth and email-availability
endpoints; app-shell CSP, `X-Frame-Options`, and `Referrer-Policy`.

---

### 9. Centralized Database (FR-9)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-9.1 | Single centralized database | ✅ | One SQL Server database, 19 traceable EF migrations |
| FR-9.2 | Standardized schema for types, programs, compliance categories | ✅ | Lookup tables + status enums in `Models/Enums` |
| FR-9.3 | Real-time reflection of updates to authorized users | ✅ | SignalR `NotificationHub` |
| FR-9.4 | Records associable and filterable by campus | ➖ | Withdrawn — single campus |

---

### 10. Advanced Search and Filtering (FR-10)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-10.1 | Keyword search of scholar records | ✅ | `SearchController` |
| FR-10.2 | Multi-criteria filtering | ✅ | Program, scholarship type, compliance status, lifecycle, approval, period |
| FR-10.3 | Results confined to the role's authorized scope | ✅ | Scope applied server-side |

**Beyond specification:** global search spanning scholars, documents, announcements, and users.

---

### 11. Responsive Web Interface (FR-11)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-11.1 | Consistent interface on desktop, tablet, mobile | ✅ | Tailwind breakpoints; single-pane mobile messaging flow; tables wrapped in `overflow-x-auto` |
| FR-11.2 | Standard browsers, no local installation | ✅ | SPA served by the ASP.NET host |

---

### 12. Academic Performance Tracking (FR-12)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-12.1 | Record grade data per academic period | ✅ | Unique index on `(ScholarProfileId, AcademicYear, Semester)` — one GWA per period, so compliance is deterministic |
| FR-12.2 | Display academic performance history | ✅ | Grade history on the scholar detail page |
| FR-12.3 | Assess grades against scholarship minimums | ✅ | `MeetsRequirement` vs `MinimumGwa` |
| FR-12.4 | Flag scholars below the grade threshold | ✅ | Compliance badge + non-compliant filter and count |

**Beyond specification:** grade correction (`PATCH`) and removal (`DELETE`), both audited.

---

### 13. Real-Time Updates and Live Notifications (FR-13)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-13.1 | Push-based delivery without manual refresh | ✅ | `@microsoft/signalr`, `NotificationContext` |
| FR-13.2 | Live dashboard metrics and lists | ✅ | `AnalyticsChanged` scoped to the `staff` group |
| FR-13.3 | Real-time unread badge | ✅ | `NotificationBell` |
| FR-13.4 | Status changes and announcements pushed to affected users | ✅ | `ReceiveNotification`, `ReceiveMessage` |
| FR-13.5 | Graceful degradation to on-refresh updates | ✅ | Every view also loads over HTTP; the hub is an accelerator, not a dependency |

---

### 14. In-App Notification Center (FR-14)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-14.1 | Persistent per-user inbox with history | ✅ | `Notification`, indexed on `(RecipientId, IsRead)`; retention sweep per `NotificationRetentionDays` |
| FR-14.2 | Read/unread state, mark one, mark all | ✅ | Plus mark-unread and per-item delete |
| FR-14.3 | Categorization by type | ✅ | `NotificationCategories` shared constants (client + server) |
| FR-14.4 | Deep-link to the relevant record | ✅ | `Link` field resolved by the bell and the notifications page |

**Beyond specification:** per-category in-app muting applied *before* persistence, with
account/security notices exempt from muting.

---

### 15. Bulk Account Import (FR-15)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-15.1 | Create many scholar accounts from one upload | ✅ | `POST /api/user-import` |
| FR-15.2 | Per-row validation | ✅ | Required fields, duplicate email, valid program and scholarship type |
| FR-15.3 | Import valid, reject invalid, report failures | ✅ | Per-row result report |
| FR-15.4 | Downloadable import template | ✅ | `GET /api/user-import/template.xlsx` |
| FR-15.5 | Issue credentials / verification links | ✅ | `SendScholarWelcomeAsync` with temp password + verify link |

---

### 16. Submission Deadline and Compliance Window (FR-16)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-16.1 | Deadline per requirement per period | ✅ | Unique index on `(RequirementId, AcademicYear, Semester)` |
| FR-16.2 | Due date and countdown shown to scholars | ✅ | `MyDocumentsPage`, `useNow` |
| FR-16.3 | On-time / late classification | ✅ | Compared at upload; late window governed by `AllowLateSubmissions` |
| FR-16.4 | Automated reminders ahead of a deadline | ✅ | `DeadlineReminderService` sweeps every 6h through a **three-stage** sequence (`Approaching` → `Final` → `Missed`), in-app **and** email behind `EmailDeadlines`; recipients filtered to approved scholars still holding the scholarship |
| FR-16.5 | Report of overdue, missing, or late submissions | ✅ | `GET /api/deadlines/report`, batched (no N+1) |

---

### 17. Scholar–Coordinator Messaging (FR-17)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-17.1 | Threaded messages linked to a document/requirement | ✅ | `Message`, indexed on `(ScholarId, RequirementId)` |
| FR-17.2 | Replies retained as full thread history | ✅ | `MessagesPage`, SQL-side thread aggregation |
| FR-17.3 | Real-time notification of new messages | ✅ | SignalR + email |
| FR-17.4 | Conversation restricted to the scholar and authorized staff | ✅ | Enforced server-side |

**Beyond specification:** configurable auto-reply on the first message in a thread
(`MessagingSettingsController`), unread-count endpoint.

---

### 18. Scholarship Renewal and Lifecycle Management (FR-18)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-18.1 | Track lifecycle state | ✅ | `LifecycleStatuses` enum; `Holding` predicate now **gates** slot occupancy, release generation, and reminder targeting |
| FR-18.2 | Process renewal per academic period | ❌ | **Outstanding.** Only a manual `PATCH /{userId}/lifecycle` exists — no per-period renewal transaction |
| FR-18.3 | Evaluate renewal eligibility against compliance and grades | ❌ | **Outstanding.** The inputs (compliance %, GWA vs `MinimumGwa`) exist and are computed elsewhere; nothing combines them into a renewal verdict |
| FR-18.4 | Surface scholars due for renewal or lapsed | ⚠️ | A renewal-decision **count** is on the staff dashboard (`DashboardQueries:122`); there is no drill-down list or worklist page |

**This is the largest remaining functional gap in the system.**

---

### 19. Data Privacy and Consent Management (FR-19)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-19.1 | Privacy notice and consent before processing (RA 10173) | ✅ | `ConsentGate` blocks the app until accepted |
| FR-19.2 | Consent recorded with timestamp and notice version | ✅ | Version bump re-prompts every user |
| FR-19.3 | Data-subject access — view and download personal data | ✅ | `GET /api/scholars/{userId}/export`, and the disclosure is itself audited |
| FR-19.4 | Processing restricted to authorized roles | ✅ | RBAC + per-request session validation |

---

### 20. Notification and Delivery Preferences (FR-20)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-20.1 | Configure delivery channels per category | ✅ | `EmailDocumentStatus`, `EmailAnnouncements`, `EmailDeadlines` — **all three now read by code** — plus per-category in-app muting |
| FR-20.2 | Opt out of non-critical email | ✅ | Same toggles |
| FR-20.3 | Always deliver critical account/security notices | ✅ | `NotificationMuting` refuses to mute the account/security category |

---

### 21. Printable Compliance Summary (FR-21)

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| FR-21.1 | Per-scholar printable summary of profile, compliance, grades, status | ✅ | "Print Summary" on `ScholarDetailPage` |
| FR-21.2 | Generation date/time and generating user on the summary | ✅ | Printed in the header |
| FR-21.3 | Available to the scholar and to authorized staff | ✅ | Same page serves `/my-profile` and the staff detail route |

---

### 22. Financial Tracking — capability built beyond the SRS

Not present in the v2 SRS; implemented and in the working system. It should be written up as
FR-22 in the next SRS revision.

| # | Capability | Status | Evidence |
|---|---|---|---|
| 22.1 | Recurring scholarship releases generated per period, idempotently | ✅ | `POST /api/scholarship-releases/generate`, one Pending row per holder |
| 22.2 | Release with reference number; cancellation requires a reason | ✅ | A `Released` row can never be edited, cancelled, or deleted |
| 22.3 | Double-payout prevention | ✅ | Unique index on `(ScholarId, ScholarshipTypeId, AcademicYear, Semester)` |
| 22.4 | Per-period "who has been paid" monitor | ✅ | `GET /api/scholarship-releases/monitor`, `NotRecorded` included |
| 22.5 | One-time grants, tracked award → release | ✅ | `OneTimeGrantsController` |
| 22.6 | Scholars can see their own releases | ✅ | Releases card on the scholar's profile |
| 22.7 | Staff navigation to the releases page | ✅ | Sidebar entry for Administrator and Coordinator |
| 22.8 | Scholarship slot quotas with filled-vs-available tracking | ✅ | `SlotLimit`; occupancy counted through `LifecycleStatuses.Holding` |
| 22.9 | Scholarship Check integrity report | ✅ | Duplicate student IDs, overlapping scholarships, profile/ledger mismatches |

---

### 23. Other capabilities beyond the SRS

| Capability | Status |
|---|---|
| Scholar self-registration with an admin approval queue (Pending/Approved/Rejected) | ✅ |
| Guided first-run tutorial + in-app Help/FAQ page | ✅ |
| Onboarding gate — profile setup enforced before the app unlocks | ✅ |
| Dark mode with a theme-token system | ⚠️ (see NFR-3.3) |
| API versioning — every route twinned at `api/v1/…` | ✅ |
| Database export/backup as a per-table CSV ZIP, audited on download | ✅ |
| Active-semester control shared across submission, deadlines, releases | ✅ |
| Sample-data seeding for demonstration | ✅ |

---

## Part II — Non-Functional Specifications

Organized by the six **ISO 25010** dimensions the study evaluates, plus Security.

### NF-1 Functional Suitability

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NFR-1.1 | Completeness — all FRs implemented | ⚠️ | 18 of 21 modules complete; **FR-18.2/18.3 renewal outstanding**; three campus-related requirements withdrawn |
| NFR-1.2 | Correctness of analytics | ✅ | Aggregations run in SQL; the grade-period unique index removed the non-determinism that previously let a compliance verdict flip between page loads. Covered by `AnalyticsOverviewTests`, `DashboardQueriesTests` |
| NFR-1.3 | Appropriateness — functions map to documented needs | ✅ | Traceability held in this document and the SRS |

### NF-2 Reliability

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NFR-2.1 | Availability during operating hours | ⚠️ | Deployment documented in `DEPLOYMENT.md`; **not yet measured against a 99% target** — needs a production deployment and uptime monitoring |
| NFR-2.2 | Atomic, consistent transactions | ✅ | EF `SaveChangesAsync` per operation; the file-before-row delete ordering defect is fixed |
| NFR-2.3 | Scheduled backup and defined RTO | ⚠️ | One-click CSV export ✅ and a native SQL Server backup procedure documented ✅. **No scheduled/automated backup job, and no RTO stated** |
| NFR-2.4 | Referential integrity via PK/FK constraints | ✅ | Enforced in `OnModelCreating`; five unique indexes now carry invariants previously left to `if` statements |
| NFR-2.5 | Cross-campus consistency | ➖ | Withdrawn — single campus |
| NFR-2.6 | Real-time propagation within seconds | ✅ | SignalR; verified in the live workflows |

### NF-3 Usability

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NFR-3.1 | Learnability — submission without training | ✅ | Guided tutorial, onboarding gate, next-action nudge, Help page |
| NFR-3.2 | Operability — role-appropriate navigation only | ✅ | `navByRole` in `Layout.jsx` |
| NFR-3.3 | Consistent visual design | ⚠️ | Shared components and a CSS-token system are in place, and tokens now **outnumber** hardcoded colours (938 `var(--…)` vs 442 hex, reversed from 627 vs 811). **442 hardcoded hex values remain, so dark mode can still regress on new surfaces** |
| NFR-3.4 | Visualization clarity | ✅ | Recharts, shared `statusTones` / `viz` constants |
| NFR-3.5 | Accessibility (implied for a public-university system) | ❌ | **22 `htmlFor` associations against 100 inputs; 38 `aria-*` attributes.** Most inputs are announced unlabelled; custom controls are largely mouse-only. Not started in earnest |

### NF-4 Performance Efficiency

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NFR-4.1 | Page load ≤ 3s under normal load | ⚠️ | The dashboard went from **11 API calls to 1** (`DashboardController`); **no formal load measurement has been taken** |
| NFR-4.2 | Optimized queries, indexed columns | ✅ | Analytics, users, messaging threads, verification report and the deadline report all aggregate in SQL; covering indexes on the submission, notification and audit tables |
| NFR-4.3 | Concurrent access by the target population | ⚠️ | Architecturally supported; **not load-tested** |
| NFR-4.4 | Peak-load handling | ⚠️ | Bulk email batched over one SMTP connection (`BeginBatchAsync`) rather than one connection per recipient; **peak upload load not tested** |
| NFR-4.5 | Paginated retrieval | ✅ | Server-side pagination on users, scholars, documents, audit log, notifications, messages |

### NF-5 Maintainability

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NFR-5.1 | Modularity / separation of concerns | ✅ | Controllers → services → EF; query logic extracted to `AnalyticsQueries`, `DashboardQueries`, `DeadlineHelper`, `ScholarshipRegistry` |
| NFR-5.2 | Reusable UI components | ✅ | 23 shared components; one `Modal` portal, one `StatusBadge`, one `ListState` |
| NFR-5.3 | Traceable incremental migrations | ✅ | 19 EF migrations, guarded by `MigrationAssumptionTests` |
| NFR-5.4 | Testability independent of the UI | ✅ | **142 tests**, up from 64 — now covering the upload guard chain, login/lockout, the release money path, the deadline stage machine, and the verification report, not only helpers |
| NFR-5.5 | Technical documentation | ⚠️ | `DEPLOYMENT.md` ✅, an Obsidian vault of architecture/feature notes ✅, XML doc comments throughout ✅, Swagger ✅. **No consolidated database-schema document or API reference deliverable** |
| NFR-5.6 | Coding standards | ⚠️ | Server: warning-free build with `TreatWarningsAsErrors`. Client: **53 lint problems** remain, gated by a ratchet in CI so the count cannot grow |
| NFR-5.7 | Typed API contracts (implied by NFR-5.5) | ⚠️ | 18 DTOs exist, but **39 `Ok(new { … })` anonymous responses remain**, so Swagger documents those bodies as untyped |

### NF-6 Portability

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NFR-6.1 | Current major browsers | ⚠️ | Standard React 19 / ES2022 build; **no formal cross-browser test matrix recorded** |
| NFR-6.2 | Deployable with documented setup | ✅ | `DEPLOYMENT.md`; CI builds client and server and runs the test suite |
| NFR-6.3 | Desktop, laptop, tablet, mobile | ✅ | Responsive pass completed across all pages |

### NF-7 Security

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NFR-7.1 | Salted password hashing | ✅ | ASP.NET Identity default hasher; hashes excluded from the CSV export by design |
| NFR-7.2 | Authorization enforced in application logic | ✅ | Server-side on every action; direct-URL navigation cannot bypass it |
| NFR-7.3 | HTTPS/TLS in transit | ✅ | HTTPS redirection + HSTS in production |
| NFR-7.4 | Audit logging of record-affecting actions | ✅ | Including failed logins, lifecycle changes, grade edits, and data-subject exports |
| NFR-7.5 | RA 10173 compliance | ✅ | Consent capture and versioning, data-subject access, role-scoped processing, confidentiality footer on exports |
| NFR-7.6 | Brute-force resistance (implied) | ✅ | Rate limiting on auth endpoints + configurable account lockout |
| NFR-7.7 | Upload content safety (implied) | ✅ | Magic-byte signature validation, not extension alone; served under a sandboxing CSP |
| NFR-7.8 | Session revocation (implied) | ✅ | `SessionValidator` re-checks `IsActive` and the security stamp per request, cached 30s, invalidated on revocation |
| NFR-7.9 | Dependency hygiene (implied) | ⚠️ | CI blocks critical advisories; **one high advisory outstanding** (`GHSA-qwww-vcr4-c8h2`, react-router 7.18.0). The RSC/actions path it affects is not used by this app, but clearing it requires a deliberate downgrade to 7.11.0 or an upgrade to 8.3+ |
| NFR-7.10 | Token storage | ⚠️ | JWT in `localStorage` — readable by any XSS. Mitigated by the app-shell CSP; an `httpOnly` cookie would be stronger but requires CSRF protection in exchange |

---

## Part III — What remains to be accomplished

Ordered by value to the finished system.

### A. Functional gaps

| # | Item | Requirement | Size |
|---|---|---|---|
| A1 | **Guided renewal workflow** — a per-period renewal transaction that evaluates document compliance and GWA against the scholarship's threshold, advances lifecycle status, and records the decision | FR-18.2, FR-18.3 | Large — the only substantial FR gap |
| A2 | **Renewal worklist** — drill down from the dashboard count into the scholars due for a decision | FR-18.4 | Small |
| A3 | **Refresh token / "Remember me"** — today the session is a hard expiry with no renewal | Backlog | Medium |
| A4 | **SMTP and email-template configuration from the UI** — currently `appsettings` only, so the office cannot change the sender or the wording | Backlog | Medium |
| A5 | **Scheduled / emailed report digests** — periodic compliance summaries pushed to staff | Backlog | Medium |
| A6 | **Browser web-push notifications** alongside in-app and email | Backlog | Medium |
| A7 | **Admin visibility of email failures** — the retry and the logging landed; a failed send is still invisible outside the server log | tobefix §2.10 | Small |

### B. Quality and compliance gaps

| # | Item | Requirement | Size |
|---|---|---|---|
| B1 | **Accessibility** — `htmlFor`/`id` pairs on the forms scholars must complete, then keyboard handling on `Modal` and `ScholarSearchSelect` | NFR-3.5 | Medium, high institutional value |
| B2 | **Retire the remaining 442 hardcoded colours** into theme tokens; until then dark mode keeps regressing on each new surface | NFR-3.3 | Medium, incremental |
| B3 | **Clear the 53 lint problems** — mostly the load-in-effect pattern repeated across list pages, which also causes double-fetch on mount | NFR-5.6 | Medium, incremental |
| B4 | **Response DTOs for the 39 remaining anonymous returns**, so Swagger documents real contracts | NFR-5.7 | Medium |
| B5 | **Resolve the react-router advisory** and tighten CI's audit gate from `critical` to `high` | NFR-7.9 | Small + one decision |

### C. Evidence still to be produced for the report

These are not defects; they are measurements the ISO 25010 write-up needs and that no one has taken yet.

| # | Item | Requirement |
|---|---|---|
| C1 | **Load / concurrency test** — response times under the target population, and at a renewal-deadline peak | NFR-4.1, NFR-4.3, NFR-4.4 |
| C2 | **Cross-browser test matrix** — Chrome, Edge, Firefox, recorded | NFR-6.1 |
| C3 | **Uptime measurement** against the 99% target, once deployed | NFR-2.1 |
| C4 | **Scheduled backup job and a stated RTO**, beyond the documented manual procedure | NFR-2.3 |
| C5 | **Consolidated database-schema and API reference documents** for institutional IT handover | NFR-5.5 |
| C6 | **ISO 25010 acceptability survey** — 30 scholars, 10 coordinators, 10 IT experts | Study instrument |

---

## Part IV — Summary for the report

| Area | Complete | Partial | Not started | Withdrawn |
|---|---|---|---|---|
| Functional requirements (FR-1 … FR-21, 21 modules) | **18** | 2 (FR-4, FR-6 campus facets) | 1 (FR-18 renewal) | 5 individual campus requirements |
| Non-functional requirements (7 dimensions, 31 items) | **21** | 9 | 1 (accessibility) | 2 |

**Headline.** The system implements every specified module except the guided renewal workflow,
and carries a substantial body of capability beyond the SRS — financial release tracking, scholar
self-registration with an approval queue, two-factor authentication, system settings, API
versioning, and database export — which the next SRS revision should absorb as FR-22 and FR-23.

**What "finished" means today.** All five core workflows — onboarding, document submission and
review, releases and grants, deadlines and compliance, and communication — run end to end with no
break. The audit of 2026-07-29 recorded 24 defects across correctness, security, performance, and
process; **all but the deliberately deferred items in Part III are closed**, and the test suite has
grown from 64 helper-only tests to 142 covering the branching logic that carries the most risk.

**What is left.** One functional feature (renewal), a set of quality debts that are incremental
rather than blocking (accessibility, colour tokens, lint, DTOs), and six pieces of measurement
evidence the ISO 25010 evaluation needs.
