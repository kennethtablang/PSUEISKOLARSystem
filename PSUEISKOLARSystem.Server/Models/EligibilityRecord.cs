using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// One line of the master list the office keeps of who is entitled to an account. Sign-up
    /// is cross-matched against this list instead of waiting for someone to approve it: a
    /// student whose student number and name match an unclaimed line gets an account at once,
    /// and the line's <see cref="Kind"/> decides whether that account is a scholar or a
    /// grantee. A student on no line cannot create an account at all.
    /// </summary>
    public class EligibilityRecord
    {
        public int Id { get; set; }

        /// <summary><see cref="Enums.EligibilityKinds"/>: Scholar or Grantee.</summary>
        [Required, MaxLength(10)]
        public string Kind { get; set; } = Enums.EligibilityKinds.Scholar;

        [Required, MaxLength(30)]
        public string StudentId { get; set; } = string.Empty;

        // Stored upper-case, the way sign-up records names, so matching is a plain comparison.
        [Required, MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? MiddleName { get; set; }

        /// <summary>When set, the student must also have picked this campus.</summary>
        public int? CampusId { get; set; }
        public Campus? Campus { get; set; }

        /// <summary>The scholarship a Scholar line is for.</summary>
        public int? ScholarshipTypeId { get; set; }
        public ScholarshipType? ScholarshipType { get; set; }

        /// <summary>The grant a Grantee line is for.</summary>
        public int? GrantTypeId { get; set; }
        public GrantType? GrantType { get; set; }

        /// <summary>Grant amount for a Grantee line; falls back to the type's default.</summary>
        public decimal? GrantAmount { get; set; }

        [MaxLength(300)]
        public string? Notes { get; set; }

        /// <summary>The account this line was matched to. Null until someone signs up.</summary>
        public string? ClaimedByUserId { get; set; }
        public ApplicationUser? ClaimedBy { get; set; }
        public DateTime? ClaimedAt { get; set; }

        public string? CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
