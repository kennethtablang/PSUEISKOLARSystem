using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// System-wide policy: upload limits, submission rules, registration and lockout policy,
    /// reminder timing, and maintenance mode. Administrator-only, and every save is audited —
    /// these settings change behaviour for every user at once.
    /// </summary>
    [ApiController]
    [Route("api/system-settings")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class SystemSettingsController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Get() => Ok(Shape(await SystemSettingsStore.GetAsync(db)));

        /// <summary>
        /// The handful of settings the client needs outside an admin session: maintenance mode
        /// and its message for the sign-in page, the default session timeout, and the upload
        /// policy the file picker has to agree with. Without the last two the client would
        /// hardcode its own copy and drift from the server's — it did, and refused perfectly
        /// valid .webp files. Anonymous by necessity; it exposes nothing else.
        /// </summary>
        [HttpGet("public")]
        [AllowAnonymous]
        public async Task<IActionResult> Public()
        {
            var s = await SystemSettingsStore.GetAsync(db);
            return Ok(new
            {
                s.MaintenanceMode,
                s.MaintenanceMessage,
                s.SessionTimeoutMinutes,
                s.MaxUploadMb,
                s.AllowedFileExtensions,
            });
        }

        [HttpPut]
        public async Task<IActionResult> Update(SystemSettingsRequest dto)
        {
            var error = Validate(dto);
            if (error is not null) return BadRequest(new { message = error });

            var settings = await db.SystemSettings.FirstOrDefaultAsync();
            var isNew = settings is null;
            settings ??= new SystemSettings();

            // Recorded before the overwrite so the audit entry can name what actually changed
            // rather than just saying "settings updated".
            var changes = Diff(settings, dto);

            settings.MaxUploadMb = dto.MaxUploadMb;
            settings.AllowedFileExtensions = NormaliseExtensions(dto.AllowedFileExtensions);
            settings.AllowLateSubmissions = dto.AllowLateSubmissions;
            settings.AllowReplaceVerified = dto.AllowReplaceVerified;
            settings.RequireProfileBeforeSubmission = dto.RequireProfileBeforeSubmission;
            settings.AutoApproveScholars = dto.AutoApproveScholars;
            settings.RequireEmailVerification = dto.RequireEmailVerification;
            settings.MaxFailedLoginAttempts = dto.MaxFailedLoginAttempts;
            settings.LockoutMinutes = dto.LockoutMinutes;
            settings.SessionTimeoutMinutes = dto.SessionTimeoutMinutes;
            settings.MaintenanceMode = dto.MaintenanceMode;
            settings.MaintenanceMessage = string.IsNullOrWhiteSpace(dto.MaintenanceMessage)
                ? new SystemSettings().MaintenanceMessage
                : dto.MaintenanceMessage.Trim();
            settings.EmailEnabled = dto.EmailEnabled;
            settings.DeadlineReminderDays = dto.DeadlineReminderDays;
            settings.NotificationRetentionDays = dto.NotificationRetentionDays;
            settings.DefaultMinimumGwa = dto.DefaultMinimumGwa;
            settings.UpdatedAt = DateTime.UtcNow;
            settings.UpdatedById = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (isNew) db.SystemSettings.Add(settings);

            db.Audit(this, "UpdateSystemSettings",
                changes.Count == 0 ? "Saved system settings (no values changed)" : string.Join("; ", changes));
            await db.SaveChangesAsync();

            // Otherwise the 15-second read cache would keep serving the old policy.
            SystemSettingsStore.Invalidate();

            return Ok(Shape(settings));
        }

        private static object Shape(SystemSettings s) => new
        {
            s.MaxUploadMb,
            s.AllowedFileExtensions,
            s.AllowLateSubmissions,
            s.AllowReplaceVerified,
            s.RequireProfileBeforeSubmission,
            s.AutoApproveScholars,
            s.RequireEmailVerification,
            s.MaxFailedLoginAttempts,
            s.LockoutMinutes,
            s.SessionTimeoutMinutes,
            s.MaintenanceMode,
            s.MaintenanceMessage,
            s.EmailEnabled,
            s.DeadlineReminderDays,
            s.NotificationRetentionDays,
            s.DefaultMinimumGwa,
            s.UpdatedAt,
            UpdatedByName = s.UpdatedBy != null ? s.UpdatedBy.FirstName + " " + s.UpdatedBy.LastName : null,
        };

        private static List<string> Diff(SystemSettings a, SystemSettingsRequest b)
        {
            var changes = new List<string>();
            void Cmp(string name, object? was, object? now)
            {
                if (!Equals(was?.ToString(), now?.ToString())) changes.Add($"{name}: {was} → {now}");
            }

            Cmp("Max upload MB", a.MaxUploadMb, b.MaxUploadMb);
            Cmp("Allowed extensions", a.AllowedFileExtensions, NormaliseExtensions(b.AllowedFileExtensions));
            Cmp("Allow late submissions", a.AllowLateSubmissions, b.AllowLateSubmissions);
            Cmp("Allow replacing verified", a.AllowReplaceVerified, b.AllowReplaceVerified);
            Cmp("Require profile before submission", a.RequireProfileBeforeSubmission, b.RequireProfileBeforeSubmission);
            Cmp("Auto-approve scholars", a.AutoApproveScholars, b.AutoApproveScholars);
            Cmp("Require email verification", a.RequireEmailVerification, b.RequireEmailVerification);
            Cmp("Max failed logins", a.MaxFailedLoginAttempts, b.MaxFailedLoginAttempts);
            Cmp("Lockout minutes", a.LockoutMinutes, b.LockoutMinutes);
            Cmp("Session timeout", a.SessionTimeoutMinutes, b.SessionTimeoutMinutes);
            Cmp("Maintenance mode", a.MaintenanceMode, b.MaintenanceMode);
            Cmp("Email enabled", a.EmailEnabled, b.EmailEnabled);
            Cmp("Deadline reminder days", a.DeadlineReminderDays, b.DeadlineReminderDays);
            Cmp("Notification retention days", a.NotificationRetentionDays, b.NotificationRetentionDays);
            Cmp("Default minimum GWA", a.DefaultMinimumGwa, b.DefaultMinimumGwa);
            return changes;
        }

        /// <summary>Strips dots and spaces so "PDF, .Jpg" and "pdf,jpg" store identically.</summary>
        private static string NormaliseExtensions(string? raw) =>
            string.Join(",", (raw ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(e => e.TrimStart('.').ToLowerInvariant())
                .Where(e => e.Length is > 0 and <= 10)
                .Distinct());

        private static string? Validate(SystemSettingsRequest dto)
        {
            if (dto.MaxUploadMb is < 1 or > 100)
                return "The upload limit must be between 1 and 100 MB.";
            if (string.IsNullOrWhiteSpace(NormaliseExtensions(dto.AllowedFileExtensions)))
                return "At least one file extension must be allowed, e.g. pdf,jpg,png.";
            if (dto.MaxFailedLoginAttempts is < 3 or > 20)
                return "Failed sign-in attempts must be between 3 and 20 — below 3 locks people out for typos.";
            if (dto.LockoutMinutes is < 1 or > 1440)
                return "The lockout period must be between 1 minute and 24 hours.";
            if (dto.SessionTimeoutMinutes is < 5 or > 480)
                return "The session timeout must be between 5 minutes and 8 hours.";
            if (dto.DeadlineReminderDays is < 1 or > 30)
                return "Deadline reminders must be sent between 1 and 30 days ahead.";
            if (dto.NotificationRetentionDays is < 0 or > 3650)
                return "Notification retention must be between 0 (keep forever) and 3650 days.";
            if (dto.DefaultMinimumGwa < 1.00m || dto.DefaultMinimumGwa > 5.00m)
                return "The default minimum GWA must be between 1.00 and 5.00.";
            if (dto.MaintenanceMessage is { Length: > 300 })
                return "The maintenance message must be 300 characters or fewer.";
            return null;
        }
    }

    public record SystemSettingsRequest(
        int MaxUploadMb,
        string? AllowedFileExtensions,
        bool AllowLateSubmissions,
        bool AllowReplaceVerified,
        bool RequireProfileBeforeSubmission,
        bool AutoApproveScholars,
        bool RequireEmailVerification,
        int MaxFailedLoginAttempts,
        int LockoutMinutes,
        int SessionTimeoutMinutes,
        bool MaintenanceMode,
        string? MaintenanceMessage,
        bool EmailEnabled,
        int DeadlineReminderDays,
        int NotificationRetentionDays,
        decimal DefaultMinimumGwa);
}
