using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Users
{
    public class UpdateUserDto
    {
        [Required, MaxLength(150)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;

        public int? CampusId { get; set; }
    }
}
