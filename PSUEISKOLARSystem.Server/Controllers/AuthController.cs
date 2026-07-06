using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController(IAuthService authService, ApplicationDbContext db) : ControllerBase
    {
        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginRequestDto request)
        {
            try
            {
                return Ok(await authService.LoginAsync(request));
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        [HttpPost("register-scholar")]
        public async Task<ActionResult<UserDto>> RegisterScholar(RegisterScholarRequestDto request)
        {
            try
            {
                return Ok(await authService.RegisterScholarAsync(request));
            }
            catch (BadRequestException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("register")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<ActionResult<UserDto>> Register(RegisterRequestDto request)
        {
            try
            {
                var created = await authService.RegisterAsync(request);

                var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
                db.AuditLogs.Add(new AuditLog
                {
                    UserId  = actorId,
                    Action  = "CreateUser",
                    Details = $"Created user {request.Email} with role {request.Role}",
                });
                await db.SaveChangesAsync();

                return Ok(created);
            }
            catch (BadRequestException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<UserDto>> Me()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new UnauthorizedAccessException();

            try
            {
                return Ok(await authService.GetCurrentUserAsync(userId));
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordRequestDto request)
        {
            var found = await authService.ForgotPasswordAsync(request.Email);
            return Ok(new { found });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequestDto request)
        {
            try
            {
                await authService.ResetPasswordAsync(request);
                return Ok(new { message = "Password reset successfully." });
            }
            catch (BadRequestException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromQuery] string email, [FromQuery] string token)
        {
            try
            {
                await authService.VerifyEmailAsync(email, token);
                return Ok(new { message = "Email verified successfully. You can now sign in." });
            }
            catch (BadRequestException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("login-2fa")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<AuthResponseDto>> Login2fa(TwoFactorLoginRequestDto request)
        {
            try
            {
                return Ok(await authService.VerifyTwoFactorLoginAsync(request));
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        [HttpPost("2fa/enable")]
        [Authorize]
        public async Task<IActionResult> Enable2fa()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new UnauthorizedAccessException();
            try
            {
                await authService.EnableTwoFactorAsync(userId);
                return Ok(new { message = "Two-factor authentication enabled." });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        [HttpPost("2fa/disable")]
        [Authorize]
        public async Task<IActionResult> Disable2fa(DisableTwoFactorDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new UnauthorizedAccessException();
            try
            {
                await authService.DisableTwoFactorAsync(userId, dto.Password);
                return Ok(new { message = "Two-factor authentication disabled." });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // FR-19: capture Data Privacy Act (RA 10173) consent.
        [HttpPost("accept-consent")]
        [Authorize]
        public async Task<IActionResult> AcceptConsent()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var user = await db.Users.FindAsync(userId);
            if (user is null) return NotFound();

            user.ConsentAcceptedAt = DateTime.UtcNow;
            user.ConsentVersion = "1.0";
            await db.SaveChangesAsync();
            return Ok(new { user.ConsentAcceptedAt });
        }

        // FR-20: per-category email notification preferences.
        [HttpPut("notification-preferences")]
        [Authorize]
        public async Task<IActionResult> UpdateNotificationPreferences(NotificationPrefsDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var user = await db.Users.FindAsync(userId);
            if (user is null) return NotFound();

            user.EmailAnnouncements = dto.EmailAnnouncements;
            user.EmailDocumentStatus = dto.EmailDocumentStatus;
            user.EmailDeadlines = dto.EmailDeadlines;
            await db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("profile")]
        [Authorize]
        public async Task<ActionResult<UserDto>> UpdateProfile(UpdateProfileDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new UnauthorizedAccessException();

            try
            {
                return Ok(await authService.UpdateProfileAsync(userId, dto));
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        public record NotificationPrefsDto(bool EmailAnnouncements, bool EmailDocumentStatus, bool EmailDeadlines);
    }
}
