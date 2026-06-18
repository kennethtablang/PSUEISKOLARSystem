namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class UserDto
    {
        public string Id { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string? MiddleName { get; set; }
        public string LastName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int? CampusId { get; set; }
        public string? CampusName { get; set; }
        public bool IsActive { get; set; }
        public bool TwoFactorEnabled { get; set; }
    }
}
