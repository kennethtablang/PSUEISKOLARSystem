---
tags: [architecture, domain]
---
# Data Model

EF Core entities in `PSUEISKOLARSystem.Server/Models/`. Related: [[Backend Architecture]] · [[Documents & Compliance]] · [[User Roles & Permissions]]

## Core entities
| Entity | Key fields | Notes |
|---|---|---|
| `ApplicationUser` | FirstName/MiddleName/LastName, Email, IsActive, EmailConfirmed, TwoFactorEnabled, ConsentAcceptedAt, **ConsentVersion**, LastLoginAt, email prefs, ~~CampusId~~ | Identity user; role via Identity roles |
| `ScholarProfile` | UserId, **StudentId**, ProgramId, ScholarshipTypeId, YearLevel, **LifecycleStatus**, ContactNumber, BirthDate, Address, EnrolledAt | 1:1 with user; has many `AcademicGrade` |
| `AcademicGrade` | ScholarProfileId, AcademicYear, Semester, **Gwa**, **MeetsRequirement**, Remarks, RecordedById | Latest grade drives compliance |
| `ScholarshipType` | Name, Description, Category, **MinimumGwa** | m:n with requirements |
| `DocumentRequirement` | Name, Description, IsRequired, IsActive, SampleImagePath | The checklist items |
| `ScholarshipTypeRequirement` | ScholarshipTypeId, RequirementId | Junction table |
| `DocumentSubmission` | ScholarId, RequirementId, AcademicYear, Semester, **Status**, FileName, StoredFileName, ContentType, FileSizeBytes, SubmittedAt, ReviewedById, FeedbackNote | Status: Pending / Verified / Incomplete |
| `DocumentStatusHistory` | submission status change trail | |
| `SubmissionDeadline` | RequirementId, AcademicYear, Semester, DueDate | Per requirement per period |
| `Announcement` | Title, Content, TargetRole/~~TargetCampusId~~/TargetScholarshipTypeId/TargetProgramId, ExpiresAt, **IntentAction**, ImagePath, CreatedById | Targeted broadcasts |
| `Notification` | RecipientId, Title, Message, **Category**, LinkUrl, IsRead, ReadAt | In-app feed |
| `Message` | ScholarId, RequirementId, SenderId, Body, ReadByStaff, ReadByScholar | Scholar↔coordinator threads |
| `AuditLog` | UserId, Action, Details, TimestampUtc | No FK on UserId (allows "(unknown)" for failed logins) |
| `ActiveSemester` | AcademicYear, Semester, UpdatedByName | Single active period config |
| `AcademicProgram` | Name, Code | Lookup |
| `Campus` | Name | **Being removed** (single-campus) — see [[Roadmap & Status]] |

## Key relationships
- `ApplicationUser` 1—1 `ScholarProfile` 1—* `AcademicGrade`.
- `ScholarshipType` *—* `DocumentRequirement` via `ScholarshipTypeRequirement`.
- A requirement "applies" to a scholar if: the scholar has **no type**, OR the type has **no configured links**, OR the type is **explicitly linked** to it (see `DeadlineHelper`, [[Documents & Compliance]]).
- `DocumentSubmission` links a scholar (`ScholarId`) to a `DocumentRequirement` for an (AcademicYear, Semester).

## Enums / constants (`Models/Enums/`)
`UserRoles`, `DocumentStatus`, **`NotificationCategories`** (DocumentStatus / Announcement / Deadline / Message), **`AnnouncementIntents`** (SubmitDocuments / UpdateProfile / ContactCoordinator), `PrivacyNotice.CurrentVersion`. Mirrored client-side in `src/constants/`.
