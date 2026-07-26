using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// Audit trail of every scholarship a scholar has been registered under.
    /// A scholar may hold only <b>one</b> scholarship at a time — enforced by a unique
    /// filtered index on (ScholarId) where EndedAt IS NULL. Changing a scholarship closes
    /// the current row and opens a new one, so the full history stays verifiable.
    /// </summary>
    public class ScholarshipAssignment
    {
        public int Id { get; set; }

        [Required]
        public string ScholarId { get; set; } = string.Empty;
        public ApplicationUser Scholar { get; set; } = null!;

        public int ScholarshipTypeId { get; set; }
        public ScholarshipType ScholarshipType { get; set; } = null!;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

        public string? AssignedById { get; set; }
        public ApplicationUser? AssignedBy { get; set; }

        // Null while this is the scholar's single active scholarship.
        public DateTime? EndedAt { get; set; }

        [MaxLength(200)]
        public string? EndReason { get; set; }

        [MaxLength(450)]
        public string? EndedById { get; set; }

        [NotMapped]
        public bool IsActive => EndedAt is null;
    }
}
