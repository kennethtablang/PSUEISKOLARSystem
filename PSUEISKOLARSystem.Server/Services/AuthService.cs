using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AutoMapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Settings;

namespace PSUEISKOLARSystem.Server.Services
{
    public class AuthService(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        ApplicationDbContext dbContext,
        IMapper mapper,
        IOptions<JwtSettings> jwtOptions,
        IOptions<EmailSettings> emailOptions,
        IEmailService emailService) : IAuthService
    {
        private readonly JwtSettings _jwtSettings = jwtOptions.Value;
        private readonly EmailSettings _emailSettings = emailOptions.Value;

        public async Task<AuthResponseDto> LoginAsync(LoginRequestDto request)
        {
            var user = await dbContext.Users
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            // Unknown or deactivated account — fail generically without revealing which.
            if (user is null || !user.IsActive)
            {
                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId  = user?.Id ?? "(unknown)",
                    Action  = "LoginFailed",
                    Details = $"Failed login for '{request.Email}': {(user is null ? "no such account" : "account inactive")}",
                });
                await dbContext.SaveChangesAsync();
                throw new UnauthorizedException("Invalid email or password.");
            }

            // Enforce lockout before checking the password (brute-force protection).
            if (await userManager.IsLockedOutAsync(user))
            {
                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId  = user.Id,
                    Action  = "LoginFailed",
                    Details = $"Login blocked for '{request.Email}': account locked out",
                });
                await dbContext.SaveChangesAsync();
                throw new UnauthorizedException("Account is temporarily locked due to too many failed attempts. Please try again in a few minutes.");
            }

            if (!await userManager.CheckPasswordAsync(user, request.Password))
            {
                await userManager.AccessFailedAsync(user);   // increments the counter; locks at the threshold
                var lockedNow = await userManager.IsLockedOutAsync(user);
                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId  = user.Id,
                    Action  = "LoginFailed",
                    Details = $"Failed login for '{request.Email}': incorrect password{(lockedNow ? " (account now locked out)" : "")}",
                });
                await dbContext.SaveChangesAsync();
                throw new UnauthorizedException(lockedNow
                    ? "Account is temporarily locked due to too many failed attempts. Please try again in a few minutes."
                    : "Invalid email or password.");
            }

            // Correct password — clear any accumulated failed attempts.
            await userManager.ResetAccessFailedCountAsync(user);

            if (!user.EmailConfirmed)
            {
                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId  = user.Id,
                    Action  = "LoginFailed",
                    Details = $"Failed login for '{request.Email}': email not verified",
                });
                await dbContext.SaveChangesAsync();
                throw new UnauthorizedException("Your email address has not been verified. Please check your inbox and click the verification link before signing in.");
            }

            if (user.TwoFactorEnabled)
            {
                var code = await userManager.GenerateTwoFactorTokenAsync(user, TokenOptions.DefaultEmailProvider);
                await emailService.SendTwoFactorCodeAsync(user.Email!, user.FullName, code);
                return new AuthResponseDto { Requires2fa = true, TwoFaTicket = GenerateTwoFactorTicket(user.Id) };
            }

            var roles = await userManager.GetRolesAsync(user);
            var role = roles.FirstOrDefault() ?? throw new UnauthorizedException("User has no assigned role.");

            user.LastLoginAt = DateTime.UtcNow;
            dbContext.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "Login" });
            await dbContext.SaveChangesAsync();

            var (token, expiresAtUtc) = GenerateJwtToken(user, role);
            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = role;

            return new AuthResponseDto { Token = token, ExpiresAtUtc = expiresAtUtc, User = userDto };
        }

        public async Task<UserDto> RegisterAsync(RegisterRequestDto request)
        {
            if (!await roleManager.RoleExistsAsync(request.Role))
                throw new BadRequestException($"Role '{request.Role}' does not exist.");

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FirstName = request.FirstName.Trim(),
                MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? null : request.MiddleName.Trim(),
                LastName = request.LastName.Trim(),
                EmailConfirmed = true,
            };

            var result = await userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
                throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));

            await userManager.AddToRoleAsync(user, request.Role);

            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = request.Role;
            return userDto;
        }

        public async Task<UserDto> RegisterScholarAsync(RegisterScholarRequestDto request)
        {
            if (await userManager.FindByEmailAsync(request.Email) is not null)
                throw new BadRequestException("An account with this email already exists.");

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FirstName = request.FirstName.Trim(),
                MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? null : request.MiddleName.Trim(),
                LastName = request.LastName.Trim(),
                EmailConfirmed = false,
                // Self-registration needs an administrator to verify the scholar before
                // they can submit documents (see ScholarApprovalsController).
                ApprovalStatus = ApprovalStatuses.Pending,
            };

            var result = await userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
                throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));

            await userManager.AddToRoleAsync(user, "Scholar");

            await SendVerificationEmailAsync(user);

            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = "Scholar";
            return userDto;
        }

        // Generates a fresh confirmation token and emails the verification link.
        private async Task SendVerificationEmailAsync(ApplicationUser user)
        {
            var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
            var verifyLink = $"{_emailSettings.AppBaseUrl}/verify-email" +
                             $"?email={Uri.EscapeDataString(user.Email!)}" +
                             $"&token={Uri.EscapeDataString(token)}";

            await emailService.SendEmailVerificationAsync(user.Email!, user.FullName, verifyLink);
        }

        // Re-sends the verification link if the account exists and is still unverified.
        // Returns false for unknown/already-verified emails (caller responds generically
        // to avoid leaking which emails are registered).
        public async Task<bool> ResendVerificationAsync(string email)
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user is null || user.EmailConfirmed) return false;

            await SendVerificationEmailAsync(user);
            return true;
        }

        public async Task<bool> IsEmailAvailableAsync(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return false;
            return await userManager.FindByEmailAsync(email.Trim()) is null;
        }

        public async Task VerifyEmailAsync(string email, string token)
        {
            var user = await userManager.FindByEmailAsync(email)
                ?? throw new BadRequestException("Invalid or expired verification link.");

            if (user.EmailConfirmed)
                return;

            var result = await userManager.ConfirmEmailAsync(user, token);
            if (!result.Succeeded)
                throw new BadRequestException("Invalid or expired verification link. Please register again to receive a new link.");
        }

        public async Task<UserDto> GetCurrentUserAsync(string userId)
        {
            var user = await dbContext.Users
                .FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("User not found.");

            var roles = await userManager.GetRolesAsync(user);
            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = roles.FirstOrDefault() ?? string.Empty;
            return userDto;
        }

        public async Task<UserDto> UpdateProfileAsync(string userId, UpdateProfileDto dto)
        {
            var user = await dbContext.Users
                .FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("User not found.");

            if (!string.IsNullOrWhiteSpace(dto.FirstName))
                user.FirstName = dto.FirstName.Trim();
            if (!string.IsNullOrWhiteSpace(dto.LastName))
                user.LastName = dto.LastName.Trim();
            user.MiddleName = string.IsNullOrWhiteSpace(dto.MiddleName) ? null : dto.MiddleName.Trim();

            if (!string.IsNullOrEmpty(dto.CurrentPassword) && !string.IsNullOrEmpty(dto.NewPassword))
            {
                var result = await userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
                if (!result.Succeeded)
                    throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            await userManager.UpdateAsync(user);

            var roles = await userManager.GetRolesAsync(user);
            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = roles.FirstOrDefault() ?? string.Empty;
            return userDto;
        }

        public async Task<bool> ForgotPasswordAsync(string email)
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user is null || !user.IsActive) return false;

            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var resetLink = $"{_emailSettings.AppBaseUrl}/reset-password" +
                            $"?email={Uri.EscapeDataString(user.Email!)}" +
                            $"&token={Uri.EscapeDataString(token)}";

            await emailService.SendPasswordResetEmailAsync(user.Email!, user.FullName, resetLink);
            return true;
        }

        public async Task ResetPasswordAsync(ResetPasswordRequestDto request)
        {
            var user = await userManager.FindByEmailAsync(request.Email)
                ?? throw new BadRequestException("Invalid or expired reset link.");

            var result = await userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
            if (!result.Succeeded)
                throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        public async Task EnableTwoFactorAsync(string userId)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");
            await userManager.SetTwoFactorEnabledAsync(user, true);
        }

        public async Task DisableTwoFactorAsync(string userId, string password)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");

            if (!await userManager.CheckPasswordAsync(user, password))
                throw new BadRequestException("Incorrect password.");

            await userManager.SetTwoFactorEnabledAsync(user, false);
        }

        public async Task<AuthResponseDto> VerifyTwoFactorLoginAsync(TwoFactorLoginRequestDto request)
        {
            var userId = ValidateTwoFactorTicket(request.Ticket);

            var user = await userManager.FindByIdAsync(userId)
                ?? throw new UnauthorizedException("Invalid session.");

            if (!user.IsActive)
                throw new UnauthorizedException("Account is inactive.");

            if (await userManager.IsLockedOutAsync(user))
                throw new UnauthorizedException("Account is temporarily locked due to too many failed attempts. Please try again later.");

            var cleanCode = request.Code.Replace(" ", "").Replace("-", "");
            var isValid = await userManager.VerifyTwoFactorTokenAsync(
                user, TokenOptions.DefaultEmailProvider, cleanCode);

            if (!isValid)
            {
                await userManager.AccessFailedAsync(user);
                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId  = user.Id,
                    Action  = "LoginFailed",
                    Details = $"Failed 2FA verification for '{user.Email}': invalid code",
                });
                await dbContext.SaveChangesAsync();
                throw new UnauthorizedException("Invalid authentication code.");
            }

            await userManager.ResetAccessFailedCountAsync(user);

            var roles = await userManager.GetRolesAsync(user);
            var role = roles.FirstOrDefault() ?? throw new UnauthorizedException("User has no assigned role.");

            user.LastLoginAt = DateTime.UtcNow;
            dbContext.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "Login (2FA)" });
            await dbContext.SaveChangesAsync();

            var (token, expiresAtUtc) = GenerateJwtToken(user, role);
            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = role;

            return new AuthResponseDto { Token = token, ExpiresAtUtc = expiresAtUtc, User = userDto };
        }

        private string GenerateTwoFactorTicket(string userId)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim("purpose", "2fa"),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
            var token = new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string ValidateTwoFactorTicket(string ticket)
        {
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
            try
            {
                var principal = handler.ValidateToken(ticket, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = true,
                    ValidIssuer = _jwtSettings.Issuer,
                    ValidateAudience = true,
                    ValidAudience = _jwtSettings.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                }, out _);

                if (principal.FindFirstValue("purpose") != "2fa")
                    throw new UnauthorizedException("Invalid session token.");

                return principal.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? throw new UnauthorizedException("Invalid session token.");
            }
            catch (Exception ex) when (ex is not UnauthorizedException)
            {
                throw new UnauthorizedException("Session expired. Please sign in again.");
            }
        }

        private (string Token, DateTime ExpiresAtUtc) GenerateJwtToken(ApplicationUser user, string role)
        {
            var expiresAtUtc = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpiryMinutes);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new(ClaimTypes.NameIdentifier, user.Id),
                new(ClaimTypes.Email, user.Email ?? string.Empty),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Role, role),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: credentials);

            return (new JwtSecurityTokenHandler().WriteToken(token), expiresAtUtc);
        }
    }
}
