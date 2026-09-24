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
using PSUEISKOLARSystem.Server.Infrastructure;
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
        IEmailService emailService,
        BackgroundEmailer mail) : IAuthService
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

            var policy = await SystemSettingsStore.GetAsync(dbContext);

            // Identity reads its lockout policy from options fixed at startup, so the
            // configurable threshold and duration are applied to the user here instead.
            userManager.Options.Lockout.MaxFailedAccessAttempts = policy.MaxFailedLoginAttempts;
            userManager.Options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(policy.LockoutMinutes);

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

            if (policy.RequireEmailVerification && !user.EmailConfirmed)
            {
                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId  = user.Id,
                    Action  = "LoginFailed",
                    Details = $"Failed login for '{request.Email}': email not verified",
                });
                await dbContext.SaveChangesAsync();
                throw new UnauthorizedException(user.ApprovalStatus == ApprovalStatuses.Pending
                    ? "Your registration is waiting for approval by the scholarship office. You can sign in once it is approved, or sooner by clicking the verification link sent to your email."
                    : "Your email address has not been verified. Please check your inbox and click the verification link before signing in.");
            }

            if (user.TwoFactorEnabled)
            {
                var code = await userManager.GenerateTwoFactorTokenAsync(user, TokenOptions.DefaultEmailProvider);
                await emailService.SendTwoFactorCodeAsync(user.Email!, user.FullName, code);
                return new AuthResponseDto { Requires2fa = true, TwoFaTicket = GenerateTwoFactorTicket(user.Id) };
            }

            var roles = await userManager.GetRolesAsync(user);
            var role = roles.FirstOrDefault() ?? throw new UnauthorizedException("User has no assigned role.");

            // Administrators are exempt: locking them out during maintenance would leave
            // nobody able to turn maintenance off again.
            if (policy.MaintenanceMode && role != UserRoles.Administrator)
            {
                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId  = user.Id,
                    Action  = "LoginFailed",
                    Details = $"Login blocked for '{request.Email}': maintenance mode",
                });
                await dbContext.SaveChangesAsync();
                throw new UnauthorizedException(policy.MaintenanceMessage);
            }

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

        /// <summary>
        /// The master-list pre-check behind the sign-up form's first step. Says only whether
        /// the details match and what kind of account they would open — never who else is on
        /// the list.
        /// </summary>
        public async Task<EligibilityCheckResultDto> CheckEligibilityAsync(EligibilityCheckRequestDto request)
        {
            var matches = await MasterList.FindMatchesAsync(
                dbContext, request.StudentId, request.FirstName, request.LastName, request.MiddleName, request.CampusId);

            if (matches.Count == 0)
            {
                var sid = MasterList.NormalizeStudentId(request.StudentId);
                var alreadyRegistered =
                    await dbContext.ScholarProfiles.AnyAsync(sp => sp.StudentId == sid) ||
                    await dbContext.GranteeProfiles.AnyAsync(gp => gp.StudentId == sid);

                return new EligibilityCheckResultDto
                {
                    Matched = false,
                    Message = alreadyRegistered
                        ? "An account has already been created for this student number. Sign in instead, or use Forgot Password."
                        : NoMatchMessage,
                };
            }

            var scholarLine = matches.FirstOrDefault(m => m.Kind == EligibilityKinds.Scholar);
            return new EligibilityCheckResultDto
            {
                Matched = true,
                Kind = scholarLine is not null ? EligibilityKinds.Scholar : EligibilityKinds.Grantee,
                ScholarshipTypeName = scholarLine?.ScholarshipType?.Name,
                GrantTypeNames = matches
                    .Where(m => m.Kind == EligibilityKinds.Grantee && m.GrantType is not null)
                    .Select(m => m.GrantType!.Name)
                    .ToList(),
            };
        }

        private const string NoMatchMessage =
            "Your details do not match the scholarship office's list of scholars and grantees, so an " +
            "account cannot be created. Enter your student number and name exactly as they appear on " +
            "your school records, choose the correct campus, or contact the scholarship office.";

        /// <summary>
        /// Self sign-up for scholars and grantees. The details are cross-matched against the
        /// master list; a match opens the account immediately (no approval queue), a miss
        /// refuses it outright. A Scholar line makes a scholar holding that line's scholarship;
        /// Grantee lines make a grantee — or, for a student who is on both, a scholar with the
        /// grants recorded on their profile, since a scholar can be a grantee but not the
        /// other way round.
        /// </summary>
        public async Task<UserDto> RegisterScholarAsync(RegisterScholarRequestDto request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            if (!email.EndsWith("@" + PersonalOptions.InstitutionalDomain))
                throw new BadRequestException($"Use your institutional email address (@{PersonalOptions.InstitutionalDomain}). Personal email addresses are not accepted.");

            if (!request.ConsentAccepted)
                throw new BadRequestException("You must agree to the Data Privacy notice to create an account.");

            if (await userManager.FindByEmailAsync(email) is not null)
                throw new BadRequestException("An account with this email already exists.");

            var personalError = request.Personal.Validate();
            if (personalError is not null) throw new BadRequestException(personalError);

            if (request.BirthDate is DateTime bd && (bd.Date > DateTime.UtcNow.Date || bd.Year < 1900))
                throw new BadRequestException("Enter a valid birth date.");

            // Profile checks run before the account exists, so a rejected profile never
            // leaves a half-registered user behind.
            var studentId = MasterList.NormalizeStudentId(request.StudentId);
            if (await dbContext.ScholarProfiles.AnyAsync(sp => sp.StudentId == studentId) ||
                await dbContext.GranteeProfiles.AnyAsync(gp => gp.StudentId == studentId))
                throw new BadRequestException($"Student ID {studentId} is already registered to another account.");

            var campus = await dbContext.Campuses.FirstOrDefaultAsync(c => c.Id == request.CampusId && c.IsActive)
                ?? throw new BadRequestException("The selected campus is not available.");

            if (!await dbContext.CampusPrograms.AnyAsync(cp => cp.CampusId == campus.Id && cp.ProgramId == request.ProgramId))
                throw new BadRequestException($"The selected course is not offered at {campus.Name}.");

            var matches = await MasterList.FindMatchesAsync(
                dbContext, studentId, request.FirstName, request.LastName, request.MiddleName, campus.Id);
            if (matches.Count == 0)
                throw new BadRequestException(NoMatchMessage);

            var scholarLine = matches.FirstOrDefault(m => m.Kind == EligibilityKinds.Scholar);
            var granteeLines = matches.Where(m => m.Kind == EligibilityKinds.Grantee).ToList();
            var role = scholarLine is not null ? UserRoles.Scholar : UserRoles.Grantee;

            var policy = await SystemSettingsStore.GetAsync(dbContext);

            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FirstName = MasterList.NormalizeName(request.FirstName),
                MiddleName = MasterList.NormalizeOptionalName(request.MiddleName),
                LastName = MasterList.NormalizeName(request.LastName),
                // Skipping verification only makes sense if nothing is going to be emailed
                // to that address anyway, which is what the email switch decides.
                EmailConfirmed = !policy.RequireEmailVerification || !policy.EmailEnabled,
                // The master-list match is the approval.
                ApprovalStatus = ApprovalStatuses.Approved,
                ApprovalDecidedAt = DateTime.UtcNow,
                ApprovalNote = "Approved automatically: matched the master list.",
                ConsentAcceptedAt = DateTime.UtcNow,
                ConsentVersion = PrivacyNotice.CurrentVersion,
            };

            var result = await userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
                throw new BadRequestException(string.Join("; ", result.Errors.Select(e => e.Description)));

            try
            {
                if (scholarLine is not null)
                {
                    // The ledger enforces one scholarship per student and the slot quota.
                    var rejection = await ScholarshipRegistry.SetAsync(
                        dbContext, user.Id, scholarLine.ScholarshipTypeId, user.Id, actorIsStaff: false);
                    if (rejection is not null)
                        throw new BadRequestException(rejection);

                    var profile = new ScholarProfile
                    {
                        UserId = user.Id,
                        StudentId = studentId,
                        CampusId = campus.Id,
                        ProgramId = request.ProgramId,
                        ScholarshipTypeId = scholarLine.ScholarshipTypeId,
                        YearLevel = request.YearLevel,
                        ContactNumber = request.ContactNumber.Trim(),
                        BirthDate = request.BirthDate?.Date,
                        Address = request.Address.Trim(),
                    };
                    request.Personal.ApplyTo(profile.Personal);
                    dbContext.ScholarProfiles.Add(profile);

                    scholarLine.ClaimedByUserId = user.Id;
                    scholarLine.ClaimedAt = DateTime.UtcNow;
                }
                else
                {
                    var profile = new GranteeProfile
                    {
                        UserId = user.Id,
                        StudentId = studentId,
                        CampusId = campus.Id,
                        ProgramId = request.ProgramId,
                        YearLevel = request.YearLevel,
                        ContactNumber = request.ContactNumber.Trim(),
                        BirthDate = request.BirthDate?.Date,
                        Address = request.Address.Trim(),
                    };
                    request.Personal.ApplyTo(profile.Personal);
                    dbContext.GranteeProfiles.Add(profile);
                }

                foreach (var line in granteeLines)
                    MasterList.ClaimGranteeLine(dbContext, line, user.Id, actorId: null);

                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId = user.Id,
                    Action = "RegisterAccount",
                    Details = $"{user.FullName} ({studentId}) signed up as {role} — matched the master list" +
                              (granteeLines.Count > 0 ? $"; {granteeLines.Count} grant(s) recorded" : ""),
                });

                await userManager.AddToRoleAsync(user, role);
                await dbContext.SaveChangesAsync();
            }
            catch
            {
                // Drop the unsaved profile, ledger and grant rows so the delete doesn't retry them.
                dbContext.ChangeTracker.Clear();
                await userManager.DeleteAsync(user);
                throw;
            }

            if (policy.RequireEmailVerification && policy.EmailEnabled)
                await QueueVerificationEmailAsync(user);

            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = role;
            return userDto;
        }

        /* Generates a fresh confirmation token and emails the verification link.
           The send is queued rather than awaited: an SMTP failure (wrong app password, relay
           down) used to throw out of registration after the account had already been
           created, leaving the sign-up form stuck on "Creating account…" — and under the
           debugger, freezing the whole server. BackgroundEmailer logs the failure instead. */
        private async Task QueueVerificationEmailAsync(ApplicationUser user)
        {
            var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
            var verifyLink = $"{_emailSettings.AppBaseUrl}/verify-email" +
                             $"?email={Uri.EscapeDataString(user.Email!)}" +
                             $"&token={Uri.EscapeDataString(token)}";

            string email = user.Email!, name = user.FullName;
            mail.Queue($"email verification to {email}", s => s.SendEmailVerificationAsync(email, name, verifyLink));
        }

        // Re-sends the verification link if the account exists and is still unverified.
        // Returns false for unknown/already-verified emails (caller responds generically
        // to avoid leaking which emails are registered).
        public async Task<bool> ResendVerificationAsync(string email)
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user is null || user.EmailConfirmed) return false;

            await QueueVerificationEmailAsync(user);
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
                // Registering again is refused (the email is taken), so point at the recovery that
                // actually exists: the resend link offered on the sign-in page.
                throw new BadRequestException("This verification link is invalid or has expired. Sign in with your email to request a new link.");
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

            string to = user.Email!, name = user.FullName;
            mail.Queue($"password reset to {to}", s => s.SendPasswordResetEmailAsync(to, name, resetLink));
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

        public async Task<AuthResponseDto> IssueSessionAsync(string userId)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");
            var role = (await userManager.GetRolesAsync(user)).FirstOrDefault() ?? string.Empty;

            var (token, expiresAtUtc) = GenerateJwtToken(user, role);
            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = role;
            return new AuthResponseDto { Token = token, ExpiresAtUtc = expiresAtUtc, User = userDto };
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
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),

                // Pins the token to the account as it stands right now. SessionValidator
                // compares it per request, so a password change or reset invalidates every
                // token issued before it instead of leaving them live until they expire.
                new(SessionValidator.StampClaim, user.SecurityStamp ?? string.Empty)
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
