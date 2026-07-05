using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    public class AddGradeDto
    {
        [Required(ErrorMessage = "Academic year is required.")]
        [RegularExpression(@"^\d{4}-\d{4}$", ErrorMessage = "Academic year must be in the format YYYY-YYYY (e.g. 2025-2026).")]
        public string AcademicYear { get; set; } = string.Empty;

        [Range(1, 2, ErrorMessage = "Semester must be 1 or 2.")]
        public int Semester { get; set; }

        [Range(1.0, 5.0, ErrorMessage = "GWA must be between 1.00 and 5.00.")]
        public decimal Gwa { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }
    }
}
