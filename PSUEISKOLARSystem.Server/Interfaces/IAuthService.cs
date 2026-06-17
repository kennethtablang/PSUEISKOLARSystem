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
        Task<bool> ForgotPasswordAsync(string email);
        Task ResetPasswordAsync(ResetPasswordRequestDto request);
        Task<(string Uri, string Key)> GetTwoFactorSetupAsync(string userId);
        Task<bool> EnableTwoFactorAsync(string userId, string code);
        Task DisableTwoFactorAsync(string userId, string password);
        Task<AuthResponseDto> VerifyTwoFactorLoginAsync(TwoFactorLoginRequestDto request);
    }
}
