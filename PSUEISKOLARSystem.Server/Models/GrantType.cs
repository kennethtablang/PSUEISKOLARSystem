using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// A kind of one-time grant (e.g. "TDP", "Tulong Dunong", "Calamity Assistance"), managed
    /// the way scholarship types are. Deactivating a type once it has been released also
    /// deactivates the grantee accounts under it — they have received what they signed up for
    /// — while every record stays in place for the analytics.
    /// </summary>
    public class GrantType
    {
        public int Id { get; set; }

        [Required, MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        // Funding source / sponsor, e.g. "CHED", "DSWD", "PSU Alumni Association".
        [MaxLength(150)]
        public string? Sponsor { get; set; }

        /// <summary>The standard amount, pre-filled when a grant of this type is recorded.</summary>
        public decimal? DefaultAmount { get; set; }

        /// <summary>
        /// The day the grant is handed out. Once that day arrives (Philippine time) every grant
        /// of this type still pending is marked released automatically — see
        /// <see cref="Services.GrantReleaseService"/>. A calendar date, not an instant, so it is
        /// stored without a time zone like <see cref="ScholarshipRelease.ScheduledDate"/>.
        /// Null while the office has not fixed a date; those grants are released by hand.
        /// </summary>
        public DateTime? ScheduledDate { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? DeactivatedAt { get; set; }
    }
}
