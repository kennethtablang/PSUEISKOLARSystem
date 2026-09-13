# PSU e-Iskolar — To Be Fixed

Written 2026-07-29. This is a **fresh audit**, not a continuation of
`tobeaddedfunctionsandfixes.md`. That file tracks the original feature backlog and is mostly
ticked off; this one records what a trace of the *live* workflows turned up afterwards.

Everything below was verified against the code, not inferred from the docs. Where a claim
comes from a command, the command and its output are named so it can be re-checked.

**Baseline as of this audit**

| Check | Result |
|---|---|
| `dotnet build` (server) | Succeeds — 1 code warning (`CS9113`) |
| `dotnet test` | **64 passed**, 0 failed, 11 test files |
| `npx eslint .` | **68 problems — 48 errors, 20 warnings** |
| `npm audit` | **4 high-severity** advisories (2 reach production) |
| Working tree | 73 uncommitted paths, 19 of them untracked new files |

---

## Part 1 — Workflow analysis

Five workflows carry the system. Each is traced end to end below, with the point where it
breaks marked **⚠**.

### 1.1 Scholar onboarding

```
LandingPage → RegisterPage
   → POST /api/auth/register-scholar          AuthService.RegisterScholarAsync:161
       ├── EmailConfirmed  = !RequireEmailVerification || !EmailEnabled
       └── ApprovalStatus  = AutoApproveScholars ? Approved : Pending
   → verification email (SendVerificationEmailAsync:201)
   → VerifyEmailPage  → POST /api/auth/verify-email
   → LoginPage        → POST /api/auth/login   AuthService.LoginAsync:31
       gate order: unknown/inactive → lockout → password → email-verified → 2FA → maintenance
   → ConsentGate      (RA 10173 notice; re-prompts on version bump)
   → OnboardingGate   (blocks until StudentId + ProgramId + ScholarshipTypeId are set)
   → PUT /api/scholars/{id}                    ScholarProfilesController.Upsert:344
       └── ScholarshipRegistry.SetAsync — the one-scholarship-per-student rule
   → ScholarApprovalsPage: staff Approve/Reject
   → uploads unlock                            DocumentsController.Upload:124
```

The gate ordering is sound and the API enforces what the UI gates — `ScholarOnboarding` is
called server-side, not just in the client. Two problems:

- **⚠** Registration is verified, consented, and approved — but **`ApprovalStatus` and
  `LifecycleStatus` never re-enter the workflow after this point.** See §2.3 and §2.4.
- **⚠** The session established here silently dies after 60 minutes regardless of the
  configured timeout. See §2.1 — this is the single worst defect found.

### 1.2 Document submission and review

```
Scholar: MyDocumentsPage
   → GET /api/document-requirements?scholarshipTypeId=   (checklist, group-ordered)
   → GET /api/documents?academicYear=&semester=
   → GET /api/deadlines?academicYear=&semester=
   → POST /api/documents (multipart)          DocumentsController.Upload:111
        approval → profile → extension → size → period → active-semester →
        requirement → duplicate → late-window → storage.SaveAsync (magic bytes)
   → DocumentStatusHistory "Pending" row + confirmation email

Staff: DocumentReviewPage
   → PATCH /api/documents/{id}/review    or   POST /api/documents/batch-review
   → status + FeedbackNote + history row + in-app notification + email
   → SignalR "AnalyticsChanged" → staff dashboards refresh
```

The validation chain is genuinely thorough and the history table gives a real audit trail.
But the upload *policy* is defined in four places that disagree (§2.2), the
replace-a-verified-document branch falls through and duplicates the row (§2.5), and the
staff-upload-on-behalf-of-a-scholar path exists in the server and has no client (§2.6).

### 1.3 Money: recurring releases and one-time grants

```
Recurring (per semester / per year)
   ScholarshipReleasesPage → POST /api/scholarship-releases/generate
        → one Pending row per profile pointing at the type (idempotent)
   → PATCH /{id}/release   → Released + ReferenceNo + notification to scholar
   → PATCH /{id}/cancel    → requires a reason; Released can never be cancelled
   → GET  /monitor          → per-period "who has been paid" report, NotRecorded included

One-time
   OneTimeGrantsPage / ScholarDetailPage → award → release
```

Immutability is modelled well: a `Released` row cannot be edited, cancelled, or deleted, and
the unique index on `(ScholarId, ScholarshipTypeId, AcademicYear, Semester)` makes a double
payout a deliberate act. Two breaks:

- **⚠ The whole recurring-release feature is unreachable from the UI.** No sidebar entry
  exists for `/scholarship-releases` in any role. See §2.7.
- **⚠ Scholars cannot see their own recurring releases at all** — the notification links to
  `/my-profile`, which does not render them. One-time grants *are* shown there. See §2.7.

### 1.4 Deadlines, reminders, and compliance

```
DeadlinesPage → POST /api/deadlines (one per requirement per period, unique index)
DeadlineReminderService — every 6h
   → deadlines with RemindersSentAt == null, due within DeadlineReminderDays
   → DeadlineHelper.GetApplicableScholarsAsync (requirement-link fallback semantics)
   → minus scholars who already submitted
   → notifications.CreateForManyAsync(...) ; RemindersSentAt = now
```

- **⚠** Exactly **one** reminder is ever sent per deadline, and **nothing** fires when a
  deadline passes unmet. See §2.8.
- **⚠** The reminder is in-app only. The **"Email me about deadlines" preference is never
  read by any code path.** See §2.9.
- **⚠** Reminders go to Pending-approval scholars who are blocked from uploading, and to
  Graduated ones. See §2.3, §2.4.

### 1.5 Communication

```
Announcements: create → PublishAt (scheduled) → AnnouncementPublisherService releases it
   → notifications + emails honouring EmailAnnouncements; PublishedAt prevents double-send
Messages: threaded per (scholar, requirement); auto-reply on first message in a thread
   → SignalR "ReceiveMessage" for live append
Bell: SignalR "ReceiveNotification"; per-category in-app muting applied before persistence
```

This is the most complete flow in the system. The one issue is that `MessagesController`
uses the correct fresh-scope pattern for its background email while `DocumentsController`
and `ScholarApprovalsController` do not (§2.10).

---

## Part 2 — Bugs, highest severity first

### 2.1 🔴 Sessions die silently after 60 minutes; every request then fails with a generic toast

The worst defect found, and it is a chain of three:

1. `JwtSettings.ExpiryMinutes` is **60** — `appsettings.json:16`.
2. `SessionTimeoutMinutes` is settable to **480** (8 hours) —
   `SystemSettingsController.cs:149`. Users may also override it per browser
   (`AuthContext.jsx:24`), and a stored personal choice wins.
3. **Nothing in the client handles a `401`.** `grep -rn "401" src/` returns only the
   `/unauthorized` *route*. All 22 modules in `src/api/` hand-roll `fetch` and throw a
   hardcoded string:

   ```js
   if (!res.ok) throw new Error('Failed to load submissions.');   // api/documents.js:26
   ```

**Failure:** an admin sets the timeout to 2 hours. At minute 61 the JWT expires. The
inactivity timer has not fired, so the client still believes it is signed in. The sidebar,
the user's name, the cached page all stay on screen. Every action now shows
*"Failed to load submissions."* / *"Upload failed."* — and `NotificationContext.jsx:46`
swallows its own failure entirely (`catch { /* offline or session expired */ }`), so the bell
just goes quietly stale. There is no path back except a manual reload.

**Fix:** one shared `apiFetch` wrapper that attaches the token, parses `{ message }` bodies
via the existing `errorMessage` helper, and on `401` calls `signOut()` + `setSessionExpired(true)`.
That collapses ~250 lines of duplicated `fetch` boilerplate at the same time. Then either
clamp `SessionTimeoutMinutes` to `ExpiryMinutes` or add the refresh token that
`tobeaddedfunctionsandfixes.md` still lists as outstanding.

**Related:** `App.jsx:116` hardcodes *"signed out due to 30 minutes of inactivity"* in the
Session Expired modal. With the timeout configurable, that sentence is often simply false —
it should read `inactivityMin` from context.

### 2.2 🔴 Upload policy is defined in four places and three of them are hardcoded

`SystemSettings.MaxUploadMb` and `AllowedFileExtensions` are documented as the single source
of truth — *"Every property here is enforced somewhere; the comment on each says where"*
(`SystemSettings.cs:15`). For uploads that is not true:

| Layer | Size cap | Extensions |
|---|---|---|
| `SystemSettings` (DB) | `MaxUploadMb` = 10 | `pdf,jpg,jpeg,png,webp,doc,docx` |
| `DocumentsController.cs:149-158` | reads DB ✅ | reads DB ✅ |
| `LocalFileStorageService.cs:5-6` | **hardcoded 10 MB** | **hardcoded set** |
| `MyDocumentsPage.jsx:158-167` | **hardcoded 10 MB** | **hardcoded, and omits `webp`** |
| `Program.cs:113` | hardcoded 10 MB form limit | — |

**Failures, both live today:**
- A scholar selecting a valid `.webp` is refused by the client with *"Unsupported file type
  '.webp'"* — even though the server, the storage layer, and the DB default all accept it.
- Raise `MaxUploadMb` to 20 in Settings and a 15 MB PDF passes the controller, then dies in
  storage with *"File size exceeds the 10 MB limit."* Add `xlsx` to the allowed list and it
  passes the controller, then dies with *"File type '.xlsx' is not allowed."* The setting
  looks like it works and does not.

**Fix:** have `LocalFileStorageService` take the policy (it already needs a scope for
nothing else, so pass the values into `SaveAsync`), extend the magic-byte table alongside the
extension list, and serve both values to the client from `GET /api/system-settings/public` —
which already exists and already returns `SessionTimeoutMinutes`.

### 2.3 🟠 `LifecycleStatus` is a label that gates nothing

`grep -rn "LifecycleStatus" Server/` — outside migrations it is **set** (`:282`),
**filtered on** (`:41`), and **displayed** (`:509`, `ScholarshipReleasesController.cs:134`).
It is never consulted before an action. Consequences:

- **Graduated scholars occupy scholarship slots forever.**
  `ScholarshipRegistry.CountFilledSlotsAsync:104` counts every profile pointing at the type
  with no lifecycle or `IsActive` filter, so the quota that refuses a new assignment counts
  people who left years ago.
- **Graduated and Lapsed scholars get payouts generated.**
  `ScholarshipReleasesController.Generate:344` selects all holders with no status filter, so
  a period rollover opens a Pending release for every alumnus still pointing at the type.
- **They keep receiving deadline reminders** (§2.4) and keep appearing in `/monitor` as
  unpaid.
- Suspending a scholar has no effect on anything — they can still upload, still get paid.

Also `SetLifecycle:273` validates against an inline
`new[] { "Active", "Renewed", "Lapsed", "Suspended", "Graduated" }` while every comparable
status set in the codebase is a proper class (`ApprovalStatuses`, `GrantReleaseStatuses`,
`DocumentStatus`, `ScholarshipFrequencies`). There is no transition validation
(Graduated → Active is accepted), no reason captured for a suspension, and no notification to
the scholar whose status changed.

**Fix:** add `LifecycleStatuses` to `Models/Enums`, define which statuses count as *holding*
a scholarship, and route the three call sites above through that predicate. Closing the
`ScholarshipAssignment` ledger row on Graduated is the cleanest way to free the slot, since
the ledger is already the authority for that rule.

### 2.4 🟠 Deadline reminders go to scholars who cannot act on them

`DeadlineHelper.GetApplicableScholarsAsync:43` filters the roster on `r.Name == Scholar &&
u.IsActive` and nothing else. So the 6-hourly sweep notifies:

- **Pending-approval scholars**, whose upload is refused by
  `DocumentsController.cs:124` with *"still awaiting verification by the scholarship office."*
  They are told to submit and then blocked from submitting.
- **Rejected** scholars, permanently blocked.
- **Graduated / Lapsed** scholars, per §2.3.

**Fix:** filter to `ApprovalStatus == Approved` and to lifecycle statuses that still owe
documents. This is also the fastest way to shrink the reminder blast radius.

### 2.5 🟠 Replacing a verified document creates a second row instead of replacing it

`DocumentsController.cs:201-214`:

```csharp
if (existing.Status == DocumentStatus.Verified && !policy.AllowReplaceVerified && !isStaffUpload)
    return BadRequest(...);
if (existing.Status != DocumentStatus.Verified || !policy.AllowReplaceVerified)
    return BadRequest(...);
// falls through → a NEW submission row is inserted
```

With `AllowReplaceVerified = true` and an existing **Verified** submission, both guards pass
and execution continues to `db.DocumentSubmissions.Add(...)`. The result:

- Two rows for the same `(ScholarId, RequirementId, AcademicYear, Semester)`, breaking the
  invariant the comment on line 193 states.
- The old file is **never deleted** — an orphan on disk forever.
- `MyDocumentsPage.submissionFor:153` does `submissions.find(...)`, so the checklist shows
  whichever row comes back first — the stale Verified one or the new Pending one, unpredictably.
- Compliance counts now double-count the requirement.

There is a second inconsistency in the same block: with `AllowReplaceVerified = false`, a
**staff** upload skips the first guard but is caught by the second, so the flag intended to
exempt staff does not.

**Fix:** make the replace path *replace* — supersede or delete the old row, delete its file,
and write a `DocumentStatusHistory` entry recording the supersession. Then add the missing
unique index (§2.13) so the invariant is enforced by the database rather than by three `if`s.

### 2.6 🟠 Staff document upload is implemented server-side and has no way to be called

`DocumentsController.Upload` branches on `isStaffUpload` five times (`:118`, `:137`, `:205`,
`:212`, `:217`) to let staff bypass the profile gate, replace verified documents, and backfill
past periods on a scholar's behalf. But:

- The action takes **no `scholarId` parameter** — line 117 is
  `var scholarId = User.FindFirstValue(ClaimTypes.NameIdentifier)!`.
- `uploadDocument` in `api/documents.js:30` has no scholar argument, and its only caller is
  `MyDocumentsPage.jsx:170` (the scholar's own page).

So a staff upload would file the document **under the staff member's own account**, and there
is no UI that even attempts it. Either finish the feature (add `scholarId`, authorise it,
surface it on `ScholarDetailPage`) or delete the five dead branches — right now the code
reads as though a capability exists that does not.

### 2.7 🟠 The recurring-releases feature is unreachable, and invisible to scholars

Two separate gaps around the same 593-line page:

**Staff cannot navigate to it.** `grep -n "scholarship-releases" src/components/Layout.jsx`
returns nothing. `navByRole` has no entry for it in `Administrator`, `ScholarshipCoordinator`,
or `Scholar`. The route exists (`App.jsx:69`), the API exists, the page exists — it is
reachable only by typing the URL.

**Scholars cannot see their own payouts.** `GET /api/scholarship-releases/scholar/{id}` is
documented as *"Backs the ledger on a scholar's detail page"* and deliberately authorises
scholars (`:194`), but `grep -rn "scholarshipReleases" src/` shows the API module is imported
**only** by the staff-guarded `ScholarshipReleasesPage`. `ScholarDetailPage` imports
`oneTimeGrants` and not releases. So `PATCH /{id}/release` sends the scholar
*"Your scholarship has been released"* linking to `/my-profile` — a page that shows one-time
grants and says nothing about the release they were just told about.

**Fix:** add the sidebar entry for staff, and a Releases card on `ScholarDetailPage` beside
the existing `OneTimeGrantsCard`.

### 2.8 🟡 One reminder per deadline, and nothing at all when one is missed

`DeadlineReminderService.cs:78` sets `RemindersSentAt = now` after the first send, and line 52
filters on `RemindersSentAt == null`. So each deadline produces exactly one notification, ever,
`DeadlineReminderDays` before it falls due (default 3). After that:

- no escalation as the date closes in;
- **no "you missed this" notice** when `DueDate` passes with no submission;
- no digest to staff about who is non-compliant for the period.

For a compliance system this is the highest-value functional gap remaining. `RemindersSentAt`
would need to become a count or a set of sent stages.

### 2.9 🟡 The "Email me about deadlines" preference does nothing

`grep -rn "EmailDeadlines" --include=*.cs` — the field is declared
(`ApplicationUser.cs:48`), exposed in `UserDto`, written by
`AuthController.cs:231`, and migrated. **No code ever reads it**, because
`DeadlineReminderService` only calls `notifications.CreateForManyAsync` and never
`IEmailService`. Its two siblings are honoured: `EmailDocumentStatus` at
`DocumentsController.cs:389` and `:450`, `EmailAnnouncements` at `AnnouncementDelivery.cs:79`.

The scholar sees a toggle on My Profile, turns it on, and no deadline email is ever sent —
exactly the failure mode `SystemSettings.cs:14` warns about: *"A settings row that nothing
reads is worse than no setting at all, because it tells the administrator a lie."*

**Fix:** send the deadline email from the reminder service behind the flag, or remove the
toggle. Sending is the better answer — the email template infrastructure is already there.

### 2.10 🟡 Background email pattern applied in two places, skipped in two

`MessagesController.cs:292` documents the correct approach and follows it:

```csharp
// Runs after the response returns — use a fresh scope, not the request-scoped emailService.
using var scope = scopeFactory.CreateScope();
var scopedEmail = scope.ServiceProvider.GetRequiredService<IEmailService>();
```

`AnnouncementDelivery.cs:115` does the same. But `DocumentsController` still fires the
request-scoped instance at `:268`, `:391`, and `:451`, and `ScholarApprovalsController` at
`:273`. Those calls survive today only because `EmailService` happens to hold no scoped state
— it takes `IOptions`, `ILogger`, and `IServiceScopeFactory`. Add one `DbContext` field to
`EmailService` and four call sites start throwing `ObjectDisposedException` under load.

Compounding it: `SendMessageAsync` **rethrows** after its third failed attempt
(`EmailService.cs:63`), and every one of these call sites is `_ = ...`, so the exception is
never observed. The old backlog marks *"Email send failures are silently swallowed with no
retry or admin visibility"* as done — the retry and the logging landed, the visibility did not.
There is still no way for an admin to see that mail is failing without reading server logs.

### 2.11 🟡 Grades can be duplicated, cannot be corrected, and go stale

`ScholarProfilesController.AddGrade:432`:

- **No uniqueness check** on `(ScholarProfileId, AcademicYear, Semester)`. Record a GWA
  twice for the same semester and both rows persist. Every compliance figure in the system
  then depends on `OrderByDescending(AcademicYear).ThenByDescending(Semester).First()` —
  which is **non-deterministic between two rows in the same period**. `MeetsRequirement`
  can flip between page loads. This drives `ScholarProfilesController.Map:487`,
  `AnalyticsController.Overview:27-32`, and the compliance filter at `:59`.
- **There is no PATCH or DELETE for a grade.** A mistyped GWA can only be "fixed" by adding
  another row — which triggers the ambiguity above.
- `MeetsRequirement` is computed once at insert (`:450`) against the scholarship's
  `MinimumGwa` at that moment. Change the type's `MinimumGwa`, or transfer the scholar to a
  different scholarship, and every historical row keeps the old verdict with nothing to
  recompute it.

**Fix:** unique index on the period, a PATCH that rewrites the row and audits the change, and
either recompute `MeetsRequirement` on read or store the threshold that was applied.

### 2.12 🟡 A file is deleted before the row that points at it is committed

`DocumentsController.Delete:508`:

```csharp
await storage.DeleteAsync(submission.StoredFileName);   // file gone
db.DocumentSubmissions.Remove(submission);
await db.SaveChangesAsync();                            // may fail
```

If `SaveChangesAsync` throws, the submission row survives pointing at a file that no longer
exists. Preview and download then return *"File not found on server."* forever, with no way
to clear it from the checklist. Swap the order — an orphaned file is recoverable, a row
pointing at nothing is not.

**Related orphan:** `UsersController.Delete:244` cleans up the avatar and nothing else.
Deleting a scholar cascades their `DocumentSubmissions` rows away and leaves **every uploaded
file** on disk with no database reference. Over a few graduating cohorts that is the bulk of
the upload directory, unreferenced and un-purgeable.

### 2.13 🟡 Invariants documented in comments but not indexed in the database

`ApplicationDbContext.OnModelCreating` indexes the rules it cares about well —
single-active-scholarship (`:219`, filtered unique), one deadline per period (`:170`), one
payout per period (`:286`). Two rules of equal weight are missing:

- **`ScholarProfile.StudentId` has no unique index.** Uniqueness is checked in application
  code at `ScholarProfilesController.cs:360`, which races: two concurrent `PUT`s with the same
  student number both pass the check and both commit. This is precisely the corruption that
  the *Scholarship Check* report (`:178`) exists to **detect** — the report is a workaround
  for a missing constraint. One `.IsUnique()` and the report has one less finding to make.
- **`DocumentSubmission` has no unique index** on
  `(ScholarId, RequirementId, AcademicYear, Semester)`, and no index at all on `ScholarId`
  or `Status` — the largest table in the system, scanned by analytics, the deadline report,
  and the per-scholar checklist. Adding the unique index also closes §2.5 at the storage layer.

`AuditLog` likewise has no index on `(UserId, Timestamp)` while `ActivityLogPage` pages over
it by date.

### 2.14 🟡 A mistyped URL signs you out

`App.jsx:85`:

```jsx
<Route path="*" element={<Navigate to="/login" replace />} />
```

A signed-in user who hits any unknown path is sent to the login screen — which, since they
still hold a valid token, reads as though their session dropped. Send authenticated users to
`/dashboard` or a real 404 page; only send anonymous ones to `/login`.

**Same file:** `/my-profile` (`:70`) renders `ScholarDetailPage` for *any* authenticated
role. An admin or coordinator landing there triggers `getScholarProfile(user.id)` for an
account with no scholar profile → *"Scholar profile not found."* Restrict it to `['Scholar']`.

### 2.15 🟢 Dead injected dependency (the one build warning)

```
MessagesController.cs(21,23): warning CS9113: Parameter 'emailService' is unread.
```

Left behind when the email send moved to the scoped helper at `:292`. Delete the parameter —
it is the only code warning in the build and worth keeping the build at zero.

---

## Part 3 — Security

### 3.1 🔴 Four high-severity dependency advisories, two of them in production

`npm audit` in `psueiskolarsystem.client`:

| Package | Advisory | Reaches prod? | Fix |
|---|---|---|---|
| `react-router` / `react-router-dom` 7.18.0 | RSC-mode CSRF bypass — action executes before the 400 (`GHSA-qwww-vcr4-c8h2`) | **Yes** | `npm audit fix --force` → downgrades to 7.11.0 (breaking) |
| `postcss` ≤ 8.5.17 | Path traversal via `sourceMappingURL` → arbitrary `.map` disclosure (`GHSA-r28c-9q8g-f849`) | Build only | `npm audit fix` |
| `brace-expansion` | DoS via exponential expansion | Build only | `npm audit fix` |

The two build-time ones are a clean `npm audit fix`. React Router needs a decision: the RSC
CSRF path is not exercised by this app (no RSC mode, no router actions), so the practical risk
is low — but it is a **high** advisory sitting in the production bundle and it will show up in
any security review of the capstone. Either pin 7.11.0 or wait for a patched 7.x and record
the decision. **CI does not run `npm audit`**, so nothing surfaces this on its own.

### 3.2 🟠 JWT in `localStorage`, no refresh, no revocation

`AuthContext.jsx:18` reads the token from `localStorage`; every API module puts it in an
`Authorization` header. Consequences:

- Any XSS anywhere in the app reads the token directly. An `httpOnly` cookie would not be
  readable — though it needs CSRF protection in exchange.
- **No revocation.** Deactivating a user (`IsActive = false`) is checked only at
  `LoginAsync:37`. A token already issued keeps working for its full 60 minutes: a
  just-deactivated account, a just-rejected scholar, a demoted coordinator all retain their
  access until expiry. Nothing checks `IsActive` or `ApprovalStatus` per request.
- Role changes carry the same lag — the role is baked into the token claim at `:427`.

**Fix (cheapest first):** validate `SecurityStamp` on token validation, or add a short
`IsActive`/stamp check to the JWT bearer `OnTokenValidated` event. The refresh-token item on
the old backlog would address expiry at the same time.

### 3.3 🟠 A scholar can rewrite their own student ID and year level after approval

`ScholarProfilesController.Upsert:344` authorises `currentUserId == userId` and then applies
**every** field from the DTO, including `StudentId`, `ProgramId`, and `YearLevel`. Once the
office has approved a scholar against a student number, that scholar can change it to any
unused value. `StudentId` also has no format validation — any string up to 30 characters.

**Fix:** after approval, treat `StudentId` and `ProgramId` as staff-only; let scholars keep
editing contact number, address, and birth date. Add a format check for the campus's student
number pattern.

### 3.4 🟡 No app-level CSP; `AllowedHosts: "*"`

`DocumentsController.Preview:308` sets a tight CSP on served files — good, and it is the
right place. But the application shell itself ships no CSP, no `X-Frame-Options`, and no
`Referrer-Policy`. Combined with §3.2 (token in `localStorage`) that is the whole XSS
mitigation story missing. `appsettings.json:8` also leaves `AllowedHosts` as `*`, so the
deployment accepts any `Host` header.

### 3.5 🟡 Data-subject export is not audited

`ScholarProfilesController.ExportData:294` returns a scholar's full personal record — account,
profile, grades, document history. It is correctly access-controlled, but **`db.Audit` is
never called**, so nothing records that the export happened. Every neighbouring action audits
itself (`Upsert:393`, `AddGrade:464`, `SetLifecycle:283`). Under RA 10173 a subject-access
disclosure is exactly the event that ought to leave a trace — especially given staff can
invoke it for *any* scholar.

### 3.6 🟢 Rate-limit policies are declared but the endpoint coverage is worth re-checking

`Program.cs:149-173` defines `auth` (10/min/IP) and `emailcheck` (20/min/IP), and
`UseRateLimiter()` is wired at `:205`. Worth confirming `[EnableRateLimiting("auth")]` is
actually applied to `login`, `forgot-password`, `register-scholar`, **and**
`resend-verification` — an unlimited resend endpoint is a mail-bomb amplifier pointed at a
third party's inbox.

---

## Part 4 — Performance

### 4.1 🟠 The dashboard fires eleven API calls to render one page

`DashboardPage.jsx` calls `getAnalyticsOverview`, `getScholars`, `getSubmissions`,
`getRequirements`, `getUsers`, `getAnnouncements`, `getDeadlines`, `getRecentActivity`,
`getPendingApprovalCount`, `getOneTimeGrantSummary`, and `getActiveSemester`. Each is a
separate round trip with its own auth, its own EF queries, and its own failure mode. On a
campus connection that is the slowest screen in the system, and it is the **first** screen
every user sees.

**Fix:** one `GET /api/dashboard?role=` that assembles the role's payload server-side. It also
removes the partial-failure states where four cards load and three show errors.

### 4.2 🟡 `Overview` and the release list issue an aggregate per number

`AnalyticsController.Overview` runs **nine** sequential round trips (`:24`, `:27`, `:30`,
`:36`, `:44`, `:55`, `:70`, `:71`, `:72`, `:73`, `:76`). The `compliant` / `nonCompliant`
counts at `:27` and `:30` each run a correlated `ORDER BY` over `AcademicGrades` per profile.
The four submission counts at `:70-73` are one `GROUP BY` away from being a single query.

`ScholarshipReleasesController.GetAll:72-76` does the same thing — `CountAsync`, `SumAsync`,
a filtered `SumAsync`, and another `CountAsync` over the same predicate, four round trips for
four numbers.

Both predate the (already-completed) work to push analytics counts into SQL; they were pushed
down but not consolidated.

### 4.3 🟡 The verification report loads every profile and every assignment into memory

`ScholarProfilesController.GetScholarshipVerification:166-173`:

```csharp
var profiles    = await db.ScholarProfiles.Include(...).ToListAsync();     // all of them
var assignments = await db.ScholarshipAssignments.Include(...).ToListAsync(); // all of them
```

then groups and cross-checks in C#. This is the same shape as the `GET /api/users` and
`AnalyticsController.Overview` problems already fixed in the previous round — it just was not
caught because the page is newer. At a few hundred scholars it is fine; it does not degrade
gracefully.

### 4.4 🟡 Bulk email opens one SMTP connection per recipient

`EmailService.SendMessageAsync:45-49` constructs a fresh `SmtpClient`, connects,
authenticates, sends one message, and disconnects — **per email**. It also opens a scope and
queries `SystemSettings` per email (`:26-37`). An announcement to 400 scholars is 400 TLS
handshakes, 400 authentications, and 400 identical settings queries, against a Gmail relay
that rate-limits. Batch the sends over one connection and read the policy once per batch.

---

## Part 5 — Code quality

### 5.1 🟠 68 lint problems, and CI never runs the linter

`npx eslint .` → **48 errors, 20 warnings**. `package.json` has `"lint": "eslint ."`;
`.github/workflows/ci.yml` runs `npm ci && npm run build` and never calls it.

| Count | Rule |
|---|---|
| 31 | `react-hooks/set-state-in-effect` |
| 19 | `react-hooks/exhaustive-deps` |
| 7 | `react-refresh/only-export-components` |
| 4 | `react-hooks/immutability` |
| 3 | `react-hooks/purity` |
| 3 | `no-unused-vars` |

Worst offenders: `DashboardPage` (7), `DocumentReviewPage` (5), `AnalyticsPage` (4),
`UsersPage` (4). The 31 `set-state-in-effect` errors are the same load-in-effect pattern
repeated across every list page, and they are why several pages double-fetch on mount.
`UsersPage.jsx:80` even carries an `eslint-disable-next-line` that the linter reports as
**unused** — it is suppressing nothing while the real error goes unreported.

**Fix:** add `npm run lint` to CI (as a warning gate first so the build does not go red on
day one), then work the count down page by page.

### 5.2 🟠 811 hardcoded hex colours in JSX — this is why dark mode keeps regressing

Counted across `src/**/*.jsx`:

| | Count |
|---|---|
| `style={{` blocks | **1,343** |
| Hardcoded `#rrggbb` in JSX | **811** |
| `var(--…)` token references | 627 |

More colour decisions bypass the theme tokens than use them. `tobeaddedfunctionsandfixes.md`
records *three separate* dark-mode fix passes, all ticked — and they will keep coming back,
because each pass fixes the components someone happened to look at while the next new card
hardcodes `#fff` again. `MyDocumentsPage.jsx:15-19` is a clean example: `STATUS_STYLE` maps
statuses to Tailwind `bg-amber-100 text-amber-700` literals with no dark variant.

There are also 12 `onMouseEnter` handlers that mutate `style` imperatively
(`Layout.jsx:103-110`) — hover state that cannot be themed by a media query and that a
re-render silently discards.

**Fix:** this is a real refactor, not a tidy-up, so scope it deliberately: extract the
recurring surfaces (status badge, stat tile, card, filter control) into components backed by
CSS custom properties, and convert pages one at a time. Until then every dark-mode bug report
is treating a symptom.

### 5.3 🟡 Zero controller tests — 64 tests, all on helpers

`PSUEISKOLARSystem.Server.Tests` holds 11 files: `AcademicPeriodTests`, `DeadlineHelperTests`,
`DeadlineHelperBatchTests`, `ScholarshipRegistryTests`, `SlotQuotaTests`,
`RequirementOrderingTests`, `NotificationMutingTests`, `DatabaseExporterTests`,
`ApiVersioningTests`, `AnalyticsOverviewTests`, `TestDb`. All 64 pass. Every one of them
tests a **helper**.

Nothing tests a controller action. In particular nothing covers:

- `DocumentsController.Upload` — nine sequential guards, the most branching logic in the
  codebase, and the location of §2.5.
- `AuthService.LoginAsync` — the lockout counter, the configurable threshold, maintenance
  mode, the 2FA ticket.
- `ScholarshipReleasesController` — the money path, including the immutability rules that are
  the whole point of the design.

The helper tests are good and worth keeping. Add `WebApplicationFactory` tests for those three
and the coverage matches the risk.

### 5.4 🟡 Controllers still return anonymous objects

Carried over from the old backlog and still true. Counting `return Ok(new { … })`: the pattern
dominates `DocumentsController`, `ScholarProfilesController`, `AnalyticsController`, and
`AnnouncementsController`. `ScholarshipReleasesController` shows the better way — a
`ReleaseRow` record used as a shared EF projection (`:487`) — and `DTOs/` already holds
`Auth`, `Scholars`, and `Users` folders. Swagger currently documents most response bodies as
untyped objects.

### 5.5 🟡 22 hand-rolled API modules, one duplicated `fetch` each

`src/api/*.js` is 1,400 lines in which nearly every function repeats:

```js
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error('Failed to load X.');
return res.json();
```

`_error.js` already provides `errorMessage(body, fallback)` for parsing `{ message }` and
ASP.NET validation bodies — and most modules do not use it, throwing a hardcoded string
instead and discarding the server's actual message. This is the same wrapper that §2.1
requires; doing it once fixes the 401 handling, the discarded error messages, and the
duplication together. **Highest-leverage refactor in the client.**

### 5.6 🟢 Period-comparison logic implemented twice

`ScholarProfilesController.IsLaterPeriod:473` reimplements a period comparison by parsing the
leading year out of `"YYYY-YYYY"` — while `Data/AcademicPeriod` already provides `TryParse`,
ordering operators (used at `DocumentsController.cs:180`), and `SortKey` (used at
`ScholarshipReleasesController.cs:235`). The local version also fails open: if the string does
not parse it returns `false`, so an unparseable academic year silently passes the guard.
`AnalyticsController.cs:95` sorts periods by raw string too, where `SortKey` exists for it.

---

## Part 6 — Process

### 6.1 🟠 73 uncommitted paths, including whole untracked features

`git status --short | wc -l` → **73**, of which 19 are untracked (`??`) new files. Entire
features exist only in the working tree:

- `Controllers/ScholarshipReleasesController.cs`, `Models/ScholarshipRelease.cs`,
  `pages/ScholarshipReleasesPage.jsx`, `api/scholarshipReleases.js`
- `Controllers/SystemSettingsController.cs`, `Models/SystemSettings.cs`,
  `Data/SystemSettingsStore.cs`, `components/SystemPolicyPanel.jsx`
- Two migrations: `AddScholarshipFrequencyReleasesAndGrantTypes`, `AddSystemSettings`
- `Data/ScholarOnboarding.cs`, `Services/NotificationRetentionService.cs`,
  `components/ScholarSearchSelect.jsx`

**One `git clean` or a bad merge and the release-tracking feature, the entire System Settings
subsystem, and two migrations are gone.** CI has never seen any of it. Commit in logical
slices before anything else on this list — this is the only item here that can lose work.

### 6.2 🟡 CI builds and tests but does not lint or audit

`.github/workflows/ci.yml` is well formed: client build, server build, server test on push and
PR. Three additions are nearly free — `npm run lint` (§5.1), `npm audit --audit-level=high`
(§3.1), and `dotnet build -warnaserror` once §2.15 is cleared (`CS9113` is the only warning
standing between the server and a clean build).

### 6.3 🟢 Accessibility has not been started

Measured across `src/`:

| | Count |
|---|---|
| `<input>` elements | **97** |
| `htmlFor` label associations | **1** |
| `aria-*` attributes | 31 |
| Files handling `onKeyDown` | 4 of 47 |

96 of 97 inputs have no programmatic label, so a screen reader announces them as unlabelled
edit fields. Custom controls — `ScholarSearchSelect`, the sidebar, the modals, the bell
dropdown — are largely mouse-only. For a public-university system this is likely a stated
NFR; it is currently unaddressed rather than partially addressed. Start with `htmlFor`/`id`
pairs on the forms scholars must complete (Register, My Profile, upload), then keyboard
handling on `Modal` and `ScholarSearchSelect`.

---

## Suggested order of work

**Do first — risk of losing work or live breakage**

1. §6.1 Commit the untracked features. Nothing else matters if this is lost.
2. §2.1 Shared `apiFetch` with 401 → sign-out. Fixes the worst user-visible defect and
   sets up §5.5. Fix the hardcoded "30 minutes" in the same pass.
3. §3.1 `npm audit fix` for postcss and brace-expansion; decide on React Router.
4. §2.2 One source of truth for upload policy. A `.webp` upload is broken today.

**Then — correctness**

5. §2.5 + §2.13 Fix the verified-replace fall-through and add the two unique indexes.
6. §2.3 + §2.4 Make `LifecycleStatus` and `ApprovalStatus` gate slots, releases, and reminders.
7. §2.7 Sidebar entry for releases; releases card on the scholar's profile.
8. §2.11 Grade uniqueness + an edit endpoint.
9. §2.12 Reorder the delete; purge files when a user is deleted.
10. §2.9 Send the deadline email, or drop the toggle.
11. §2.14 + §2.15 404 routing, `/my-profile` role guard, the `CS9113` parameter.

**Then — hardening and quality**

12. §3.2 Per-request `IsActive` / security-stamp validation.
13. §3.3 Lock `StudentId` after approval. §3.5 Audit the data export.
14. §6.2 Lint + audit in CI. §5.1 Work the lint count down.
15. §4.1 One dashboard endpoint.
16. §5.3 Controller tests for Upload, Login, and the release path.
17. §2.8 Deadline escalation and missed-deadline notices.

**Longer arc — schedule deliberately, not opportunistically**

18. §5.2 The 811 hardcoded colours. Until this is done, dark mode will keep regressing.
19. §6.3 Accessibility, starting with form labels.
20. §5.4 Response DTOs. §4.2–§4.4 Query consolidation and SMTP batching.
