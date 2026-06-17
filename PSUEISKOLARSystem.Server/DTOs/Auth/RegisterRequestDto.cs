using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class RegisterRequestDto
    {
        [Required, MaxLength(150)]
        public string FullName { get; set; } = string.Empty;

        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;

        public int? CampusId { get; set; }
    }
}
