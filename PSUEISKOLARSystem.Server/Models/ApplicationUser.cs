using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string FirstName { get; set; } = string.Empty;
        public string? MiddleName { get; set; }
        public string LastName { get; set; } = string.Empty;

        [NotMapped]
        public string FullName => string.IsNullOrWhiteSpace(MiddleName)
            ? $"{FirstName} {LastName}".Trim()
            : $"{FirstName} {MiddleName} {LastName}".Trim();

        public bool IsActive { get; set; } = true;

        /// <summary>
        /// A second, personal address that can receive a password-reset link. Staff sign in
        /// with an office address (admin@psu.edu.ph) that may not be a mailbox anyone reads;
        /// this lets them recover the account through an inbox they own. Only set after a code
        /// sent to it has been entered, so a typo can't lock anyone out.
        /// </summary>
        [System.ComponentModel.DataAnnotations.MaxLength(256)]
        public string? RecoveryEmail { get; set; }

        /// <summary>
        /// The campus a scholarship coordinator is in charge of. A coordinator sees only that
        /// campus's scholars, grantees, documents, messages and figures; null for the
        /// administrator, who sees every campus. Students' campus lives on their profile.
        /// </summary>
        public int? CampusId { get; set; }
        public Campus? Campus { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }

        // Stored file name of the profile photo. Null → the UI falls back to initials.
        [System.ComponentModel.DataAnnotations.MaxLength(260)]
        public string? AvatarPath { get; set; }

        // Admin verification of a self-registered scholar. Defaults to Approved so
        // admin-created accounts (and every pre-existing account) need no action;
        // self-registration explicitly sets Pending.
        [System.ComponentModel.DataAnnotations.MaxLength(20)]
        public string ApprovalStatus { get; set; } = ApprovalStatuses.Approved;
        public DateTime? ApprovalDecidedAt { get; set; }
        public string? ApprovalDecidedById { get; set; }
        [System.ComponentModel.DataAnnotations.MaxLength(300)]
        public string? ApprovalNote { get; set; }

        [NotMapped]
        public bool IsPendingApproval => ApprovalStatus == ApprovalStatuses.Pending;

        // Data Privacy Act (RA 10173) consent capture (FR-19).
        public DateTime? ConsentAcceptedAt { get; set; }
        [System.ComponentModel.DataAnnotations.MaxLength(20)]
        public string? ConsentVersion { get; set; }

        // Per-category email notification preferences (FR-20). Critical account/security
        // emails are always sent regardless of these flags.
        public bool EmailAnnouncements { get; set; } = true;
        public bool EmailDocumentStatus { get; set; } = true;
        public bool EmailDeadlines { get; set; } = true;

        // In-app (bell) muting, one step finer than the email toggles above: any
        // NotificationCategories value listed here is dropped before it is persisted.
        // Stored pipe-delimited and pipe-wrapped ("|Deadline|Message|") so a
        // Contains("|X|") check translates to a single SQL LIKE.
        [System.ComponentModel.DataAnnotations.MaxLength(300)]
        public string? MutedNotificationCategories { get; set; }

        [NotMapped]
        public IReadOnlyList<string> MutedCategories =>
            NotificationMuting.Parse(MutedNotificationCategories);
    }
}
