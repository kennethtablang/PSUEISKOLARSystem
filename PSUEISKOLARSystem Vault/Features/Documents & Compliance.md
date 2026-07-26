---
tags: [feature, domain]
---
# Documents & Compliance

The core scholarship-management loop. Related: [[Data Model]] · [[Analytics & Reports]] · [[Announcements & Notifications]]

## Requirements & scholarship types
- Admins define **`DocumentRequirement`s** (name, required?, sample image) and **`ScholarshipType`s** (min GWA, category).
- A requirement is linked to types via `ScholarshipTypeRequirement`.
- **Bulk-assign:** from a requirement you can assign it to **many scholarship types at once** (Requirements page → "Assign Types").
- **Applicability rule** (`DeadlineHelper`): a scholar sees a requirement if they have **no type**, OR their type has **no configured links**, OR their type is **explicitly linked** to it.

## Submission & review
- Scholars upload per requirement for the **active (AcademicYear, Semester)** — `MyDocumentsPage`. Client validates type/size before upload; server enforces size + extension + **magic bytes**.
- Status: **Pending → Verified / Incomplete** (with feedback note). Coordinators review one-by-one or **in bulk** (`DocumentReviewPage`); marking Incomplete requires feedback.
- History tracked in `DocumentStatusHistory`.
- Status changes fire a [[Announcements & Notifications|notification]] + email (category `DocumentStatus`).

## Deadlines
- `SubmissionDeadline` per requirement per period (`DeadlinesPage`).
- **Deadline report:** per-requirement on-time / late / missing counts. Uses **batched** applicable-scholar + submission lookups (fixed an N+1). Covered by `DeadlineHelperBatchTests`.
- `DeadlineReminderService` (background) emails reminders as due dates approach.

## GWA compliance
- Grades recorded per period (`AcademicGrade`); **latest** grade's `MeetsRequirement` (vs the type's `MinimumGwa`) determines compliance.
- Grades **cannot be recorded for a period later than the active semester** (validated server-side).
- Scholar dashboard shows a **document-compliance progress bar** + a prominent **next-action nudge** when documents are incomplete/missing.

## Files
- `LocalFileStorageService` stores under `FileStorage:BasePath` with GUID names; 10 MB cap; allowed: PDF/JPG/JPEG/PNG/WEBP/DOC/DOCX.
- Announcement & requirement-sample images share `ImageFileTypes` (extensions + content-type). Recommended announcement banner: **1200×400 (3:1)**.
