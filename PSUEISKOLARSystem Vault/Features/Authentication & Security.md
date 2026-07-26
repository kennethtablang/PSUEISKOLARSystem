---
tags: [feature, security]
---
# Authentication & Security

Backend: `AuthController` + `AuthService`. Client: `LoginPage`, `RegisterPage`, `ResetPasswordPage`, `VerifyEmailPage`, `AuthContext`. Related: [[User Roles & Permissions]] · [[Backend Architecture]]

## Auth flows
- **Login** → JWT (role claim). 30-min inactivity logout, now **configurable** (Settings → Preferences; stored per-browser).
- **2FA** (optional, email code): login returns a ticket → `login-2fa` verifies the code.
- **Email verification** on scholar self-register; **resend link** available on the login screen when unverified.
- **Forgot / reset password**; admins can **trigger a reset** for any user from User Management.
- **Live email-availability** check on registration (debounced).

## Hardening (done)
- **Account lockout:** 5 failed attempts → 15-minute cooldown (Identity lockout).
- **Rate limiting:** `auth` policy 10/min/IP on login, login-2fa, forgot-password; `emailcheck` 20/min on the availability probe.
- **Failed-login audit logging:** bad password / unknown / inactive / unverified / bad 2FA all recorded in `AuditLog`.
- **HSTS** in production + HTTPS redirect.
- **File upload validation:** extension + 10 MB size + **magic-byte signature** (PDF/JPG/PNG/WEBP/DOC/DOCX).
- **Password policy:** 8+ chars, upper/lower/digit/special; a shared `PasswordStrengthMeter` on register/reset/change forms.

## Gates (rendered above routes in `App.jsx`)
### Consent gate
`ConsentGate` — Data Privacy Act (RA 10173). Blocks until the user accepts the notice. **Version-aware:** re-prompts when `PrivacyNotice.CurrentVersion` / `privacy.js` bumps.

### Onboarding gate
`OnboardingGate` — new **scholars** with an incomplete profile (missing student ID / program / scholarship type) are prompted to set it up first (dismissible per session, re-prompts until complete).

### Session-expired
`SessionExpiredModal` — shown when the inactivity timer fires.

## Open / future
- "Remember me" / refresh-token (currently hard inactivity logout, no refresh). See [[Roadmap & Status]].
