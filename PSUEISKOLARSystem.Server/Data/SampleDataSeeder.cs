using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Data
{
    // Seeds sample coordinators, scholars (with profiles + grades) and announcements for
    // demos/testing. Idempotent — a marker account guards against double-seeding.
    public static class SampleDataSeeder
    {
        public record SeedResult(int Coordinators, int Scholars, int Grades, int Announcements, bool AlreadySeeded, int Grants = 0);

        private const string Password = "Sample123!";
        private const string MarkerEmail = "sample.scholar1@psu.edu.ph";

        public static async Task<SeedResult> SeedAsync(IServiceProvider services)
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

            if (await userManager.FindByEmailAsync(MarkerEmail) is not null)
                return new SeedResult(0, 0, 0, 0, AlreadySeeded: true);

            var programs = await db.AcademicPrograms.OrderBy(p => p.Id).ToListAsync();
            var types = await db.ScholarshipTypes.OrderBy(t => t.Id).ToListAsync();

            int coordCount = 0, scholarCount = 0, gradeCount = 0, annCount = 0, grantCount = 0;
            var seededScholarIds = new List<string>();

            // ── Coordinators ──
            var coordDefs = new[]
            {
                ("Maria", "Lopez", "sample.coord1@psu.edu.ph"),
                ("Ramon", "Santos", "sample.coord2@psu.edu.ph"),
            };
            for (int i = 0; i < coordDefs.Length; i++)
            {
                var (fn, ln, em) = coordDefs[i];
                if (await userManager.FindByEmailAsync(em) is not null) continue;
                var u = new ApplicationUser { UserName = em, Email = em, FirstName = fn, LastName = ln, EmailConfirmed = true, IsActive = true };
                if ((await userManager.CreateAsync(u, Password)).Succeeded)
                {
                    await userManager.AddToRoleAsync(u, UserRoles.ScholarshipCoordinator);
                    coordCount++;
                }
            }

            // ── Scholars + profiles + grades ──
            var first = new[] { "Juan", "Ana", "Mark", "Liza", "Paolo", "Grace", "Neil", "Rhea" };
            var last = new[] { "Dela Cruz", "Reyes", "Garcia", "Bautista", "Villanueva", "Mendoza", "Aquino", "Castro" };
            var lifecycles = new[] { "Active", "Active", "Active", "Renewed", "Lapsed", "Active", "Suspended", "Active" };
            var rnd = new Random(42);

            for (int i = 0; i < first.Length; i++)
            {
                var em = $"sample.scholar{i + 1}@psu.edu.ph";
                if (await userManager.FindByEmailAsync(em) is not null) continue;

                var u = new ApplicationUser { UserName = em, Email = em, FirstName = first[i], LastName = last[i], EmailConfirmed = true, IsActive = true };
                if (!(await userManager.CreateAsync(u, Password)).Succeeded) continue;
                await userManager.AddToRoleAsync(u, UserRoles.Scholar);
                scholarCount++;
                seededScholarIds.Add(u.Id);

                var type = types.Count > 0 ? types[i % types.Count] : null;
                var profile = new ScholarProfile
                {
                    UserId = u.Id,
                    StudentId = $"2024-{1000 + i}",
                    ProgramId = programs.Count > 0 ? programs[i % programs.Count].Id : null,
                    ScholarshipTypeId = type?.Id,
                    YearLevel = (i % 4) + 1,
                    ContactNumber = $"0917{i:D7}",
                    LifecycleStatus = lifecycles[i],
                };
                db.ScholarProfiles.Add(profile);
                await db.SaveChangesAsync();

                // Open the scholarship ledger row for the sample scholar.
                await ScholarshipRegistry.BackfillAsync(db, profile, null);

                for (int sem = 1; sem <= 2; sem++)
                {
                    var gwa = Math.Round((decimal)(1.25 + rnd.NextDouble() * 2.5), 2); // 1.25–3.75
                    var meets = type is null || gwa <= type.MinimumGwa;
                    db.AcademicGrades.Add(new AcademicGrade
                    {
                        ScholarProfileId = profile.Id,
                        AcademicYear = "2024-2025",
                        Semester = sem,
                        Gwa = gwa,
                        MeetsRequirement = meets,
                    });
                    gradeCount++;
                }
                await db.SaveChangesAsync();
            }

            // ── Sample one-time grants (a mix of pending and released) ──
            var grantDefs = new[]
            {
                ("Tulong Dunong Assistance", "Book and supplies allowance", 5000m, "CHED", GrantReleaseStatuses.Released),
                ("Thesis Support Grant", "Printing, binding and data-gathering costs", 7500m, "PSU Research Office", GrantReleaseStatuses.Pending),
                ("Emergency Educational Aid", "One-off aid after Typhoon damage", 10000m, "PSU Alumni Association", GrantReleaseStatuses.Released),
                ("Board Exam Review Subsidy", "Licensure review fee subsidy", 12000m, "LGU Lingayen", GrantReleaseStatuses.Pending),
            };
            for (int i = 0; i < grantDefs.Length && i < seededScholarIds.Count; i++)
            {
                var (title, purpose, amount, source, status) = grantDefs[i];
                var released = status == GrantReleaseStatuses.Released;
                db.OneTimeGrants.Add(new OneTimeGrant
                {
                    ScholarId = seededScholarIds[i],
                    Title = title,
                    Purpose = purpose,
                    Amount = amount,
                    Source = source,
                    AwardedOn = DateTime.UtcNow.AddDays(-30 * (i + 1)),
                    ReleaseStatus = status,
                    ReleasedAt = released ? DateTime.UtcNow.AddDays(-30 * (i + 1) + 7) : null,
                    ReferenceNo = released ? $"OTG-{DateTime.UtcNow:yyyy}-{1000 + i}" : null,
                });
                grantCount++;
            }
            if (grantCount > 0) await db.SaveChangesAsync();

            // ── Sample announcements ──
            var admin = await userManager.FindByEmailAsync("admin@psu.edu.ph");
            if (admin is not null)
            {
                db.Announcements.Add(new Announcement
                {
                    Title = "Welcome to PSU e-Iskolar",
                    Content = "This is a sample announcement seeded for demonstration purposes.",
                    CreatedById = admin.Id,
                });
                db.Announcements.Add(new Announcement
                {
                    Title = "Submit your Certificate of Registration",
                    Content = "All scholars must submit their COR for the current semester.",
                    TargetRole = UserRoles.Scholar,
                    IntentAction = AnnouncementIntents.SubmitDocuments,
                    CreatedById = admin.Id,
                });
                annCount += 2;
                await db.SaveChangesAsync();
            }

            return new SeedResult(coordCount, scholarCount, gradeCount, annCount, AlreadySeeded: false, Grants: grantCount);
        }
    }
}
