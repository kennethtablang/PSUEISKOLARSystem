using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    public class UpsertScholarProfileDto
    {
        [Required, MaxLength(30)]
        public string StudentId { get; set; } = string.Empty;

        public int? ProgramId { get; set; }
        public int? ScholarshipTypeId { get; set; }
        public int YearLevel { get; set; } = 1;

        [MaxLength(20)]
        public string? ContactNumber { get; set; }

        public DateTime? BirthDate { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }
    }
}
