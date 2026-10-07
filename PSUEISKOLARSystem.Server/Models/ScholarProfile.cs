using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class ScholarProfile
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

        public int? ScholarshipTypeId { get; set; }
        public ScholarshipType? ScholarshipType { get; set; }

        public int YearLevel { get; set; } = 1;

        // Scholarship lifecycle state (FR-18): Active, Renewed, Lapsed, Suspended, Graduated.
        [MaxLength(20)]
        public string LifecycleStatus { get; set; } = "Active";

        [MaxLength(20)]
        public string? ContactNumber { get; set; }

        public DateTime? BirthDate { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;

        // Set when a grantee account was upgraded into this scholar account (the office put the
        // student on a scholarship's cross-matching list). The one-time grants stay on the account.
        public DateTime? ConvertedFromGranteeAt { get; set; }

        // After an upgrade the profile still carries what the student filled in as a grantee.
        // Until they confirm it, they may update their year level, course and Scholar's Data sheet once.
        public bool DetailsReviewPending { get; set; }

        // Personal and family information from the Scholar's Data sheet.
        public PersonalDetails Personal { get; set; } = new();

        public ICollection<AcademicGrade> Grades { get; set; } = [];
    }
}
