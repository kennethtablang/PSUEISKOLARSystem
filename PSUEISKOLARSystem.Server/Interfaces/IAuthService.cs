using PSUEISKOLARSystem.Server.DTOs.Auth;

namespace PSUEISKOLARSystem.Server.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponseDto> LoginAsync(LoginRequestDto request);
        Task<UserDto> RegisterAsync(RegisterRequestDto request);
        Task<UserDto> GetCurrentUserAsync(string userId);
        Task<UserDto> UpdateProfileAsync(string userId, UpdateProfileDto dto);
        Task<UserDto> RegisterScholarAsync(RegisterScholarRequestDto request);
        Task<(string Email, string Token)?> ForgotPasswordAsync(string email);
        Task ResetPasswordAsync(ResetPasswordRequestDto request);
    }
}
