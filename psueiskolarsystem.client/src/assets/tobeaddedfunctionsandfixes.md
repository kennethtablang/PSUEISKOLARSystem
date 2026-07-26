# To Be Added

## Authentication
- [x] Resend email-verification link (no way to re-request if the first email is lost).
- [x] Account lockout / cooldown after repeated failed logins (currently unlimited attempts).
- [x] Password-strength meter on the register and change-password forms.
- "Remember me" / refresh-token option — today it's a hard 30-minute inactivity logout with no token refresh.

## Student Management
- [x] Scholar profile photo/avatar upload (only initials are shown anywhere).
      *(`/api/avatars` serves photos to any signed-in user; scholars manage their own from
      My Profile, staff can set/clear one from a scholar's page. Shown in the navbar, sidebar,
      Scholars, Users, and the scholar detail header, with initials as the fallback.)*
- Guided scholarship **renewal workflow** — lifecycle statuses exist, but there's no per-period renewal process that checks document compliance + grade thresholds and advances the status automatically.
- [x] Edit a scholar's email/login from their profile (only name/campus are editable via User Management).
- [x] Clear reactivate/restore flow for archived scholars (archive exists; un-archiving is only a manual status toggle).

## Scholarship Management
- [x] Scholarship **slots/quota** per type with filled-vs-available tracking.
      *(Optional `SlotLimit`; occupancy is counted from the profile pointers, so the number
      shown on the Scholarship Types page is the same one that refuses an over-quota
      assignment in `ScholarshipRegistry`. Per-campus is moot — single campus.)*
- [x] Display-order / grouping for document requirements (the checklist order is currently name-sorted only).
      *(`GroupName` + `DisplayOrder`, one shared `RequirementOrdering` used by the admin
      catalog, the type editor, and the scholar's checklist; reorder arrows on the
      Requirements page.)*
- [x] Bulk-assign a requirement to multiple scholarship types at once.
- [x] **Admin approval of self-registered scholars** — Pending/Approved/Rejected on the account, a
      Scholar Approvals queue, and document upload locked until verified.
- [x] **Strictly one scholarship per student** — enforced by a unique active row in the
      `ScholarshipAssignments` ledger; transfers close the old row and are auditable.
- [x] **Scholarship Check** report — flags duplicate student IDs, overlapping scholarships, and
      profile/ledger mismatches.
- [x] **One-time grants** — one-off financial awards per scholar, tracked from award to release.
- [x] Per-type "other documents" — documents that belong to a single scholarship type without
      polluting the shared requirements catalog.
- [x] Read-only detail view for a scholarship type (requirements + scholar figures).

## User Management
- [x] **Server-side pagination + filtering** for the Users list (currently returns *all* users and paginates on the client — see Performance).
- [x] Resend credentials / trigger a password reset for a user from the admin panel.
- ~~Allow a coordinator to cover multiple campuses (currently a single `CampusId`).~~
      *(No longer applies — campuses were removed; the system is Lingayen-only.)*

## Dashboard
- [x] Admin/coordinator: a **recent-activity feed** sourced from the audit log.
- [x] Scholar: a stronger "next action" nudge when documents are Incomplete/missing (beyond the current CTA).
- [x] Collapsible/configurable dashboard widgets.

## Reports
- [x] **PDF export** of reports (only Excel today; the SRS says "e.g. PDF/Excel").
      *(QuestPDF; `scholars.pdf` and `submissions.pdf` sit beside the existing `.xlsx`
      endpoints and share their queries. Landscape A4, applied filters printed in the header,
      page numbers, and an RA 10173 confidentiality footer.)*
- [x] Date-range / academic-period filter on analytics (currently all-time + campus only).
- ~~Cross-campus **comparison view** (side-by-side compliance per campus).~~
      *(No longer applies — campuses were removed; the system is Lingayen-only.)*
- Scheduled / emailed report digests.

## Notifications
- Browser **web-push** notifications in addition to in-app + email.
- [x] "Mark as unread" and delete individual notifications.
- [x] Finer in-app category muting (beyond the 3 email-preference toggles).
      *(Per-user muted categories honoured by `NotificationService` before a notification is
      persisted, so a muted category never reaches the bell. Account/security notices can't be
      muted. Toggles live under Notification Preferences on My Profile.)*

## Settings
- [x] Privacy-notice **version management** — re-prompt for consent when the notice version changes (the field exists but isn't enforced).
- [x] Configurable inactivity-timeout duration.
- SMTP / email-template configuration from the UI (currently `appsettings` only).
- [x] One-click database **backup/export** from Settings.
      *(`GET /api/admin/backup` streams a ZIP of one CSV per table plus a README, audited on
      download. Password hashes and security stamps are excluded on purpose, so it's an
      archive/reporting export rather than a restorable credential backup — a full restore
      still means a native SQL Server backup per DEPLOYMENT.md.)*

## Others
- [x] **Global search** across documents, announcements, and users (navbar search covers scholars only).
- [x] **Announcement scheduling** (publish at a future date/time).
      *(`PublishAt` hides the post from its audience until due; a background publisher releases
      it and only then sends the notifications/emails, with `PublishedAt` making double-sends
      impossible. Staff see a Scheduled badge and a "Publish now" action.)*
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
- [x] Replace `alert()` / `confirm()` calls with in-app **toasts/modals** for a consistent look.
- [x] Wide tables overflow on small screens — wrap them in `overflow-x-auto` containers.
- [x] Messaging on mobile renders both the thread list and conversation — add a single-pane, back-button flow.
- [x] Add loading **skeletons** and standardize empty states across list pages.

## Validation
- [x] Several modals still lack **inline, field-level** validation (they rely on server 400s or `alert`).
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
- [x] No **deployment/backup guide** or CI pipeline (NFR-2.3 / 5.5 / 6.2).
- [x] Test coverage is minimal (2 suites) — extend to the deadline report, bulk import, and preference enforcement.
- [x] No API **versioning** strategy.
      *(An MVC convention gives every `api/…` route an `api/v1/…` twin, so v1 is canonical and
      documented while the unversioned paths keep working as legacy aliases. Swagger lists each
      action once, at its v1 address. A breaking change becomes a v2 controller.)*
- [x] Add tabbing on the System Settings
- [x] We still need to fix the dark mode, there are components that are still not affected by the dark mode. 
- [x] On the tutorial we need a guided tutorial where the system will point out where and what. 
- [x] We need a details on the upload image on the announcement. We need to put what is the resolution needed for the image to be uploaded. 
- [x] Remove the other campuses we dont need those. We are focusing on a single campus and that is Lingayen Campus(main campus)
      *(Model/controller/migration done in `RemoveCampus`; the leftover dead `campusId` query
      params in the client API layer and a stale route comment are now gone too.)*
- [x] We need to add a ask again for the logout function. 
- [x] When the student is newly register to the system then the first thing that thhe student needs to do is to Setup their account details and information about them. 
- [x] Add a favicon
- [x] Work on the overall transitions and animations all over the system
- [x] Check responsiveness of the system
- [x] Use the whole screen of the dashboard, currently we are using half. Same with the Data visualization. We need to do this across users
      *(Dashboard now spans the full width with a right rail for feeds/queues; Data Visualization still to do.)*
- [x] We need to fix the modals. When I try to open the modal of the + New Scholarship Type the modal opens bu there are some issues with it. The navbar overlaps on the Modal so the modal is behind the navbar at the top. We need to fix this. Alos when I try to open a modal the page behind modal needs to blurr a bit with a hint of blue of course. Do this for all of the modals we need to fix this.
      *(All modals now render through `components/Modal.jsx`, which portals to `<body>` — the
      route-fade transform created a stacking context that trapped them under the topbar — and
      shares one blurred, blue-tinted backdrop.)*
- [x] We need to redesign the active set on the sidebar. This is too obvious that this is work of AI. We need to redesign the selected part of the sidebar.
      *(The flat grey block and left bar are gone. The active row now carries a gold wash that
      fades out to the right with a hairline edge, its icon tile inverts to solid gold with a
      dark glyph (echoing the PSU mark), and a gold capsule marker sits flush against the
      sidebar's left rail so the selection is trackable down the list.)*
- 