# To Be Added

## Authentication
- [x] Resend email-verification link (no way to re-request if the first email is lost).
- [x] Account lockout / cooldown after repeated failed logins (currently unlimited attempts).
- [x] Password-strength meter on the register and change-password forms.
- "Remember me" / refresh-token option — today it's a hard 30-minute inactivity logout with no token refresh.

## Student Management
- Scholar profile photo/avatar upload (only initials are shown anywhere).
- Guided scholarship **renewal workflow** — lifecycle statuses exist, but there's no per-period renewal process that checks document compliance + grade thresholds and advances the status automatically.
- [x] Edit a scholar's email/login from their profile (only name/campus are editable via User Management).
- [x] Clear reactivate/restore flow for archived scholars (archive exists; un-archiving is only a manual status toggle).

## Scholarship Management
- Scholarship **slots/quota** per type (and per campus) with filled-vs-available tracking.
- Display-order / grouping for document requirements (the checklist order is currently name-sorted only).
- [x] Bulk-assign a requirement to multiple scholarship types at once.

## User Management
- [x] **Server-side pagination + filtering** for the Users list (currently returns *all* users and paginates on the client — see Performance).
- [x] Resend credentials / trigger a password reset for a user from the admin panel.
- Allow a coordinator to cover multiple campuses (currently a single `CampusId`).

## Dashboard
- [x] Admin/coordinator: a **recent-activity feed** sourced from the audit log.
- [x] Scholar: a stronger "next action" nudge when documents are Incomplete/missing (beyond the current CTA).
- Collapsible/configurable dashboard widgets.

## Reports
- **PDF export** of reports (only Excel today; the SRS says "e.g. PDF/Excel").
- [x] Date-range / academic-period filter on analytics (currently all-time + campus only).
- Cross-campus **comparison view** (side-by-side compliance per campus).
- Scheduled / emailed report digests.

## Notifications
- Browser **web-push** notifications in addition to in-app + email.
- [x] "Mark as unread" and delete individual notifications.
- Finer in-app category muting (beyond the 3 email-preference toggles).

## Settings
- [x] Privacy-notice **version management** — re-prompt for consent when the notice version changes (the field exists but isn't enforced).
- [x] Configurable inactivity-timeout duration.
- SMTP / email-template configuration from the UI (currently `appsettings` only).
- One-click database **backup/export** from Settings.

## Others
- [x] **Global search** across documents, announcements, and users (navbar search covers scholars only).
- **Announcement scheduling** (publish at a future date/time).
- [x] Activity-log **export** to Excel/CSV (parity with the scholar/submission exports).
- [x] In-app help/FAQ page to complement the first-time tutorial.

---

# To Be Fixed

## Bugs
- [x] **Dark mode gaps:** a few colored surfaces (renewal/alert cards, some inline `#fff`/tinted boxes) stay light in dark mode → reduced contrast.
- [x] **Dead code:** `components/AnnouncementCard.jsx` is not imported anywhere (pages use their own inline card) — remove or wire it up.
- [x] **Fire-and-forget scoped services:** announcement/message emails and announcement notifications run after the HTTP response using request-scoped services (`DbContext`, `IEmailService`) — risk of a disposed context under load. Move to a background queue or create a fresh scope.
- [x] Email send failures are silently swallowed with no retry or admin visibility.

## UI/UX
- Replace `alert()` / `confirm()` calls with in-app **toasts/modals** for a consistent look.
- [x] Wide tables overflow on small screens — wrap them in `overflow-x-auto` containers.
- Messaging on mobile renders both the thread list and conversation — add a single-pane, back-button flow.
- [x] Add loading **skeletons** and standardize empty states across list pages.

## Validation
- Several modals still lack **inline, field-level** validation (they rely on server 400s or `alert`).
- [x] No client-side size/type feedback before image uploads (server enforces 10 MB + extension).
- [x] Announcement `ExpiresAt` can be set in the past with no warning.
- [x] Email uniqueness is only caught on submit — no live "email already taken" check.
- [x] Grade academic-year isn't checked against the active semester.

## Performance
- [x] `GET /api/users` loads **all** users into memory (client-side paging) — add server pagination.
- [x] `AnalyticsController.Overview` materializes all scholars + all submissions before aggregating — push counts down to SQL.
- [x] Deadline **report** runs per-requirement queries (N+1) — batch the submission/applicable-scholar lookups.
- [x] Messaging thread list loads all of a user's messages then groups in memory — paginate/aggregate in SQL.

## Security
- [x] **No rate limiting or lockout** on `/api/auth/login` and `forgot-password` — brute-force exposure.
- [x] File uploads are validated by **extension + size only**, not content/magic bytes — add signature checks (or AV scan) for COR/ID uploads.
- [x] **Failed** login attempts aren't audit-logged (only successful logins are).
- [x] Confirm HTTPS/HSTS is enforced in production (only a dev HTTPS redirect today).
- [x] `AnalyticsChanged` is broadcast to *all* SignalR clients (incl. scholars) — harmless bare signal, but scope it to staff to avoid needless fan-out.

## Code Quality
- Controllers return **anonymous objects** instead of DTOs — harder to version, document (Swagger), and unit-test; introduce response DTOs.
- [x] Duplicated code: per-page `ctlStyle`/compact-filter styling, the `ContentTypeFor` image helper (in two controllers), and the near-identical image-upload endpoints (requirement sample vs. announcement) — extract shared helpers.
- [x] **Magic strings** for notification categories and announcement intent keys — centralize as shared constants/enums (client + server).
- [x] Consolidate the duplicated announcement-card implementations.

## Others
- No **deployment/backup guide** or CI pipeline (NFR-2.3 / 5.5 / 6.2).
- Test coverage is minimal (2 suites) — extend to the deadline report, bulk import, and preference enforcement.
- No API **versioning** strategy.
- [x] Add tabbing on the System Settings
- We still need to fix the dark mode, there are components that are still not affected by the dark mode. 
- On the tutorial we need a guided tutorial where the system will point out where and what. 
- [x] We need a details on the upload image on the announcement. We need to put what is the resolution needed for the image to be uploaded. 
- Remove the other campuses we dont need those. We are focusing on a single campus and that is Lingayen Campus(main campus)
- [x] We need to add a ask again for the logout function. 
- When the student is newly register to the system then the first thing that thhe student needs to do is to Setup their account details and information about them. 
- [x] Add a favicon
- [x] Work on the overall transitions and animations all over the system
- Check responsiveness of the system
- 