---
tags: [architecture]
---
# Frontend Architecture

`psueiskolarsystem.client/src/` — React + Vite SPA. Related: [[Tech Stack]] · [[Conventions & Patterns]] · [[Backend Architecture]]

## Structure
- **`pages/`** — one component per route (23 pages).
- **`components/`** — shared UI: `Layout`, `ProtectedRoute`, `Pagination`, `ConfirmDialog`, `PasswordStrengthMeter`, `AnnouncementCard`, `AnnouncementImage`, `NotificationBell`, `Tutorial`, `ConsentGate`, `OnboardingGate`, `GlobalSearch`, `ListState` (skeletons/empty), `CollapsibleSection`.
- **`context/`** — see [[#Contexts]].
- **`api/`** — thin `fetch` wrappers per domain (auth, users, scholars, documents, announcements, notifications, messages, analytics, reports, deadlines, auditLog, search, lookups, settings, scholarshipTypes, campuses, userImport).
- **`constants/`** — shared constants: `notifications.js`, `privacy.js`, `ui.js`.
- **`hooks/`** — e.g. `useTitle`.

## Contexts
| Context | Provides |
|---|---|
| `AuthContext` | `user`, `token`, `signIn/signOut`, `refreshUser`, **configurable inactivity timeout** (`inactivityMin`), session-expiry |
| `NotificationContext` | unread counts, SignalR subscriptions (notifications, messages, analytics) |
| `ThemeContext` | light / dark / system |
| `TutorialContext` | `openTutorial()` for the [[#Guided tour]] |
| `UIContext` | `useToast()` + `useConfirm()` — app-wide toasts & confirm modals (replaced native `alert`/`confirm`) |

Provider order (in `App.jsx`): Theme → Router → Auth → Notification → Tutorial → **UI**. Gates rendered above routes: `SessionExpiredModal`, `ConsentGate`, `OnboardingGate`.

## Design system
- **Neomorphism** for cards/inputs, **Claymorphism** for buttons. Utility classes: `clay-card`, `clay-card-modal`, `clay-input`, `clay-btn` (`-primary`/`-ghost`/`-danger`/`-gold`), `clay-badge`, `clay-table-*`, `clay-progress-*`.
- **Brand:** PSU Blue `#003087`, Gold `#f5b800`.
- **Theming:** CSS variables in `index.css` (`--bg`, `--surface`, `--text-strong`, …) with `:root[data-theme="dark"]` overrides; `color-mix` for theme-aware stat tiles.
- **Motion:** route fade-in, spotlight tour, skeleton shimmer, `prefers-reduced-motion` guard.
- **Responsive:** `p-4 sm:p-8` page padding, `overflow-x-auto` table wrappers, single-pane mobile messaging.

## Guided tour
`Tutorial.jsx` is a **spotlight coach-mark**: it reads a target element via `data-tour="…"` (nav items + notification bell), dims the screen with a cutout around it, pulses a gold ring, and explains it in a bottom card. Falls back to a plain dim when the target is hidden (e.g. mobile drawer).
