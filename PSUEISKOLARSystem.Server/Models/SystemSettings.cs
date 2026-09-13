using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// System-wide policy, held in a single row.
    /// <para>
    /// Everything here was previously a constant compiled into the code — the upload cap in
    /// <c>LocalFileStorageService</c>, the lockout threshold in <c>Program.cs</c>, the
    /// reminder window in <c>DeadlineReminderService</c>. Each field below is read at the
    /// point it is enforced, so changing it changes behaviour without a redeploy.
    /// </para>
    /// A settings row that nothing reads is worse than no setting at all, because it tells
    /// the administrator a lie. Every property here is enforced somewhere; the comment on
    /// each says where.
    /// </summary>
    public class SystemSettings
    {
        public int Id { get; set; }

        /* ── Submissions ─────────────────────────────── */

        /// <summary>Max size of an uploaded document, in MB. Enforced in <c>DocumentsController.Upload</c>.</summary>
        public int MaxUploadMb { get; set; } = 10;

        /// <summary>
        /// Comma-separated file extensions scholars may upload, e.g. "pdf,jpg,png".
        /// Enforced in <c>DocumentsController.Upload</c> alongside the magic-byte check.
        /// </summary>
        [MaxLength(200)]
        public string AllowedFileExtensions { get; set; } = "pdf,jpg,jpeg,png,webp,doc,docx";

        /// <summary>
        /// Whether a scholar may still submit after the requirement's deadline has passed.
        /// Off means the upload is refused; on means it is accepted and flagged late.
        /// Enforced in <c>DocumentsController.Upload</c>.
        /// </summary>
        public bool AllowLateSubmissions { get; set; } = true;

        /// <summary>
        /// Whether a scholar may replace a document a coordinator has already verified.
        /// Off protects the verified record from being swapped after the fact.
        /// Enforced in <c>DocumentsController.Upload</c>.
        /// </summary>
        public bool AllowReplaceVerified { get; set; } = false;

        /// <summary>
        /// A scholar must finish their profile (student ID, program, scholarship) before
        /// submitting anything. Enforced in <c>DocumentsController.Upload</c> via
        /// <see cref="Data.ScholarOnboarding"/>.
        /// </summary>
        public bool RequireProfileBeforeSubmission { get; set; } = true;

        /* ── Registration &amp; access ───────────────────── */

        /// <summary>
        /// Self-registered scholars are approved automatically instead of queueing for the
        /// scholarship office. Enforced in <c>AuthService.RegisterScholarAsync</c>.
        /// </summary>
        public bool AutoApproveScholars { get; set; } = false;

        /// <summary>
        /// Scholars must confirm their email address before they can sign in.
        /// Enforced in <c>AuthService.LoginAsync</c>.
        /// </summary>
        public bool RequireEmailVerification { get; set; } = true;

        /// <summary>Failed sign-ins before the account locks. Enforced in <c>AuthService</c>.</summary>
        public int MaxFailedLoginAttempts { get; set; } = 5;

        /// <summary>How long a locked account stays locked, in minutes. Enforced in <c>AuthService</c>.</summary>
        public int LockoutMinutes { get; set; } = 15;

        /// <summary>
        /// Default inactivity timeout handed to the client on sign-in, in minutes. A user may
        /// still shorten it for their own browser from Settings → Preferences.
        /// </summary>
        public int SessionTimeoutMinutes { get; set; } = 30;

        /// <summary>
        /// Blocks sign-in for everyone except administrators, so the system can be worked on
        /// without users half-way through a submission. Enforced in <c>AuthService.LoginAsync</c>.
        /// </summary>
        public bool MaintenanceMode { get; set; } = false;

        /// <summary>Shown on the sign-in page while <see cref="MaintenanceMode"/> is on.</summary>
        [MaxLength(300)]
        public string MaintenanceMessage { get; set; } =
            "e-Iskolar is temporarily unavailable for scheduled maintenance. Please try again later.";

        /* ── Notifications ───────────────────────────── */

        /// <summary>
        /// Global switch for outbound email. Off keeps in-app notifications working while
        /// nothing leaves the server — the setting to reach for when SMTP is misbehaving.
        /// Enforced in <c>EmailService</c>.
        /// </summary>
        public bool EmailEnabled { get; set; } = true;

        /// <summary>
        /// How many days before a deadline the reminder goes out.
        /// Enforced in <c>DeadlineReminderService</c>.
        /// </summary>
        public int DeadlineReminderDays { get; set; } = 3;

        /// <summary>
        /// Read notifications older than this are deleted by the nightly sweep. 0 keeps them
        /// forever. Enforced in <c>NotificationRetentionService</c>.
        /// </summary>
        public int NotificationRetentionDays { get; set; } = 90;

        /* ── Scholarships ────────────────────────────── */

        /// <summary>
        /// GWA ceiling pre-filled into the form when an administrator creates a new
        /// scholarship type, so the house standard doesn't have to be remembered each time.
        /// Read by <c>ScholarshipTypesPage</c>; each type still stores its own value.
        /// </summary>
        public decimal DefaultMinimumGwa { get; set; } = 2.50m;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string? UpdatedById { get; set; }
        public ApplicationUser? UpdatedBy { get; set; }

        /// <summary>Extensions as a normalised set (".pdf", ".jpg", …) for matching.</summary>
        public HashSet<string> ExtensionSet() =>
            AllowedFileExtensions
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(e => e.StartsWith('.') ? e.ToLowerInvariant() : $".{e.ToLowerInvariant()}")
                .ToHashSet();
    }
}
