using System.ComponentModel.DataAnnotations;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// One payout of a recurring scholarship to one scholar for one academic period.
    /// <para>
    /// A scholarship paid every semester produces two of these per academic year; one paid
    /// annually produces one, recorded against <see cref="ScholarshipFrequencies.WholeYearSemester"/>.
    /// The row's existence is the record that the scholar was <i>expected</i> to receive the
    /// money; <see cref="Status"/> is the record of whether they actually did. That split is
    /// what makes "has this grantee received their scholarship?" answerable — a missing row
    /// and an unreleased row are different problems.
    /// </para>
    /// A unique index on (ScholarId, ScholarshipTypeId, AcademicYear, Semester) stops the same
    /// period being paid twice.
    /// </summary>
    public class ScholarshipRelease
    {
        public int Id { get; set; }

        [Required]
        public string ScholarId { get; set; } = string.Empty;
        public ApplicationUser Scholar { get; set; } = null!;

        public int ScholarshipTypeId { get; set; }
        public ScholarshipType ScholarshipType { get; set; } = null!;

        /// <summary>Academic year in YYYY-YYYY form, e.g. "2025-2026".</summary>
        [Required, MaxLength(9)]
        public string AcademicYear { get; set; } = string.Empty;

        /// <summary>1 or 2 for a per-semester scholarship; 0 for a whole-year one.</summary>
        public int Semester { get; set; }

        public decimal Amount { get; set; }

        /// <summary>
        /// The day this payout is scheduled to be handed out. A calendar date, not an instant —
        /// campuses receive on different days, so it is set per campus batch.
        /// </summary>
        public DateTime? ScheduledDate { get; set; }

        /// <summary>Campus the scholar was at when the release was scheduled (a snapshot).</summary>
        public int? CampusId { get; set; }
        public Campus? Campus { get; set; }

        /// <summary>Year level the release was paid for, as set by the office when scheduling.</summary>
        public int? YearLevel { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = GrantReleaseStatuses.Pending;

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
