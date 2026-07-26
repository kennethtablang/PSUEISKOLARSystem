---
tags: [overview, domain]
---
# User Roles & Permissions

Three roles, stored via ASP.NET Identity roles and carried in the JWT as a `ClaimTypes.Role` claim. Constants live in `Models/Enums/UserRoles.cs`.

Related: [[Project Overview]] · [[Authentication & Security]] · [[API Reference]]

## Roles
| Role | Constant | Scope |
|---|---|---|
| **Administrator** | `Administrator` | Full system: user management, settings, audit log, everything coordinators can do |
| **Scholarship Coordinator** | `ScholarshipCoordinator` | Review documents, monitor scholars, deadlines, announcements, analytics |
| **Scholar** | `Scholar` | Self-service: own profile, document upload, messaging, notifications |

## What each can access (frontend nav — `components/Layout.jsx`)
- **Administrator:** Dashboard, Scholars, Document Review, Deadlines, Scholarship Types, Requirements, Users, Announcements, Messages, Data Visualization, Settings, Activity Log, Help.
- **Coordinator:** Dashboard, Scholars, Document Review, Deadlines, Announcements, Messages, Data Visualization, Help.
- **Scholar:** Dashboard, My Documents, Messages, My Profile, Help.

## Authorization patterns
- Controllers use `[Authorize(Roles = ...)]`. "Staff" = Administrator **or** Coordinator.
- Route protection on the client via `components/ProtectedRoute.jsx` (`roles` prop).
- Coordinators were historically **campus-scoped**; with the single-campus move this scoping is being retired (see [[Roadmap & Status]]).
- The [[Analytics & Reports#Real-time|AnalyticsChanged]] SignalR broadcast is scoped to a **staff group** so scholars aren't notified.

## Notable per-role behaviors
- **Admin-only:** create/edit/delete users, trigger a password reset for a user, full [[Analytics & Reports#Activity log|Activity Log]] + export, seed sample data, active-semester config.
- **Staff:** [[Messaging & Search#Global search|global search]], recent-activity feed, deadline report.
- **Scholar:** [[Authentication & Security#Onboarding gate|onboarding gate]] forces profile setup on first login; download own data (Data Privacy Act).
