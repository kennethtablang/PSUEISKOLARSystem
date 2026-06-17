namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class UpdateProfileDto
    {
        public string FullName { get; set; } = string.Empty;
        public string? CurrentPassword { get; set; }
        public string? NewPassword { get; set; }
    }
}
