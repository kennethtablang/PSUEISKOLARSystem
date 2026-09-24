using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// The profile of a grantee — a student who receives one-time grants but holds no
    /// scholarship. Kept apart from <see cref="ScholarProfile"/> on purpose: every scholar
    /// count, compliance figure and release run reads that table, and a grantee is none of
    /// those things. A scholar who also receives a grant stays a scholar; the grant is simply
    /// recorded against them (see <see cref="OneTimeGrant"/>).
    /// <para>
    /// Grantee accounts are deactivated once their grant is released (see
    /// <see cref="GrantType"/>), but the profile stays so the analytics keep their data.
    /// </para>
    /// </summary>
    public class GranteeProfile
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        [Required, MaxLength(30)]
        public string StudentId { get; set; } = string.Empty;

        public int? CampusId { get; set; }
        public Campus? Campus { get; set; }

        public int? ProgramId { get; set; }
        public AcademicProgram? Program { get; set; }

        public int YearLevel { get; set; } = 1;

        [MaxLength(20)]
        public string? ContactNumber { get; set; }

        public DateTime? BirthDate { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        public PersonalDetails Personal { get; set; } = new();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
