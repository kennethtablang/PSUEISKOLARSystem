---
tags: [feature]
---
# Announcements & Notifications

Two related delivery channels. Related: [[Backend Architecture]] · [[Data Model]] · [[Messaging & Search]]

## Announcements
- Staff post `Announcement`s with title, content, optional **image** (PNG/JPG/WEBP ≤10 MB, recommended 1200×400), **expiry**, and an **intended action** button.
- **Targeting:** by role / scholarship type / program (~~campus removed~~). Untargeted = all users.
- **Intended actions** (`AnnouncementIntents`, validated server-side): `SubmitDocuments` → /my-documents, `UpdateProfile` → /my-profile, `ContactCoordinator` → /messages.
- Validation: past `ExpiresAt` warns it will hide immediately.
- Delivery: on create, targeted scholars get an in-app notification (awaited) + an email (fire-and-forget in a **fresh DI scope**, opt-in).
- Shared `AnnouncementCard` component: `feed` variant (dashboard, CTA button) and `manage` variant (announcements page, edit/delete). *Not yet built:* future-date scheduling.

## Notifications
- `Notification` rows pushed in real time via **SignalR** (`NotificationService` → `Clients.User(id)`), surfaced by `NotificationBell` + `NotificationsPage`.
- **Categories** (`NotificationCategories`, mirrored in `constants/notifications.js`): `DocumentStatus`, `Announcement`, `Deadline`, `Message` (+ `Account`).
- Actions: mark read, **mark unread**, **delete** individual, mark-all-read; unread badge.

## Email
- `EmailService` (MailKit). Central `SendMessageAsync` with **3× retry + logging** (failures were previously swallowed silently).
- Per-user email preferences: announcements / document-status / deadlines (Profile page).
- Templates + SMTP currently in `appsettings` (UI config is a future item).

## Realtime plumbing
`NotificationHub` (`[Authorize]`). Staff join a **`staff` group**; `BroadcastAsync("AnalyticsChanged")` targets only that group (scholars excluded). Client subscribes via `NotificationContext`.
