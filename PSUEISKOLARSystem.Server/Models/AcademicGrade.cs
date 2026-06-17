using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class AcademicGrade
    {
        public int Id { get; set; }

        public int ScholarProfileId { get; set; }
        public ScholarProfile ScholarProfile { get; set; } = null!;

        [Required, MaxLength(20)]
        public string AcademicYear { get; set; } = string.Empty;

        public int Semester { get; set; }

        [Range(1.0, 5.0)]
        public decimal Gwa { get; set; }

        public bool MeetsRequirement { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }

        public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

        public string? RecordedById { get; set; }
        public ApplicationUser? RecordedBy { get; set; }
    }
}
