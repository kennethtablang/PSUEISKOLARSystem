---
tags: [feature]
---
# Messaging & Search

Related: [[Announcements & Notifications]] · [[Backend Architecture]] · [[User Roles & Permissions]]

## Messaging
- Scholar ↔ coordinator threads, optionally scoped to a `DocumentRequirement` (`Message` entity, `MessagesController`, `MessagesPage`).
- **Real-time** append via SignalR (`ReceiveMessage`) + email notification (fresh DI scope, category `Message`).
- Thread list is **aggregated in SQL** (last-message time + unread counts per thread) rather than loading all messages — fixed a perf issue.
- **Mobile:** single-pane flow — thread list full-width → tap → conversation full-width with a back button; both panes side-by-side on desktop.
- Unread tracked separately for staff vs scholar (`ReadByStaff` / `ReadByScholar`).

## Global search (`GET /api/search`, staff-only)
- Live navbar dropdown (`GlobalSearch` component, debounced) across:
  - **Scholars** (name / email) → scholar detail,
  - **Announcements** (title / content) → announcements,
  - **Document requirements** (name) → requirements.
- Replaced the old scholars-only navbar search.
