using System.ComponentModel.DataAnnotations;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// A one-off financial award (assistance, allowance, stipend top-up) given to a
    /// scholar on top of their single ongoing scholarship. A scholar may receive several
    /// of these; each is tracked and released independently.
    /// </summary>
    public class OneTimeGrant
    {
        public int Id { get; set; }

        [Required]
        public string ScholarId { get; set; } = string.Empty;
        public ApplicationUser Scholar { get; set; } = null!;

        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Purpose { get; set; }

        public decimal Amount { get; set; }

        // Funding source / sponsor, e.g. "PSU Alumni Association", "DSWD".
        [MaxLength(150)]
        public string? Source { get; set; }

        public DateTime AwardedOn { get; set; } = DateTime.UtcNow;

        [MaxLength(20)]
        public string ReleaseStatus { get; set; } = GrantReleaseStatuses.Pending;

        public DateTime? ReleasedAt { get; set; }

        // Voucher / cheque / disbursement reference captured on release.
        [MaxLength(60)]
        public string? ReferenceNo { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public string? RecordedById { get; set; }
        public ApplicationUser? RecordedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
