using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class RegisterRequestDto
    {
        [Required(ErrorMessage = "First name is required."), MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿ.\-\s]{1,100}$", ErrorMessage = "First name may only contain letters, spaces, hyphens, and periods.")]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿ.\-\s]{0,100}$", ErrorMessage = "Middle name may only contain letters, spaces, hyphens, and periods.")]
        public string? MiddleName { get; set; }

        [Required(ErrorMessage = "Last name is required."), MaxLength(100)]
        [RegularExpression(@"^[A-Za-zÀ-ÿ.\-\s]{1,100}$", ErrorMessage = "Last name may only contain letters, spaces, hyphens, and periods.")]
        public string LastName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required."), MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Role is required.")]
        public string Role { get; set; } = string.Empty;

        public int? CampusId { get; set; }
    }
}
