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
        BackgroundEmailer mail,
        INotificationService notifications) : IAuthService
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

            // Every coordinator is in charge of one campus, and every campus has one coordinator.
            int? campusId = null;
            if (request.Role == UserRoles.ScholarshipCoordinator)
            {
                if (await CoordinatorCampusProblemAsync(dbContext, request.CampusId, null) is { } problem)
                    throw new BadRequestException(problem);
                campusId = request.CampusId;
            }

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FirstName = request.FirstName.Trim(),
                MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? null : request.MiddleName.Trim(),
                LastName = request.LastName.Trim(),
                EmailConfirmed = true,
                CampusId = campusId,
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
        /// Why a coordinator cannot be put in charge of <paramref name="campusId"/>: no campus
        /// chosen, an unknown campus, or a campus that already has an active coordinator.
        /// Null when the assignment is fine. <paramref name="exceptUserId"/> is the coordinator
        /// being edited, who may keep their own campus.
        /// </summary>
        public static async Task<string?> CoordinatorCampusProblemAsync(ApplicationDbContext db, int? campusId, string? exceptUserId)
        {
            if (campusId is not int cid) return "Choose the campus this coordinator is in charge of.";
            var campus = await db.Campuses.Where(c => c.Id == cid).Select(c => c.Name).FirstOrDefaultAsync();
            if (campus is null) return "The selected campus does not exist.";
            var holder = await (
                from u in db.Users
                join ur in db.UserRoles on u.Id equals ur.UserId
                join r in db.Roles on ur.RoleId equals r.Id
                where r.Name == UserRoles.ScholarshipCoordinator && u.IsActive && u.CampusId == cid && u.Id != exceptUserId
                select u.FirstName + " " + u.LastName).FirstOrDefaultAsync();
            return holder is null ? null : $"{campus} already has a coordinator ({holder}). Each campus has one coordinator.";
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
                // A past grantee the office has since listed as a scholar: their grantee account
                // already became their scholar account, so there is nothing to sign up for.
                if (await UpgradedAccountMessageAsync(request.StudentId, request.FirstName, request.LastName, request.MiddleName) is { } upgraded)
                    return new EligibilityCheckResultDto { Matched = false, Message = upgraded };

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

            // Listed as a scholar but already holding a grantee account (found by student number
            // or by name): the system asks for it, and that account is reused.
            var granteeEmail = scholarLine is null ? null : (await MasterList.FindGranteeAccountAsync(
                dbContext, request.StudentId, request.FirstName, request.LastName, request.MiddleName))?.User.Email;

            return new EligibilityCheckResultDto
            {
                Matched = true,
                ExistingGranteeAccount = granteeEmail is not null,
                ExistingAccountEmail = MaskEmail(granteeEmail),
                Kind = scholarLine is not null ? EligibilityKinds.Scholar : EligibilityKinds.Grantee,
                ScholarshipTypeName = scholarLine?.ScholarshipType?.Name,
                GrantTypeNames = matches
                    .Where(m => m.Kind == EligibilityKinds.Grantee && m.GrantType is not null)
                    .Select(m => m.GrantType!.Name)
                    .ToList(),
            };
        }

        /// <summary>
        /// Null unless this student's grantee account was upgraded to a scholar account (see
        /// <see cref="MasterList.UpgradeGranteeToScholarAsync"/>) — then what to tell them instead
        /// of opening a second account. Found by student number or by unambiguous name.
        /// </summary>
        private async Task<string?> UpgradedAccountMessageAsync(string studentId, string firstName, string lastName, string? middleName)
        {
            var sid = MasterList.NormalizeStudentId(studentId);
            var first = MasterList.NormalizeName(firstName);
            var last = MasterList.NormalizeName(lastName);
            var middle = MasterList.NormalizeOptionalName(middleName);

            var upgraded = await dbContext.ScholarProfiles
                .Where(sp => sp.ConvertedFromGranteeAt != null
                          && (sp.StudentId == sid || (sp.User.FirstName == first && sp.User.LastName == last)))
                .Select(sp => new { sp.StudentId, sp.User.Email, sp.User.MiddleName })
                .ToListAsync();
            var account = upgraded.FirstOrDefault(a => a.StudentId == sid)
                ?? (upgraded.Count(a => a.MiddleName is null || middle is null || a.MiddleName == middle) == 1
                    ? upgraded.First(a => a.MiddleName is null || middle is null || a.MiddleName == middle)
                    : null);
            if (account is null) return null;

            return $"You already have an account. Your grantee account ({MaskEmail(account.Email)}) was upgraded to a " +
                   "scholar account when the scholarship office listed you as a scholar. Sign in with the same email and " +
                   "password — your one-time grants are still on your profile. Forgot the password? Use Forgot Password on the sign-in page.";
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
            // Students sign up with their own personal email (Gmail, Yahoo, …) — an address they
            // keep after they leave the university. The DTO already checks it is well-formed.
            var email = request.Email.Trim().ToLowerInvariant();

            if (!request.ConsentAccepted)
                throw new BadRequestException("You must agree to the Data Privacy notice to create an account.");

            var studentId = MasterList.NormalizeStudentId(request.StudentId);

            // A past grantee now listed as a scholar keeps their account rather than opening a
            // second one — see ConvertGranteeToScholarAsync. Found by student number or, when
            // the scholar list uses another number, by name; only once they are on a scholar list.
            var existingGrantee = await MasterList.FindGranteeAccountAsync(
                dbContext, studentId, request.FirstName, request.LastName, request.MiddleName);
            if (existingGrantee is not null && (existingGrantee.StudentId == studentId ||
                (await MasterList.FindMatchesAsync(dbContext, studentId, request.FirstName, request.LastName, request.MiddleName, request.CampusId))
                    .Any(m => m.Kind == EligibilityKinds.Scholar)))
                return await ConvertGranteeToScholarAsync(existingGrantee, email, request);

            if (await userManager.FindByEmailAsync(email) is { } taken)
                // Their own grantee account, already upgraded by the office's listing: say so.
                throw new BadRequestException(
                    (await dbContext.ScholarProfiles.AnyAsync(sp => sp.UserId == taken.Id && sp.ConvertedFromGranteeAt != null)
                        ? await UpgradedAccountMessageAsync(studentId, request.FirstName, request.LastName, request.MiddleName)
                        : null)
                    ?? "An account with this email already exists.");

            // Profile checks run before the account exists, so a rejected profile never
            // leaves a half-registered user behind.
            var campus = await ValidateSheetAsync(request);

            if (await dbContext.ScholarProfiles.AnyAsync(sp => sp.StudentId == studentId))
                throw new BadRequestException(
                    await UpgradedAccountMessageAsync(studentId, request.FirstName, request.LastName, request.MiddleName)
                    ?? $"Student ID {studentId} is already registered to another account.");

            var matches = await MasterList.FindMatchesAsync(
                dbContext, studentId, request.FirstName, request.LastName, request.MiddleName, campus.Id);
            if (matches.Count == 0)
                // Already upgraded from their grantee account by the office's listing: say so.
                throw new BadRequestException(
                    await UpgradedAccountMessageAsync(studentId, request.FirstName, request.LastName, request.MiddleName) ?? NoMatchMessage);

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

            if (policy.RequireEmailVerification && policy.EmailEnabled && !user.EmailConfirmed)
                await QueueVerificationEmailAsync(user);

            // Matched more than one scholarship's list: the account holds the first, and the
            // office is told about each other one so it can decide.
            foreach (var other in matches.Where(m => m.Kind == EligibilityKinds.Scholar && m != scholarLine))
                if (await MasterList.FindConflictAsync(dbContext, other) is { } conflict)
                    await MasterList.NotifyConflictAsync(dbContext, notifications, conflict);

            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = role;
            userDto.EmailVerificationRequired = policy.RequireEmailVerification && !user.EmailConfirmed;
            return userDto;
        }

        /// <summary>The Scholar's Data sheet checks shared by sign-up and grantee conversion. Returns the campus.</summary>
        private async Task<Campus> ValidateSheetAsync(RegisterScholarRequestDto request)
        {
            var personalError = request.Personal.Validate();
            if (personalError is not null) throw new BadRequestException(personalError);

            if (request.BirthDate is DateTime bd && (bd.Date > DateTime.UtcNow.Date || bd.Year < 1900))
                throw new BadRequestException("Enter a valid birth date.");

            var campus = await dbContext.Campuses.FirstOrDefaultAsync(c => c.Id == request.CampusId && c.IsActive)
                ?? throw new BadRequestException("The selected campus is not available.");

            if (!await dbContext.CampusPrograms.AnyAsync(cp => cp.CampusId == campus.Id && cp.ProgramId == request.ProgramId))
                throw new BadRequestException($"The selected course is not offered at {campus.Name}.");

            return campus;
        }

        /// <summary>
        /// Checks that a past grantee is who they say they are: the email is the grantee
        /// account's, the password is right, and the name on it is the name that matched a
        /// scholar line. Wrong passwords count toward the lockout exactly as a sign-in would.
        /// Returns the scholar line.
        /// </summary>
        private async Task<EligibilityRecord> AuthenticateGranteeForConversionAsync(
            GranteeProfile grantee, string email, string password, EligibilityCheckRequestDto identity)
        {
            var user = grantee.User;
            if (!string.Equals(user.Email, email.Trim(), StringComparison.OrdinalIgnoreCase))
                throw new BadRequestException(
                    $"Student No. {grantee.StudentId} already has a grantee account ({MaskEmail(user.Email)}). " +
                    "Enter that account's email and password to turn it into your scholar account.");

            if (await userManager.IsLockedOutAsync(user))
                throw new BadRequestException("Your grantee account is temporarily locked after too many attempts. Please try again in a few minutes.");

            if (!await userManager.CheckPasswordAsync(user, password))
            {
                await userManager.AccessFailedAsync(user);
                throw new BadRequestException(
                    "That password is not correct for your grantee account. If you no longer remember it, " +
                    "use Forgot Password on the sign-in page first.");
            }
            await userManager.ResetAccessFailedCountAsync(user);

            var matches = await MasterList.FindMatchesAsync(
                dbContext, identity.StudentId, identity.FirstName, identity.LastName, identity.MiddleName, identity.CampusId);
            var scholarLine = matches.FirstOrDefault(m => m.Kind == EligibilityKinds.Scholar)
                ?? throw new BadRequestException(
                    "Your grantee account can become a scholar account only once the scholarship office has " +
                    "listed you as a scholar. Contact the scholarship office.");

            if (MasterList.NormalizeName(user.FirstName) != MasterList.NormalizeName(identity.FirstName) ||
                MasterList.NormalizeName(user.LastName) != MasterList.NormalizeName(identity.LastName))
                throw new BadRequestException(NoMatchMessage);

            return scholarLine;
        }

        public async Task<GranteeConversionPrefillDto> GetGranteeAccountForConversionAsync(GranteeAccountLookupDto request)
        {
            var grantee = await MasterList.FindGranteeAccountAsync(
                    dbContext, request.StudentId, request.FirstName, request.LastName, request.MiddleName)
                ?? throw new BadRequestException("No grantee account was found for this student.");

            await AuthenticateGranteeForConversionAsync(grantee, request.Email, request.Password, request);

            return new GranteeConversionPrefillDto
            {
                Email = grantee.User.Email!,
                // Only carried over when the chosen campus offers that course.
                ProgramId = await dbContext.CampusPrograms.AnyAsync(cp => cp.CampusId == request.CampusId && cp.ProgramId == grantee.ProgramId)
                    ? grantee.ProgramId
                    : null,
                YearLevel = grantee.YearLevel,
                ContactNumber = grantee.ContactNumber,
                BirthDate = grantee.BirthDate,
                Address = grantee.Address,
                Personal = DTOs.Scholars.PersonalDetailsDto.From(grantee.Personal),
                GrantCount = await dbContext.OneTimeGrants.CountAsync(g => g.ScholarId == grantee.UserId),
            };
        }

        /// <summary>
        /// Grantee → scholar. A student who already holds a grantee account (usually deactivated
        /// once their grant was released) and is now on the list as a scholar does not get a
        /// second account: the grantee account is reactivated and becomes their scholar account.
        /// The profile is rebuilt from the sheet they have just updated, the scholarship comes
        /// from the scholar line, and every one-time grant stays on the account — so what they
        /// received as a grantee still shows on their scholar profile.
        /// </summary>
        private async Task<UserDto> ConvertGranteeToScholarAsync(GranteeProfile grantee, string email, RegisterScholarRequestDto request)
        {
            var user = grantee.User;
            var identity = new EligibilityCheckRequestDto
            {
                StudentId = request.StudentId,
                FirstName = request.FirstName,
                LastName = request.LastName,
                MiddleName = request.MiddleName,
                CampusId = request.CampusId,
            };
            var scholarLine = await AuthenticateGranteeForConversionAsync(grantee, email, request.Password, identity);
            var campus = await ValidateSheetAsync(request);

            // The scholar account goes by the number the scholar list uses, which may differ from
            // the one the student had as a grantee.
            var studentId = scholarLine.StudentId;
            if (await dbContext.ScholarProfiles.AnyAsync(sp => sp.UserId == user.Id || sp.StudentId == studentId))
                throw new BadRequestException($"Student ID {studentId} is already registered to a scholar account.");

            var matches = await MasterList.FindMatchesAsync(
                dbContext, request.StudentId, request.FirstName, request.LastName, request.MiddleName, campus.Id);
            var granteeLines = matches.Where(m => m.Kind == EligibilityKinds.Grantee).ToList();

            try
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
                dbContext.GranteeProfiles.Remove(grantee);

                scholarLine.ClaimedByUserId = user.Id;
                scholarLine.ClaimedAt = DateTime.UtcNow;
                foreach (var line in granteeLines)
                    MasterList.ClaimGranteeLine(dbContext, line, user.Id, actorId: null);

                user.MiddleName = MasterList.NormalizeOptionalName(request.MiddleName) ?? user.MiddleName;
                user.IsActive = true;
                user.ConsentAcceptedAt = DateTime.UtcNow;
                user.ConsentVersion = PrivacyNotice.CurrentVersion;

                dbContext.AuditLogs.Add(new AuditLog
                {
                    UserId = user.Id,
                    Action = "ConvertGranteeToScholar",
                    Details = $"{user.FullName} ({studentId}) turned their grantee account into a scholar account " +
                              $"under {scholarLine.ScholarshipType?.Name ?? "the listed scholarship"} — matched the master list" +
                              (granteeLines.Count > 0 ? $"; {granteeLines.Count} grant(s) recorded" : ""),
                });

                await dbContext.SaveChangesAsync();
            }
            catch
            {
                dbContext.ChangeTracker.Clear();
                throw;
            }

            // Rotating the stamp retires any session still carrying the Grantee role.
            await userManager.RemoveFromRoleAsync(user, UserRoles.Grantee);
            await userManager.AddToRoleAsync(user, UserRoles.Scholar);
            await userManager.UpdateSecurityStampAsync(user);

            var userDto = mapper.Map<UserDto>(user);
            userDto.Role = UserRoles.Scholar;
            return userDto;
        }

        /// <summary>"23ln0001_ms@psu.edu.ph" → "23l••••••••@psu.edu.ph": enough to recognise, not to harvest.</summary>
        private static string? MaskEmail(string? email)
        {
            if (string.IsNullOrEmpty(email)) return null;
            var at = email.IndexOf('@');
            if (at <= 0) return email;
            var local = email[..at];
            var keep = Math.Clamp(local.Length / 3, 1, 3);
            return local[..keep] + new string('•', Math.Max(3, local.Length - keep)) + email[at..];
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
            var typed = email.Trim();
            var user = await userManager.FindByEmailAsync(typed);

            // Not a sign-in address — it may be a staff member's recovery address. Only used
            // when exactly one account holds it; uniqueness is enforced when it is set.
            if (user is null && typed.Length > 0)
            {
                var owners = await dbContext.Users
                    .Where(u => u.RecoveryEmail == typed)
                    .Take(2)
                    .ToListAsync();
                if (owners.Count == 1) user = owners[0];
            }
            if (user is null) return false;

            // A deactivated account cannot reset its password — except a past grantee's, which
            // they need in order to turn it into a scholar account. The reset alone does not
            // let them sign in; only that conversion reactivates the account.
            if (!user.IsActive && !await dbContext.GranteeProfiles.AnyAsync(gp => gp.UserId == user.Id))
                return false;

            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var resetLink = $"{_emailSettings.AppBaseUrl}/reset-password" +
                            $"?email={Uri.EscapeDataString(user.Email!)}" +
                            $"&token={Uri.EscapeDataString(token)}";

            // The sign-in address always gets the link; a recovery address gets it too, since
            // an office address may be one nobody can open.
            var destinations = new List<string> { user.Email! };
            if (!string.IsNullOrWhiteSpace(user.RecoveryEmail)
                && !string.Equals(user.RecoveryEmail, user.Email, StringComparison.OrdinalIgnoreCase))
                destinations.Add(user.RecoveryEmail);

            var name = user.FullName;
            foreach (var to in destinations)
                mail.Queue($"password reset to {to}", s => s.SendPasswordResetEmailAsync(to, name, resetLink));

            // Only whether an account matched — never where the link went. This endpoint is
            // anonymous, so naming the destinations would tell anyone who types an office
            // address that it has a recovery inbox, and part of what that inbox is.
            return true;
        }

        public async Task SendRecoveryEmailCodeAsync(string userId, string recoveryEmail, string password)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");
            if (!await userManager.CheckPasswordAsync(user, password))
                throw new BadRequestException("Incorrect password.");

            var address = await ValidateRecoveryEmailAsync(user, recoveryEmail);
            var code = await userManager.GenerateUserTokenAsync(
                user, TokenOptions.DefaultEmailProvider, RecoveryEmailPurpose(address));

            // Sent straight away rather than queued: the person is on the page waiting for it,
            // and a failed send should be reported to them, not only logged.
            await emailService.SendRecoveryEmailCodeAsync(address, user.FullName, code);
        }

        public async Task<UserDto> ConfirmRecoveryEmailAsync(string userId, string recoveryEmail, string code)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");

            var address = await ValidateRecoveryEmailAsync(user, recoveryEmail);
            var valid = await userManager.VerifyUserTokenAsync(
                user, TokenOptions.DefaultEmailProvider, RecoveryEmailPurpose(address), code.Trim());
            if (!valid)
                throw new BadRequestException("That code is incorrect or has expired. Send a new one and try again.");

            user.RecoveryEmail = address;
            await userManager.UpdateAsync(user);
            // A reset link already sent to the previous recovery address must stop working.
            await userManager.UpdateSecurityStampAsync(user);
            dbContext.AuditLogs.Add(new AuditLog
            {
                UserId  = user.Id,
                Action  = "RecoveryEmailSet",
                Details = $"Recovery email set to {MaskEmail(address)}",
            });
            await dbContext.SaveChangesAsync();
            return await GetCurrentUserAsync(userId);
        }

        public async Task<UserDto> RemoveRecoveryEmailAsync(string userId, string password)
        {
            var user = await userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("User not found.");
            if (!await userManager.CheckPasswordAsync(user, password))
                throw new BadRequestException("Incorrect password.");

            user.RecoveryEmail = null;
            await userManager.UpdateAsync(user);
            // Removing it is how a compromised recovery inbox is cut off, so any reset link
            // already delivered there must stop working too.
            await userManager.UpdateSecurityStampAsync(user);
            dbContext.AuditLogs.Add(new AuditLog
            {
                UserId  = user.Id,
                Action  = "RecoveryEmailRemoved",
                Details = "Recovery email removed",
            });
            await dbContext.SaveChangesAsync();
            return await GetCurrentUserAsync(userId);
        }

        // The address is part of the purpose, so a code only confirms the address it was sent to.
        private static string RecoveryEmailPurpose(string address) => $"RecoveryEmail:{address.ToLowerInvariant()}";

        private async Task<string> ValidateRecoveryEmailAsync(ApplicationUser user, string recoveryEmail)
        {
            var roles = await userManager.GetRolesAsync(user);
            if (!roles.Contains(UserRoles.Administrator) && !roles.Contains(UserRoles.ScholarshipCoordinator))
                throw new BadRequestException("A recovery email is only used by staff accounts.");

            var address = recoveryEmail.Trim();
            if (address.Length > 256 || !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(address))
                throw new BadRequestException("Enter a valid email address.");
            if (string.Equals(address, user.Email, StringComparison.OrdinalIgnoreCase))
                throw new BadRequestException("Use a different address from the one you sign in with.");

            var taken = await dbContext.Users.AnyAsync(u => u.Id != user.Id
                && (u.Email == address || u.RecoveryEmail == address));
            if (taken)
                throw new BadRequestException("That email address is already used by another account.");
            return address;
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
