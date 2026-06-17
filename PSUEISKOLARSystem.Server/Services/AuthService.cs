using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AutoMapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
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
                .Include(u => u.Campus)
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user is null || !user.IsActive || !await userManager.CheckPasswordAsync(user, request.Password))
            {
                throw new UnauthorizedException("Invalid email or password.");
            }

            if (user.TwoFactorEnabled)
                return new AuthResponseDto { Requires2fa = true, TwoFaTicket = GenerateTwoFactorTicket(user.Id) };

            var roles = await userManager.GetRolesAsync(user);
            var role = roles.FirstOrDefault() ?? throw new UnauthorizedException("User has no assigned role.");

            user.LastLoginAt = DateTime.UtcNow;
            dbContext.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "Login" });
            await dbContext.SaveChangesAsync();

            var (token, expiresAtUtc) = GenerateJwtToken(user, role);

            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = role;

            return new AuthResponseDto
            {
                Token = token,
                ExpiresAtUtc = expiresAtUtc,
                User = userDto
            };
        }

        public async Task<UserDto> RegisterAsync(RegisterRequestDto request)
        {
            if (!await roleManager.RoleExistsAsync(request.Role))
            {
                throw new BadRequestException($"Role '{request.Role}' does not exist.");
            }

            if (request.CampusId.HasValue && !await dbContext.Campuses.AnyAsync(c => c.Id == request.CampusId))
            {
                throw new BadRequestException($"Campus '{request.CampusId}' does not exist.");
            }

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FullName = request.FullName,
                CampusId = request.CampusId
            };

            var result = await userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            await userManager.AddToRoleAsync(user, request.Role);

            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = request.Role;
            return userDto;
        }

        public async Task<UserDto> GetCurrentUserAsync(string userId)
        {
            var user = await dbContext.Users
                .Include(u => u.Campus)
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
                .Include(u => u.Campus)
                .FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("User not found.");

            if (!string.IsNullOrWhiteSpace(dto.FullName))
                user.FullName = dto.FullName.Trim();

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

        public Task<UserDto> RegisterScholarAsync(RegisterScholarRequestDto request) =>
            RegisterAsync(new RegisterRequestDto
            {
                FullName = request.FullName,
                Email    = request.Email,
                Password = request.Password,
                Role     = "Scholar",
                CampusId = null,
            });

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

        public async Task<(string Uri, string Key)> GetTwoFactorSetupAsync(string userId)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");

            var key = await userManager.GetAuthenticatorKeyAsync(user);
            if (string.IsNullOrEmpty(key))
            {
                await userManager.ResetAuthenticatorKeyAsync(user);
                key = await userManager.GetAuthenticatorKeyAsync(user)!;
            }

            var cleanKey = key!.Replace(" ", "");
            const string issuer = "EIskolarSystem";
            var uri = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(user.Email!)}?secret={cleanKey}&issuer={Uri.EscapeDataString(issuer)}";

            return (uri, key!);
        }

        public async Task<bool> EnableTwoFactorAsync(string userId, string code)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");

            var cleanCode = code.Replace(" ", "").Replace("-", "");
            var isValid = await userManager.VerifyTwoFactorTokenAsync(
                user, userManager.Options.Tokens.AuthenticatorTokenProvider, cleanCode);

            if (!isValid) return false;

            await userManager.SetTwoFactorEnabledAsync(user, true);
            return true;
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
                user, userManager.Options.Tokens.AuthenticatorTokenProvider, cleanCode);

            if (!isValid)
            {
                await userManager.AccessFailedAsync(user);
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

            if (user.CampusId.HasValue)
            {
                claims.Add(new Claim("campusId", user.CampusId.Value.ToString()));
            }

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
