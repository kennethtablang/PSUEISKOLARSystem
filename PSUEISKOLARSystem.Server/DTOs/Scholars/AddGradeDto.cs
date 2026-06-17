using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    public class AddGradeDto
    {
        [Required, MaxLength(20)]
        public string AcademicYear { get; set; } = string.Empty;

        [Range(1, 2)]
        public int Semester { get; set; }

        [Range(1.0, 5.0)]
        public decimal Gwa { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }
    }
}
