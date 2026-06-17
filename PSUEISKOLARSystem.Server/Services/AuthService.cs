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
using PSUEISKOLARSystem.Server.Settings;

namespace PSUEISKOLARSystem.Server.Services
{
    public class AuthService(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        ApplicationDbContext dbContext,
        IMapper mapper,
        IOptions<JwtSettings> jwtOptions) : IAuthService
    {
        private readonly JwtSettings _jwtSettings = jwtOptions.Value;

        public async Task<AuthResponseDto> LoginAsync(LoginRequestDto request)
        {
            var user = await dbContext.Users
                .Include(u => u.Campus)
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user is null || !user.IsActive || !await userManager.CheckPasswordAsync(user, request.Password))
            {
                throw new UnauthorizedException("Invalid email or password.");
            }

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

        public async Task<(string Email, string Token)?> ForgotPasswordAsync(string email)
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user is null || !user.IsActive) return null;

            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            return (user.Email!, token);
        }

        public async Task ResetPasswordAsync(ResetPasswordRequestDto request)
        {
            var user = await userManager.FindByEmailAsync(request.Email)
                ?? throw new BadRequestException("Invalid or expired reset link.");

            var result = await userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
            if (!result.Succeeded)
                throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));
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
