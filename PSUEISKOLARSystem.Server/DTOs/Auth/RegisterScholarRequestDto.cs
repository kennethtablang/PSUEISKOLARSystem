using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class RegisterScholarRequestDto
    {
        [Required(ErrorMessage = "First name is required."), MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿ.\-\s]{1,100}$", ErrorMessage = "First name may only contain letters, spaces, hyphens, and periods.")]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? MiddleName { get; set; }

        [Required(ErrorMessage = "Last name is required."), MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿ.\-\s]{1,100}$", ErrorMessage = "Last name may only contain letters, spaces, hyphens, and periods.")]
        public string LastName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required."), MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        public string Password { get; set; } = string.Empty;

        /* The scholar profile is captured at sign-up, so the scholarship office only has to
           review and approve it — previously staff had to open every new account and fill
           the profile in before there was anything to approve. Same rules as
           UpsertScholarProfileDto. */

        [Required(ErrorMessage = "Student ID is required.")]
        [MaxLength(30)]
        [RegularExpression(@"^[A-Za-z0-9\-]{3,30}$", ErrorMessage = "Student ID may only contain letters, numbers, and hyphens.")]
        public string StudentId { get; set; } = string.Empty;

        [Required(ErrorMessage = "Program is required.")]
        public int? ProgramId { get; set; }

        [Required(ErrorMessage = "Scholarship is required.")]
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
