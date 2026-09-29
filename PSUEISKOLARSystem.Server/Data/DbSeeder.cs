using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Data
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(IServiceProvider services)
        {
            var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
            foreach (var role in UserRoles.All)
            {
                if (!await roleManager.RoleExistsAsync(role))
                    await roleManager.CreateAsync(new IdentityRole(role));
            }

            var db = services.GetRequiredService<ApplicationDbContext>();

            if (!db.ScholarshipTypes.Any())
            {
                db.ScholarshipTypes.AddRange(
                    new ScholarshipType { Name = "CHED Scholarship", Description = "Commission on Higher Education merit scholarship", Category = "Government", MinimumGwa = 1.75m },
                    new ScholarshipType { Name = "DOST-SEI Scholarship", Description = "Department of Science and Technology scholarship", Category = "Government", MinimumGwa = 1.75m },
                    new ScholarshipType { Name = "PSU Institutional Scholarship", Description = "Pangasinan State University institutional grant", Category = "Institutional", MinimumGwa = 2.00m },
                    new ScholarshipType { Name = "Local Government Unit (LGU)", Description = "Scholarship funded by local government", Category = "Local (LGU)", MinimumGwa = 2.25m },
                    new ScholarshipType { Name = "Private/External Grant", Description = "Scholarships from private organizations or donors", Category = "Private", MinimumGwa = 2.50m }
                );
                await db.SaveChangesAsync();
            }

            if (!db.AcademicPrograms.Any())
            {
                db.AcademicPrograms.AddRange(
                    new AcademicProgram { Name = "BS Computer Science", Code = "BSCS" },
                    new AcademicProgram { Name = "BS Information Technology", Code = "BSIT" },
                    new AcademicProgram { Name = "BS Education", Code = "BSED" },
                    new AcademicProgram { Name = "BS Business Administration", Code = "BSBA" },
                    new AcademicProgram { Name = "BS Agriculture", Code = "BSA" },
                    new AcademicProgram { Name = "BS Electrical Engineering", Code = "BSEE" },
                    new AcademicProgram { Name = "BS Civil Engineering", Code = "BSCE" },
                    new AcademicProgram { Name = "BS Criminology", Code = "BSCrim" },
                    new AcademicProgram { Name = "BS Nursing", Code = "BSN" },
                    new AcademicProgram { Name = "BS Accountancy", Code = "BSA-ACCT" }
                );
                await db.SaveChangesAsync();
            }

            await SeedCampusesAsync(db);

            if (!db.DocumentRequirements.Any())
            {
                db.DocumentRequirements.AddRange(
                    new DocumentRequirement { Name = "Certificate of Registration (COR)", Description = "Official COR for the current semester", IsRequired = true },
                    new DocumentRequirement { Name = "Grade Report / Transcript of Records", Description = "Official grades from the previous semester", IsRequired = true },
                    new DocumentRequirement { Name = "PSA Birth Certificate", Description = "Philippine Statistics Authority birth certificate", IsRequired = true },
                    new DocumentRequirement { Name = "Government-Issued ID", Description = "Any valid government-issued photo ID", IsRequired = true },
                    new DocumentRequirement { Name = "Good Moral Character Certificate", Description = "Certification from the Dean or Registrar", IsRequired = true },
                    new DocumentRequirement { Name = "Scholarship Application Form", Description = "Duly accomplished scholarship application form", IsRequired = true },
                    new DocumentRequirement { Name = "Income Tax Return / Certificate of Indigency", Description = "Proof of family financial status", IsRequired = false }
                );
                await db.SaveChangesAsync();
            }

            if (!db.ActiveSemesters.Any())
            {
                var month = DateTime.Now.Month;
                var year  = DateTime.Now.Year;
                var start = month >= 8 ? year : year - 1;
                db.ActiveSemesters.Add(new ActiveSemester
                {
                    AcademicYear = $"{start}-{start + 1}",
                    Semester     = (month >= 2 && month <= 7) ? 2 : 1,
                    UpdatedAt    = DateTime.UtcNow,
                });
                await db.SaveChangesAsync();
            }

            var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

            // Seed accounts: Administrator, Coordinator, Scholar
            var seedAccounts = new[]
            {
                (Email: "admin@psu.edu.ph",       FirstName: "System", MiddleName: (string?)null, LastName: "Administrator", Role: UserRoles.Administrator,          Password: "ChangeMe123!"),
                (Email: "coordinator@psu.edu.ph", FirstName: "Maria",  MiddleName: (string?)null, LastName: "Santos",        Role: UserRoles.ScholarshipCoordinator, Password: "ChangeMe123!"),
                (Email: "scholar@psu.edu.ph",     FirstName: "Juan",   MiddleName: "Dela",        LastName: "Cruz",          Role: UserRoles.Scholar,               Password: "ChangeMe123!"),
            };

            foreach (var (Email, FirstName, MiddleName, LastName, Role, Password) in seedAccounts)
            {
                if (await userManager.FindByEmailAsync(Email) is null)
                {
                    var user = new ApplicationUser
                    {
                        UserName = Email,
                        Email = Email,
                        FirstName = FirstName,
                        MiddleName = MiddleName,
                        LastName = LastName,
                        EmailConfirmed = true
                    };
                    var result = await userManager.CreateAsync(user, Password);
                    if (result.Succeeded)
                        await userManager.AddToRoleAsync(user, Role);
                }
            }

            await SeedSampleGranteeAsync(db, userManager);
        }

        public const string SampleGranteeEmail = "grantee@psu.edu.ph";
        public const string SampleGranteeStudentId = "23-LN-9001";

        /// <summary>
        /// A sample grantee, so the grantee's side of the system can be tried out: their own
        /// "My Grants" page, what happens when an administrator deactivates the account once the
        /// grant is released, and the grantee → scholar sign-up. For that last one the master
        /// list also carries an unclaimed Scholar line for the same student: once the account
        /// is deactivated, signing up with student no. 23-LN-9001, ANA GARCIA MERCADO,
        /// Lingayen Campus offers to turn this account into a scholar account.
        /// Password: ChangeMe123!
        /// </summary>
        private static async Task SeedSampleGranteeAsync(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
        {
            if (await userManager.FindByEmailAsync(SampleGranteeEmail) is not null) return;
            if (await db.GranteeProfiles.AnyAsync(gp => gp.StudentId == SampleGranteeStudentId) ||
                await db.ScholarProfiles.AnyAsync(sp => sp.StudentId == SampleGranteeStudentId)) return;

            var campus = await db.Campuses.FirstOrDefaultAsync(c => c.Code == "LIN");
            var program = await db.AcademicPrograms.FirstOrDefaultAsync(p => p.Code == "BSIT");
            var scholarship = await db.ScholarshipTypes.FirstOrDefaultAsync(t => t.Name == "CHED Scholarship");
            if (campus is null || program is null) return;

            if (!await db.CampusPrograms.AnyAsync(cp => cp.CampusId == campus.Id && cp.ProgramId == program.Id))
                db.CampusPrograms.Add(new CampusProgram { CampusId = campus.Id, ProgramId = program.Id });

            var grantType = await db.GrantTypes.FirstOrDefaultAsync(t => t.Name == "Tulong Dunong Program");
            if (grantType is null)
            {
                grantType = new GrantType
                {
                    Name = "Tulong Dunong Program",
                    Sponsor = "CHED",
                    Description = "One-time financial assistance for qualified students.",
                    DefaultAmount = 7500m,
                };
                db.GrantTypes.Add(grantType);
            }
            await db.SaveChangesAsync();

            var user = new ApplicationUser
            {
                UserName = SampleGranteeEmail,
                Email = SampleGranteeEmail,
                FirstName = "ANA",
                MiddleName = "GARCIA",
                LastName = "MERCADO",
                EmailConfirmed = true,
                ApprovalStatus = ApprovalStatuses.Approved,
                ApprovalDecidedAt = DateTime.UtcNow,
                ApprovalNote = "Sample grantee account.",
            };
            if (!(await userManager.CreateAsync(user, "ChangeMe123!")).Succeeded) return;
            await userManager.AddToRoleAsync(user, UserRoles.Grantee);

            var profile = new GranteeProfile
            {
                UserId = user.Id,
                StudentId = SampleGranteeStudentId,
                CampusId = campus.Id,
                ProgramId = program.Id,
                YearLevel = 2,
                ContactNumber = "+639171234567",
                BirthDate = new DateTime(2005, 3, 14),
                Address = "POBLACION, LINGAYEN, PANGASINAN",
            };
            new DTOs.Scholars.PersonalDetailsDto
            {
                Sex = "Female",
                CivilStatus = "Single",
                Is4PsBeneficiary = true,
                IsFirstGenerationStudent = true,
                FatherLastName = "MERCADO",
                FatherFirstName = "JOSE",
                FatherMiddleName = "SANTOS",
                FatherLiving = true,
                FatherEducation = "High School Graduate",
                FatherOccupation = "FARMER",
                FatherMonthlyIncome = 12000m,
                MotherLastName = "MERCADO",
                MotherFirstName = "LOURDES",
                MotherMiddleName = "GARCIA",
                MotherLiving = true,
                MotherEducation = "College Level",
                MotherOccupation = "VENDOR",
                MotherMonthlyIncome = 8000m,
                FamilyMembers = 5,
                Siblings = 2,
                SiblingsStudying = 1,
                MainSupportSource = "Parents",
            }.ApplyTo(profile.Personal);
            db.GranteeProfiles.Add(profile);

            // The Grantee line the account was opened from, with its grant recorded.
            var granteeLine = new EligibilityRecord
            {
                Kind = EligibilityKinds.Grantee,
                StudentId = SampleGranteeStudentId,
                LastName = "MERCADO",
                FirstName = "ANA",
                MiddleName = "GARCIA",
                CampusId = campus.Id,
                GrantTypeId = grantType.Id,
                GrantType = grantType,
                GrantAmount = 7500m,
                Notes = "Sample grantee.",
            };
            db.EligibilityRecords.Add(granteeLine);
            MasterList.ClaimGranteeLine(db, granteeLine, user.Id, actorId: null);

            // An open Scholar line for the same student, to try the grantee → scholar sign-up.
            if (scholarship is not null)
            {
                db.EligibilityRecords.Add(new EligibilityRecord
                {
                    Kind = EligibilityKinds.Scholar,
                    StudentId = SampleGranteeStudentId,
                    LastName = "MERCADO",
                    FirstName = "ANA",
                    MiddleName = "GARCIA",
                    CampusId = campus.Id,
                    ScholarshipTypeId = scholarship.Id,
                    Notes = "Sample: lets the sample grantee try the grantee-to-scholar sign-up.",
                });
            }

            await db.SaveChangesAsync();
        }

        // The nine PSU campuses. Lingayen is where the system started, so profiles created
        // before campuses existed are placed there.
        private static readonly (string Code, string Name)[] PsuCampuses =
        [
            ("ALA", "Alaminos City Campus"),
            ("ASI", "Asingan Campus"),
            ("BAY", "Bayambang Campus"),
            ("BIN", "Binmaley Campus"),
            ("INF", "Infanta Campus"),
            ("LIN", "Lingayen Campus"),
            ("SCC", "San Carlos City Campus"),
            ("STM", "Santa Maria Campus"),
            ("URD", "Urdaneta City Campus"),
        ];

        private static async Task SeedCampusesAsync(ApplicationDbContext db)
        {
            if (db.Campuses.Any()) return;

            db.Campuses.AddRange(PsuCampuses.Select(c => new Campus { Code = c.Code, Name = c.Name }));
            await db.SaveChangesAsync();

            /* Every existing programme starts out offered at every campus so sign-up works on
               day one; the office then narrows each campus to what it actually runs on the
               Campuses & Programs page. */
            var campusIds = await db.Campuses.Select(c => c.Id).ToListAsync();
            var programIds = await db.AcademicPrograms.Select(p => p.Id).ToListAsync();
            db.CampusPrograms.AddRange(
                from c in campusIds
                from p in programIds
                select new CampusProgram { CampusId = c, ProgramId = p });

            var lingayen = await db.Campuses.FirstAsync(c => c.Code == "LIN");
            await db.ScholarProfiles
                .Where(sp => sp.CampusId == null)
                .ExecuteUpdateAsync(s => s.SetProperty(sp => sp.CampusId, lingayen.Id));

            await db.SaveChangesAsync();
        }
    }
}
