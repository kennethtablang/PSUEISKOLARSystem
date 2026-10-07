# PSUEISKOLARSystem

## Setting up a fresh clone

### Email (verification, password reset and notifications)

The Gmail login used to send email is included in
`PSUEISKOLARSystem.Server/appsettings.json`, so a fresh clone sends email with no extra
setup.

If the app password is ever revoked or changed, create a new one in the Gmail account
(Google Account → Security → App passwords) and update `EmailSettings:Password` there.
A value set with `dotnet user-secrets set "EmailSettings:Password" "..."` overrides the
file on that machine only. The server logs a warning at startup when the login is blank.

To confirm it works, sign up a test account: the server console should show
`Email 'Verify Your PSU e-Iskolar Account' to ... accepted by relay`. A
`Background email failed` line instead means the credentials are wrong or revoked.
