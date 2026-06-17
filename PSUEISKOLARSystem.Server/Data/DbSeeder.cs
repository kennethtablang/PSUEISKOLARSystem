using Microsoft.AspNetCore.Identity;
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

            if (!db.Campuses.Any())
            {
                db.Campuses.AddRange(
                    new Campus { Name = "PSU Lingayen (Main)", Code = "LGY" },
                    new Campus { Name = "PSU Alaminos", Code = "ALA" },
                    new Campus { Name = "PSU Asingan", Code = "ASG" },
                    new Campus { Name = "PSU Bayambang", Code = "BYB" },
                    new Campus { Name = "PSU Infanta", Code = "INF" },
                    new Campus { Name = "PSU Sta. Maria", Code = "STM" },
                    new Campus { Name = "PSU Urdaneta", Code = "URD" }
                );
                await db.SaveChangesAsync();
            }

            if (!db.ScholarshipTypes.Any())
            {
                db.ScholarshipTypes.AddRange(
                    new ScholarshipType { Name = "CHED Scholarship", Description = "Commission on Higher Education merit scholarship", MinimumGwa = 1.75m },
                    new ScholarshipType { Name = "DOST-SEI Scholarship", Description = "Department of Science and Technology scholarship", MinimumGwa = 1.75m },
                    new ScholarshipType { Name = "PSU Institutional Scholarship", Description = "Pangasinan State University institutional grant", MinimumGwa = 2.00m },
                    new ScholarshipType { Name = "Local Government Unit (LGU)", Description = "Scholarship funded by local government", MinimumGwa = 2.25m },
                    new ScholarshipType { Name = "Private/External Grant", Description = "Scholarships from private organizations or donors", MinimumGwa = 2.50m }
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
                (Email: "admin@psu.edu.ph",       FullName: "System Administrator",      Role: UserRoles.Administrator,          Password: "ChangeMe123!"),
                (Email: "coordinator@psu.edu.ph", FullName: "Maria Santos (Coordinator)", Role: UserRoles.ScholarshipCoordinator, Password: "ChangeMe123!"),
                (Email: "scholar@psu.edu.ph",     FullName: "Juan Dela Cruz (Scholar)",   Role: UserRoles.Scholar,               Password: "ChangeMe123!"),
            };

            foreach (var (Email, FullName, Role, Password) in seedAccounts)
            {
                if (await userManager.FindByEmailAsync(Email) is null)
                {
                    var user = new ApplicationUser
                    {
                        UserName = Email,
                        Email = Email,
                        FullName = FullName,
                        EmailConfirmed = true
                    };
                    var result = await userManager.CreateAsync(user, Password);
                    if (result.Succeeded)
                        await userManager.AddToRoleAsync(user, Role);
                }
            }
        }
    }
}
