---
tags: [overview, reference]
---
# Glossary

Related: [[Project Overview]] · [[Data Model]] · [[Documents & Compliance]]

- **PSU** — Pangasinan State University. This system targets the **Lingayen Campus** (main).
- **e-Iskolar** — "Iskolar" = scholar (Filipino); the product name.
- **Scholar** — a student scholarship recipient; the primary self-service [[User Roles & Permissions|role]].
- **Coordinator** — Scholarship Coordinator / staff who review and monitor.
- **GWA** — General Weighted Average (grade). Compared against a scholarship type's **`MinimumGwa`**; note **lower is better** (1.00 highest, 5.00 lowest).
- **Compliance** — a scholar is compliant when their **latest GWA** meets the requirement **and** required documents are Verified.
- **Requirement** — a `DocumentRequirement` (e.g. COR, ID) a scholar must submit.
- **COR** — Certificate of Registration (a common document).
- **Scholarship type** — a program category (`ScholarshipType`) with its own min GWA and required-document set.
- **Active semester** — the current `(AcademicYear, Semester)` the whole system operates on (`ActiveSemester`).
- **Lifecycle status** — a scholar's standing (e.g. Active / Lapsed / Suspended) on `ScholarProfile`.
- **Intended action** — an optional CTA on an [[Announcements & Notifications|announcement]] (`AnnouncementIntents`).
- **Staff** — Administrator or Coordinator (used for authorization + the SignalR staff group).
- **Data Privacy Act (RA 10173)** — Philippine law; drives the [[Authentication & Security#Consent gate|consent gate]].
- **SRS** — Software Requirements Specification (`src/assets/PSU_eIskolar_Requirements_Specification_v2.md`).
- **NFR / FR** — Non-Functional / Functional Requirement (from the SRS).
