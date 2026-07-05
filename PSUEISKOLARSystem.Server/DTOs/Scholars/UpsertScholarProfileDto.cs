using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    public class UpsertScholarProfileDto
    {
        [Required(ErrorMessage = "Student ID is required.")]
        [MaxLength(30)]
        [RegularExpression(@"^[A-Za-z0-9\-]{3,30}$", ErrorMessage = "Student ID may only contain letters, numbers, and hyphens.")]
        public string StudentId { get; set; } = string.Empty;

        public int? ProgramId { get; set; }
        public int? ScholarshipTypeId { get; set; }

        [Range(1, 6, ErrorMessage = "Year level must be between 1 and 6.")]
        public int YearLevel { get; set; } = 1;

        [MaxLength(20)]
        [RegularExpression(@"^(09\d{9}|\+639\d{9})$", ErrorMessage = "Contact number must be a valid PH mobile number (e.g. 09171234567).")]
        public string? ContactNumber { get; set; }

        public DateTime? BirthDate { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }
    }
}
