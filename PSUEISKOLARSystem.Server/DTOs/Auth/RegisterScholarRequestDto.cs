using System.ComponentModel.DataAnnotations;
using PSUEISKOLARSystem.Server.DTOs.Scholars;

namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    /// <summary>
    /// Self sign-up for scholars and grantees alike — the Scholar's Data sheet plus the
    /// account credentials. Whether the account becomes a scholar or a grantee, and which
    /// scholarship it holds, is not the student's choice: it comes from the master-list line
    /// the details are matched against (see <see cref="Data.MasterList"/>).
    /// </summary>
    public class RegisterScholarRequestDto
    {
        [Required(ErrorMessage = "First name is required."), MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿÑñ.\-\s]{1,100}$", ErrorMessage = "First name may only contain letters, spaces, hyphens, and periods.")]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿÑñ.\-\s]{0,100}$", ErrorMessage = "Middle name may only contain letters, spaces, hyphens, and periods.")]
        public string? MiddleName { get; set; }

        [Required(ErrorMessage = "Last name is required."), MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿÑñ.\-\s]{1,100}$", ErrorMessage = "Last name may only contain letters, spaces, hyphens, and periods.")]
        public string LastName { get; set; } = string.Empty;

        // Institutional address only — checked against PersonalOptions.InstitutionalDomain.
        [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required."), MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Student ID is required.")]
        [MaxLength(30)]
        [RegularExpression(@"^[A-Za-z0-9\-]{3,30}$", ErrorMessage = "Student ID may only contain letters, numbers, and hyphens.")]
        public string StudentId { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campus is required.")]
        public int? CampusId { get; set; }

        [Required(ErrorMessage = "Course is required.")]
        public int? ProgramId { get; set; }

        [Range(1, 6, ErrorMessage = "Year level must be between 1 and 6.")]
        public int YearLevel { get; set; } = 1;

        // Stored as +639XXXXXXXXX; the form fixes the +63 prefix.
        [Required(ErrorMessage = "Contact number is required.")]
        [MaxLength(20)]
        [RegularExpression(@"^\+639\d{9}$", ErrorMessage = "Contact number must be a valid PH mobile number (+63 9XX XXX XXXX).")]
        public string ContactNumber { get; set; } = string.Empty;

        [Required(ErrorMessage = "Birth date is required.")]
        public DateTime? BirthDate { get; set; }

        [Required(ErrorMessage = "Complete address is required."), MaxLength(500)]
        public string Address { get; set; } = string.Empty;

        [Required]
        public PersonalDetailsDto Personal { get; set; } = new();

        // RA 10173: sign-up cannot go through without the data privacy consent.
        public bool ConsentAccepted { get; set; }
    }

    /// <summary>The pre-check the sign-up form runs before asking for the whole sheet.</summary>
    public class EligibilityCheckRequestDto
    {
        [Required, MaxLength(30)]
        public string StudentId { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? MiddleName { get; set; }

        [Required, MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        public int? CampusId { get; set; }
    }

    /// <summary>
    /// A past grantee who is now listed as a scholar proves the grantee account is theirs,
    /// so the sign-up form can be pre-filled from it (see
    /// <see cref="Interfaces.IAuthService.GetGranteeAccountForConversionAsync"/>).
    /// </summary>
    public class GranteeAccountLookupDto : EligibilityCheckRequestDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    /// <summary>What a grantee account already holds, to pre-fill the scholar sign-up form.</summary>
    public class GranteeConversionPrefillDto
    {
        public string Email { get; set; } = string.Empty;
        public int? ProgramId { get; set; }
        public int YearLevel { get; set; }
        public string? ContactNumber { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Address { get; set; }
        public Scholars.PersonalDetailsDto Personal { get; set; } = new();
        /// <summary>One-time grants already on the account; they stay on it as a scholar.</summary>
        public int GrantCount { get; set; }
    }
}
