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

        public int? ProgramId { get; set; }
        public AcademicProgram? Program { get; set; }

        public int? ScholarshipTypeId { get; set; }
        public ScholarshipType? ScholarshipType { get; set; }

        public int YearLevel { get; set; } = 1;

        [MaxLength(20)]
        public string? ContactNumber { get; set; }

        public DateTime? BirthDate { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;

        public ICollection<AcademicGrade> Grades { get; set; } = [];
    }
}
