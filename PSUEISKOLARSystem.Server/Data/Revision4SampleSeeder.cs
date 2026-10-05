using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.DTOs.Scholars;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// Sample data for trying out the revision-4 pages on a development database: scholars and
    /// grantees with sex and dropdown-style addresses, documents at every review stage, a
    /// missed and an upcoming deadline, scheduled releases for both semesters, a grant type
    /// with no release date yet, a cross-match conflict, and students listed but not yet
    /// signed up. Every sample account signs in with ChangeMe123!.
    /// <para>
    /// Development only (sample passwords are public) and idempotent: a marker account stops
    /// it from running twice.
    /// </para>
    /// </summary>
    public static class Revision4SampleSeeder
    {
        public const string Password = "ChangeMe123!";
        private const string MarkerEmail = "demo.scholar1@psu.edu.ph";

        private sealed record Person(
            string Email, string StudentId, string Last, string First, string Middle, string Sex,
            string CampusCode, string ProgramCode, int Year, string Address, bool FatherDeceased = false);

        public static async Task<bool> SeedAsync(IServiceProvider services)
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var users = services.GetRequiredService<UserManager<ApplicationUser>>();
            var notifications = services.GetService<INotificationService>();
            var config = services.GetService<IConfiguration>();

            if (await users.FindByEmailAsync(MarkerEmail) is not null) return false;
            var admin = await users.FindByEmailAsync("admin@psu.edu.ph");
            if (admin is null) return false;

            var campuses = await db.Campuses.ToDictionaryAsync(c => c.Code, c => c.Id);
            if (!campuses.ContainsKey("LN")) return false;

            /* ── Programs with majors ─────────────────────────────── */
            var bsba = new[] { ("BSBA-OM", "Operations Management"), ("BSBA-FM", "Financial Management") };
            foreach (var (code, major) in bsba)
            {
                if (await db.AcademicPrograms.AnyAsync(p => p.Code == code)) continue;
                var p = new AcademicProgram { Name = "BS Business Administration", Major = major, Code = code };
                foreach (var cid in campuses.Values) p.Campuses.Add(new CampusProgram { CampusId = cid });
                db.AcademicPrograms.Add(p);
            }
            await db.SaveChangesAsync();
            var programs = await db.AcademicPrograms.ToDictionaryAsync(p => p.Code, p => p.Id);
            int Program(string code) => programs.TryGetValue(code, out var id) ? id : programs.Values.First();

            /* ── Scholarship and grant types ──────────────────────── */
            var types = await db.ScholarshipTypes.ToListAsync();
            ScholarshipType? TypeLike(string part) => types.FirstOrDefault(t => t.Name.Contains(part, StringComparison.OrdinalIgnoreCase));
            var ched = TypeLike("CHED");
            var dost = TypeLike("DOST");
            var psu = TypeLike("PSU");
            var lgu = TypeLike("LGU");
            if (ched is null || dost is null || psu is null || lgu is null) return false;

            var noDateGrant = new GrantType
            {
                Name = "Educational Assistance Program",
                Sponsor = "DSWD",
                Description = "Sample: release date not known yet — set it from Grant Types to notify the grantees.",
                DefaultAmount = 5000m,
            };
            var datedGrant = new GrantType
            {
                Name = "Calamity Relief Grant",
                Sponsor = "PSU Alumni Association",
                Description = "Sample: release date set — grantee accounts close automatically the day after.",
                DefaultAmount = 3000m,
                ScheduledDate = PhilippineToday().AddDays(10),
            };
            if (!await db.GrantTypes.AnyAsync(g => g.Name == noDateGrant.Name)) db.GrantTypes.Add(noDateGrant);
            else noDateGrant = await db.GrantTypes.FirstAsync(g => g.Name == noDateGrant.Name);
            if (!await db.GrantTypes.AnyAsync(g => g.Name == datedGrant.Name)) db.GrantTypes.Add(datedGrant);
            else datedGrant = await db.GrantTypes.FirstAsync(g => g.Name == datedGrant.Name);
            await db.SaveChangesAsync();

            /* ── Scholars ─────────────────────────────────────────── */
            var scholars = new (Person P, ScholarshipType Type)[]
            {
                (new("demo.scholar1@psu.edu.ph", "24-LN-0101", "SANTIAGO", "MARICEL", "DOMINGO", "Female", "LN", "BSBA-OM", 2,
                    "45 RIZAL ST., BAAY, LINGAYEN, PANGASINAN, REGION I", FatherDeceased: true), ched),
                (new("demo.scholar2@psu.edu.ph", "24-INF-0102", "RAMOS", "CARLO", "VILLAR", "Male", "INF", "BSIT", 3,
                    "PUROK 3, BAMBAN, INFANTA, PANGASINAN, REGION I"), ched),
                (new("demo.scholar3@psu.edu.ph", "24-BIN-0103", "FLORES", "JOANNA", "PASCUA", "Female", "BIN", "BSCS", 1,
                    "12 MABINI ST., BALOGO, BINMALEY, PANGASINAN, REGION I"), dost),
                (new("demo.scholar4@psu.edu.ph", "24-BY-0104", "TORRES", "MIGUEL", "AQUINO", "Male", "BY", "BSCE", 4,
                    "88 QUEZON BLVD., ALINGGAN, BAYAMBANG, PANGASINAN, REGION I"), psu),
                (new("demo.scholar5@psu.edu.ph", "24-ALA-0105", "NAVARRO", "KRISTINE", "LUNA", "Female", "ALA", "BSBA-FM", 2,
                    "7 BONIFACIO ST., AMANDIEGO, CITY OF ALAMINOS, PANGASINAN, REGION I"), lgu),
                (new("demo.scholar6@psu.edu.ph", "24-URD-0106", "DE GUZMAN", "PATRICIA", "SORIANO", "Female", "URD", "BSN", 1,
                    "21 ROXAS ST., ANONAS, CITY OF URDANETA, PANGASINAN, REGION I"), ched),
            };

            var scholarIds = new List<string>();
            foreach (var (p, type) in scholars)
            {
                var user = await CreateUserAsync(users, p, UserRoles.Scholar);
                if (user is null) { scholarIds.Add(""); continue; }
                scholarIds.Add(user.Id);

                var profile = new ScholarProfile
                {
                    UserId = user.Id,
                    StudentId = p.StudentId,
                    CampusId = campuses[p.CampusCode],
                    ProgramId = Program(p.ProgramCode),
                    ScholarshipTypeId = type.Id,
                    YearLevel = p.Year,
                    ContactNumber = $"+63917555{p.StudentId[^4..]}",
                    BirthDate = new DateTime(2004, 1 + p.Year, 10 + p.Year),
                    Address = p.Address,
                    // Enrolled before this period's deadlines, so a passed one counts as missed.
                    EnrolledAt = DateTime.UtcNow.AddDays(-120),
                };
                Sheet(p).ApplyTo(profile.Personal);
                db.ScholarProfiles.Add(profile);
                await db.SaveChangesAsync();
                await ScholarshipRegistry.BackfillAsync(db, profile, null);

                // The scholar line they signed up from.
                db.EligibilityRecords.Add(Line(p, EligibilityKinds.Scholar, campuses[p.CampusCode], type.Id, null, null, user.Id));

                db.AcademicGrades.Add(new AcademicGrade
                {
                    ScholarProfileId = profile.Id,
                    AcademicYear = "2024-2025",
                    Semester = 2,
                    Gwa = 1.50m + p.Year * 0.25m,
                    MeetsRequirement = 1.50m + p.Year * 0.25m <= type.MinimumGwa,
                });
            }
            await db.SaveChangesAsync();

            // Scholar 5 also received a one-time grant: one row on the Master List with both.
            if (scholarIds[4] != "")
            {
                var (p5, _) = scholars[4];
                var line = Line(p5, EligibilityKinds.Grantee, campuses[p5.CampusCode], null, noDateGrant, 5000m, null);
                db.EligibilityRecords.Add(line);
                MasterList.ClaimGranteeLine(db, line, scholarIds[4], admin.Id);
            }

            /* ── Grantees ─────────────────────────────────────────── */
            var grantees = new (Person P, GrantType Grant)[]
            {
                (new("demo.grantee1@psu.edu.ph", "24-LN-0201", "CABRAL", "JENNY", "MORALES", "Female", "LN", "BSED", 1,
                    "3 LUNA ST., BALANGOBONG, LINGAYEN, PANGASINAN, REGION I"), noDateGrant),
                (new("demo.grantee2@psu.edu.ph", "24-URD-0202", "PADILLA", "ROMEO", "CRUZ", "Male", "URD", "BSA", 2,
                    "SITIO CENTRO, BOLAOEN, CITY OF URDANETA, PANGASINAN, REGION I"), noDateGrant),
                (new("demo.grantee3@psu.edu.ph", "24-INF-0203", "LIM", "ANGELICA", "TAN", "Female", "INF", "BSCrim", 3,
                    "9 MAGSAYSAY ST., CATO, INFANTA, PANGASINAN, REGION I"), noDateGrant),
                (new("demo.grantee4@psu.edu.ph", "24-BY-0204", "SALVADOR", "DENNIS", "REYES", "Male", "BY", "BSEE", 2,
                    "PUROK 1, AMAMPEREZ, BAYAMBANG, PANGASINAN, REGION I"), datedGrant),
                (new("demo.grantee5@psu.edu.ph", "24-LN-0205", "VALDEZ", "SHEENA", "BAUTISTA", "Female", "LN", "BSN", 1,
                    "15 BURGOS ST., BALOCOC, LINGAYEN, PANGASINAN, REGION I"), datedGrant),
            };
            foreach (var (p, grant) in grantees)
            {
                var user = await CreateUserAsync(users, p, UserRoles.Grantee);
                if (user is null) continue;
                var profile = new GranteeProfile
                {
                    UserId = user.Id,
                    StudentId = p.StudentId,
                    CampusId = campuses[p.CampusCode],
                    ProgramId = Program(p.ProgramCode),
                    YearLevel = p.Year,
                    ContactNumber = $"+63918555{p.StudentId[^4..]}",
                    BirthDate = new DateTime(2005, p.Year + 2, 5),
                    Address = p.Address,
                };
                Sheet(p).ApplyTo(profile.Personal);
                db.GranteeProfiles.Add(profile);
                var line = Line(p, EligibilityKinds.Grantee, campuses[p.CampusCode], null, grant, null, null);
                db.EligibilityRecords.Add(line);
                MasterList.ClaimGranteeLine(db, line, user.Id, admin.Id);
            }
            await db.SaveChangesAsync();

            /* ── Listed, not yet signed up ────────────────────────── */
            var waiting = new (Person P, int? TypeId, GrantType? Grant)[]
            {
                (new("", "25-LN-0301", "OCAMPO", "BEA", "SANTOS", "Female", "LN", "", 1, ""), ched.Id, null),
                (new("", "25-ASIN-0302", "MERCADO", "JOSHUA", "DIAZ", "Male", "ASIN", "", 1, ""), ched.Id, null),
                (new("", "25-SM-0303", "GALANG", "RHEA", "MANALO", "Female", "SM", "", 1, ""), dost.Id, null),
                (new("", "25-BIN-0304", "AGUSTIN", "PAOLO", "RIVERA", "Male", "BIN", "", 1, ""), psu.Id, null),
                (new("", "25-URD-0305", "CORPUZ", "LOVELY", "ABAD", "Female", "URD", "", 1, ""), null, noDateGrant),
                (new("", "25-ALA-0306", "ESPINO", "MARK", "TOLENTINO", "Male", "ALA", "", 1, ""), null, datedGrant),
            };
            foreach (var (p, typeId, grant) in waiting)
                if (!await db.EligibilityRecords.AnyAsync(e => e.StudentId == p.StudentId))
                    db.EligibilityRecords.Add(Line(p, typeId is null ? EligibilityKinds.Grantee : EligibilityKinds.Scholar,
                        campuses[p.CampusCode], typeId, grant, null, null));

            // Cross-match conflict: scholar 4 holds PSU Institutional but is also on the CHED list.
            EligibilityRecord? conflictLine = null;
            if (scholarIds[3] != "")
            {
                var (p4, _) = scholars[3];
                conflictLine = Line(p4, EligibilityKinds.Scholar, campuses[p4.CampusCode], ched.Id, null, null, null);
                conflictLine.Notes = "Sample cross-match: this scholar already holds PSU Institutional.";
                db.EligibilityRecords.Add(conflictLine);
            }
            await db.SaveChangesAsync();
            if (conflictLine is not null && notifications is not null &&
                await MasterList.FindConflictAsync(db, conflictLine) is { } conflict)
                await MasterList.NotifyConflictAsync(db, notifications, conflict);

            /* ── Documents and deadlines (active period) ──────────── */
            var period = await db.ActiveSemesters.FirstOrDefaultAsync();
            var year = period?.AcademicYear ?? $"{DateTime.UtcNow.Year}-{DateTime.UtcNow.Year + 1}";
            var sem = period?.Semester ?? 1;
            var reqs = await db.DocumentRequirements.Where(r => r.IsActive && r.ScholarshipTypeId == null).ToListAsync();
            DocumentRequirement? Req(string part) => reqs.FirstOrDefault(r => r.Name.Contains(part, StringComparison.OrdinalIgnoreCase));

            var uploads = config?["FileStorage:BasePath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            Directory.CreateDirectory(uploads);
            var now = DateTime.UtcNow;

            async Task Submit(string scholarId, DocumentRequirement? req, DocumentStatus status, string? feedback, int daysAgo)
            {
                if (scholarId == "" || req is null) return;
                var stored = $"{Guid.NewGuid()}.pdf";
                var bytes = SamplePdf(req.Name, $"Sample document submitted for {year} Semester {sem}.");
                await File.WriteAllBytesAsync(Path.Combine(uploads, stored), bytes);
                var submittedAt = now.AddDays(-daysAgo);
                var s = new DocumentSubmission
                {
                    ScholarId = scholarId,
                    RequirementId = req.Id,
                    FileName = $"{req.Name.Split(' ', '/')[0].ToLowerInvariant()}_sample.pdf",
                    StoredFileName = stored,
                    ContentType = "application/pdf",
                    FileSizeBytes = bytes.Length,
                    Status = status,
                    FeedbackNote = feedback,
                    AcademicYear = year,
                    Semester = sem,
                    SubmittedAt = submittedAt,
                    ReviewedById = status is DocumentStatus.Verified or DocumentStatus.Rejected ? admin.Id : null,
                    ReviewedAt = status is DocumentStatus.Verified or DocumentStatus.Rejected ? submittedAt.AddDays(1) : null,
                };
                s.StatusHistory.Add(new DocumentStatusHistory { Status = "Pending", Note = "Document submitted by scholar.", ChangedById = scholarId, ChangedAt = submittedAt });
                if (status != DocumentStatus.Pending)
                    s.StatusHistory.Add(new DocumentStatusHistory { Status = "UnderReview", Note = "The scholarship office is reviewing this document.", ChangedById = admin.Id, ChangedAt = submittedAt.AddHours(20) });
                if (status is DocumentStatus.Verified or DocumentStatus.Rejected)
                    s.StatusHistory.Add(new DocumentStatusHistory { Status = status.ToString(), Note = feedback, ChangedById = admin.Id, ChangedAt = submittedAt.AddDays(1) });
                db.DocumentSubmissions.Add(s);
            }

            // Scholar 1: one document at every stage of the tracker.
            await Submit(scholarIds[0], Req("Registration"), DocumentStatus.Verified, null, 6);
            await Submit(scholarIds[0], Req("Grade"), DocumentStatus.UnderReview, null, 4);
            await Submit(scholarIds[0], Req("Birth"), DocumentStatus.Pending, null, 2);
            await Submit(scholarIds[0], Req("Government"), DocumentStatus.Rejected,
                "The ID is expired. Please upload a valid, unexpired government-issued ID.", 5);
            // Scholar 2 and 3: waiting in Document Review.
            await Submit(scholarIds[1], Req("Registration"), DocumentStatus.Pending, null, 1);
            await Submit(scholarIds[1], Req("Application"), DocumentStatus.Pending, null, 1);
            await Submit(scholarIds[2], Req("Registration"), DocumentStatus.Pending, null, 3);
            // Scholar 5: everything verified so far.
            await Submit(scholarIds[4], Req("Registration"), DocumentStatus.Verified, null, 9);
            await Submit(scholarIds[4], Req("Good Moral"), DocumentStatus.Verified, null, 9);
            // Scholar 6 submits nothing — the passed deadline below locks the document for them.
            await db.SaveChangesAsync();

            async Task Deadline(DocumentRequirement? req, int days)
            {
                if (req is null) return;
                if (await db.SubmissionDeadlines.AnyAsync(d => d.RequirementId == req.Id && d.AcademicYear == year && d.Semester == sem)) return;
                db.SubmissionDeadlines.Add(new SubmissionDeadline
                {
                    RequirementId = req.Id, AcademicYear = year, Semester = sem,
                    DueDate = now.Date.AddDays(days).AddHours(15).AddMinutes(59), // 11:59 PM Manila
                    CreatedById = admin.Id,
                });
            }
            await Deadline(Req("Good Moral"), -7);      // passed: locked for anyone who sent nothing
            await Deadline(Req("Application"), 14);      // upcoming
            await Deadline(Req("Birth"), 21);
            await db.SaveChangesAsync();

            /* ── Releases scheduled for both semesters ────────────── */
            if (ScholarshipFrequencies.IsRecurring(ched.Frequency) && ched.Frequency == ScholarshipFrequencies.PerSemester)
            {
                var amount = ched.Amount ?? 10000m;
                for (int i = 0; i < scholars.Length; i++)
                {
                    if (scholarIds[i] == "" || scholars[i].Type.Id != ched.Id) continue;
                    foreach (var s in new[] { 1, 2 })
                    {
                        if (await db.ScholarshipReleases.AnyAsync(r => r.ScholarId == scholarIds[i] && r.ScholarshipTypeId == ched.Id && r.AcademicYear == year && r.Semester == s)) continue;
                        db.ScholarshipReleases.Add(new ScholarshipRelease
                        {
                            ScholarId = scholarIds[i],
                            ScholarshipTypeId = ched.Id,
                            AcademicYear = year,
                            Semester = s,
                            Amount = amount,
                            ScheduledDate = PhilippineToday().AddDays(3),
                            CampusId = campuses[scholars[i].P.CampusCode],
                            YearLevel = scholars[i].P.Year,
                            Notes = "Sample: semesters 1 and 2 released together.",
                            RecordedById = admin.Id,
                        });
                    }
                }
                await db.SaveChangesAsync();
            }

            db.AuditLogs.Add(new AuditLog { UserId = admin.Id, Action = "SeedSampleData", Details = "Seeded revision-4 sample data (demo.* accounts)" });
            await db.SaveChangesAsync();
            return true;
        }

        /* ── helpers ── */

        private static DateTime PhilippineToday() => DateTime.UtcNow.AddHours(8).Date;

        private static async Task<ApplicationUser?> CreateUserAsync(UserManager<ApplicationUser> users, Person p, string role)
        {
            if (await users.FindByEmailAsync(p.Email) is not null) return null;
            var u = new ApplicationUser
            {
                UserName = p.Email,
                Email = p.Email,
                FirstName = p.First,
                MiddleName = p.Middle,
                LastName = p.Last,
                EmailConfirmed = true,
                IsActive = true,
                ApprovalStatus = ApprovalStatuses.Approved,
                ApprovalDecidedAt = DateTime.UtcNow,
                ApprovalNote = "Sample account: matched the master list.",
                ConsentAcceptedAt = DateTime.UtcNow,
                ConsentVersion = PrivacyNotice.CurrentVersion,
            };
            if (!(await users.CreateAsync(u, Password)).Succeeded) return null;
            await users.AddToRoleAsync(u, role);
            return u;
        }

        private static EligibilityRecord Line(Person p, string kind, int campusId, int? scholarshipTypeId, GrantType? grant, decimal? amount, string? claimedBy) => new()
        {
            Kind = kind,
            StudentId = p.StudentId,
            LastName = p.Last,
            FirstName = p.First,
            MiddleName = p.Middle,
            Sex = p.Sex,
            CampusId = campusId,
            ScholarshipTypeId = scholarshipTypeId,
            GrantTypeId = grant?.Id,
            GrantType = grant,
            GrantAmount = amount,
            Notes = "Sample data.",
            ClaimedByUserId = claimedBy,
            ClaimedAt = claimedBy is null ? null : DateTime.UtcNow,
        };

        private static PersonalDetailsDto Sheet(Person p) => new()
        {
            Sex = p.Sex,
            CivilStatus = "Single",
            Is4PsBeneficiary = p.Year % 2 == 1,
            IsFirstGenerationStudent = p.Sex == "Female",
            FatherLastName = p.Last,
            FatherFirstName = p.Sex == "Female" ? "ROBERTO" : "ERNESTO",
            FatherMiddleName = "CRUZ",
            FatherLiving = !p.FatherDeceased,
            FatherEducation = "High School Graduate",
            FatherOccupation = "FARMER",
            FatherMonthlyIncome = 9000m,
            MotherLastName = p.Last,
            MotherFirstName = "TERESITA",
            MotherMiddleName = p.Middle,
            MotherLiving = true,
            MotherEducation = "College Level",
            MotherOccupation = "SARI-SARI STORE OWNER",
            MotherMonthlyIncome = 7000m,
            FamilyMembers = 5,
            Siblings = 2,
            SiblingsStudying = 1,
            MainSupportSource = "Parents",
        };

        /// <summary>A one-page PDF with a heading and a line of text, so previews show something.</summary>
        private static byte[] SamplePdf(string title, string line)
        {
            static string Esc(string s) => s.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
            var content = $"BT /F1 20 Tf 60 760 Td ({Esc(title)}) Tj ET\nBT /F1 12 Tf 60 730 Td ({Esc(line)}) Tj ET\n" +
                          "BT /F1 12 Tf 60 710 Td (PSU e-Iskolar - SAMPLE ONLY) Tj ET\n";
            var objects = new[]
            {
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
                $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}endstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            };
            var sb = new StringBuilder("%PDF-1.4\n");
            var offsets = new List<int>();
            for (int i = 0; i < objects.Length; i++)
            {
                offsets.Add(Encoding.ASCII.GetByteCount(sb.ToString()));
                sb.Append($"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
            }
            var xref = Encoding.ASCII.GetByteCount(sb.ToString());
            sb.Append($"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
            foreach (var o in offsets) sb.Append($"{o:D10} 00000 n \n");
            sb.Append($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
            return Encoding.ASCII.GetBytes(sb.ToString());
        }
    }
}
