using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Users
{
    public class UpdateUserDto
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

        [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address."), MaxLength(256)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;

        // Required for a scholarship coordinator: the campus they are in charge of.
        public int? CampusId { get; set; }
    }
}
