using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Settings;

namespace PSUEISKOLARSystem.Server.Controllers
{
    // Bulk scholar account onboarding (FR-15). Admin-only.
    [ApiController]
    [Route("api/users/import")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class UserImportController(
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        IEmailService emailService,
        IOptions<EmailSettings> emailOptions) : ControllerBase
    {
        private const int MaxRows = 1000;

        // Columns the importer understands (case-insensitive header match).
        private static readonly string[] TemplateHeaders =
        {
            "FirstName", "MiddleName", "LastName", "Email",
            "CampusCode", "StudentId", "ProgramCode", "ScholarshipType",
            "YearLevel", "ContactNumber", "Password",
        };

        // GET /api/users/import/template.xlsx  (FR-15.4)
        [HttpGet("template.xlsx")]
        public async Task<IActionResult> Template()
        {
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Scholars");

            for (int i = 0; i < TemplateHeaders.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = TemplateHeaders[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                cell.Style.Font.FontColor = XLColor.White;
            }

            // One example row to guide the user.
            ws.Cell(2, 1).Value = "Juan";
            ws.Cell(2, 2).Value = "Santos";
            ws.Cell(2, 3).Value = "Dela Cruz";
            ws.Cell(2, 4).Value = "juan.delacruz@example.com";
            ws.Cell(2, 5).Value = "LC";
            ws.Cell(2, 6).Value = "2024-00123";
            ws.Cell(2, 7).Value = "BSCS";
            ws.Cell(2, 8).Value = "CHED";
            ws.Cell(2, 9).Value = 1;
            ws.Cell(2, 10).Value = "09171234567";
            ws.Cell(2, 11).Value = "(leave blank to auto-generate)";
            ws.Row(2).Style.Font.Italic = true;
            ws.Row(2).Style.Font.FontColor = XLColor.FromHtml("#8a94a6");

            ws.Columns().AdjustToContents();

            // Reference sheet: valid codes so admins pick correct values.
            var refWs = wb.Worksheets.Add("Reference");
            refWs.Cell(1, 1).Value = "Campus Code";
            refWs.Cell(1, 2).Value = "Campus Name";
            refWs.Cell(1, 4).Value = "Program Code";
            refWs.Cell(1, 5).Value = "Program Name";
            refWs.Cell(1, 7).Value = "Scholarship Type";
            foreach (var c in new[] { 1, 2, 4, 5, 7 })
            {
                refWs.Cell(1, c).Style.Font.Bold = true;
                refWs.Cell(1, c).Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                refWs.Cell(1, c).Style.Font.FontColor = XLColor.White;
            }

            var campuses = await db.Campuses.OrderBy(c => c.Name).ToListAsync();
            for (int i = 0; i < campuses.Count; i++)
            {
                refWs.Cell(i + 2, 1).Value = campuses[i].Code;
                refWs.Cell(i + 2, 2).Value = campuses[i].Name;
            }
            var programs = await db.AcademicPrograms.OrderBy(p => p.Code).ToListAsync();
            for (int i = 0; i < programs.Count; i++)
            {
                refWs.Cell(i + 2, 4).Value = programs[i].Code;
                refWs.Cell(i + 2, 5).Value = programs[i].Name;
            }
            var types = await db.ScholarshipTypes.OrderBy(t => t.Name).ToListAsync();
            for (int i = 0; i < types.Count; i++)
                refWs.Cell(i + 2, 7).Value = types[i].Name;

            refWs.Columns().AdjustToContents();

            var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);
            return File(ms, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "scholar_import_template.xlsx");
        }

        // POST /api/users/import   (multipart/form-data, field "file")  (FR-15.1/15.2/15.3/15.5)
        [HttpPost]
        public async Task<IActionResult> Import(IFormFile file)
        {
            if (file is null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded." });

            List<Dictionary<string, string>> rows;
            try
            {
                rows = file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
                    ? ParseCsv(file)
                    : ParseXlsx(file);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Could not read the file: {ex.Message}" });
            }

            if (rows.Count == 0)
                return BadRequest(new { message = "The file contains no data rows." });
            if (rows.Count > MaxRows)
                return BadRequest(new { message = $"Too many rows ({rows.Count}). Maximum is {MaxRows} per import." });

            // Preload lookups (case-insensitive).
            var campusByCode = await db.Campuses.ToDictionaryAsync(c => c.Code.ToUpper(), c => c.Id);
            var programByCode = await db.AcademicPrograms.ToDictionaryAsync(p => p.Code.ToUpper(), p => p.Id);
            var typeByName = await db.ScholarshipTypes.ToDictionaryAsync(t => t.Name.ToUpper(), t => t.Id);

            var results = new List<ImportRowResult>();
            var welcomeEmails = new List<(string Email, string Name, string Password, string Link)>();
            var seenEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var baseUrl = emailOptions.Value.AppBaseUrl;
            int created = 0;

            for (int i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                int rowNo = i + 2; // header is row 1
                string Get(string key) => row.TryGetValue(key.ToUpper(), out var v) ? v.Trim() : "";

                var firstName = Get("FirstName");
                var middleName = Get("MiddleName");
                var lastName = Get("LastName");
                var email = Get("Email");
                var errors = new List<string>();

                if (string.IsNullOrWhiteSpace(firstName)) errors.Add("First name is required");
                if (string.IsNullOrWhiteSpace(lastName)) errors.Add("Last name is required");
                if (string.IsNullOrWhiteSpace(email))
                    errors.Add("Email is required");
                else if (!IsValidEmail(email))
                    errors.Add("Email is not a valid address");
                else if (!seenEmails.Add(email))
                    errors.Add("Duplicate email within the file");
                else if (await userManager.FindByEmailAsync(email) is not null)
                    errors.Add("An account with this email already exists");

                // Campus
                int? campusId = null;
                var campusCode = Get("CampusCode");
                if (!string.IsNullOrWhiteSpace(campusCode))
                {
                    if (campusByCode.TryGetValue(campusCode.ToUpper(), out var cid)) campusId = cid;
                    else errors.Add($"Unknown campus code '{campusCode}'");
                }

                // Profile fields
                var studentId = Get("StudentId");
                var programCode = Get("ProgramCode");
                var scholarshipType = Get("ScholarshipType");
                var yearLevelRaw = Get("YearLevel");
                var contactNumber = Get("ContactNumber");
                var hasProfileData = new[] { studentId, programCode, scholarshipType, yearLevelRaw, contactNumber }
                    .Any(v => !string.IsNullOrWhiteSpace(v));

                int? programId = null;
                if (!string.IsNullOrWhiteSpace(programCode))
                {
                    if (programByCode.TryGetValue(programCode.ToUpper(), out var pid)) programId = pid;
                    else errors.Add($"Unknown program code '{programCode}'");
                }

                int? typeId = null;
                if (!string.IsNullOrWhiteSpace(scholarshipType))
                {
                    if (typeByName.TryGetValue(scholarshipType.ToUpper(), out var tid)) typeId = tid;
                    else errors.Add($"Unknown scholarship type '{scholarshipType}'");
                }

                int yearLevel = 1;
                if (!string.IsNullOrWhiteSpace(yearLevelRaw))
                {
                    if (int.TryParse(yearLevelRaw, out var yl) && yl is >= 1 and <= 6) yearLevel = yl;
                    else errors.Add("Year level must be a number from 1 to 6");
                }

                if (hasProfileData && string.IsNullOrWhiteSpace(studentId))
                    errors.Add("Student ID is required when profile details are provided");

                if (errors.Count > 0)
                {
                    results.Add(new ImportRowResult(rowNo, email, false, string.Join("; ", errors)));
                    continue;
                }

                // Create the account.
                var providedPassword = Get("Password");
                var password = string.IsNullOrWhiteSpace(providedPassword) ? GenerateTempPassword() : providedPassword;

                var user = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    FirstName = firstName,
                    MiddleName = string.IsNullOrWhiteSpace(middleName) ? null : middleName,
                    LastName = lastName,
                    CampusId = campusId,
                    EmailConfirmed = false,
                    IsActive = true,
                };

                var createResult = await userManager.CreateAsync(user, password);
                if (!createResult.Succeeded)
                {
                    results.Add(new ImportRowResult(rowNo, email, false,
                        string.Join("; ", createResult.Errors.Select(e => e.Description))));
                    continue;
                }

                await userManager.AddToRoleAsync(user, UserRoles.Scholar);

                if (hasProfileData)
                {
                    db.ScholarProfiles.Add(new ScholarProfile
                    {
                        UserId = user.Id,
                        StudentId = studentId,
                        ProgramId = programId,
                        ScholarshipTypeId = typeId,
                        YearLevel = yearLevel,
                        ContactNumber = string.IsNullOrWhiteSpace(contactNumber) ? null : contactNumber,
                    });
                    await db.SaveChangesAsync();
                }

                var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
                var verifyLink = $"{baseUrl}/verify-email" +
                                 $"?email={Uri.EscapeDataString(user.Email!)}" +
                                 $"&token={Uri.EscapeDataString(token)}";
                welcomeEmails.Add((email, user.FullName, password, verifyLink));

                created++;
                results.Add(new ImportRowResult(rowNo, email, true, "Created"));
            }

            // Audit + fire welcome emails in the background.
            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            db.AuditLogs.Add(new AuditLog
            {
                UserId = actorId,
                Action = "BulkImportScholars",
                Details = $"Imported {created} of {rows.Count} scholar rows.",
            });
            await db.SaveChangesAsync();

            _ = SendWelcomeEmailsAsync(welcomeEmails);

            return Ok(new ImportSummary(rows.Count, created, rows.Count - created, results));
        }

        private async Task SendWelcomeEmailsAsync(List<(string Email, string Name, string Password, string Link)> emails)
        {
            foreach (var e in emails)
            {
                try { await emailService.SendScholarWelcomeAsync(e.Email, e.Name, e.Password, e.Link); }
                catch { /* one failed email shouldn't abort the rest */ }
            }
        }

        // ── Parsing helpers ──────────────────────────────────────────────
        private static List<Dictionary<string, string>> ParseXlsx(IFormFile file)
        {
            using var stream = file.OpenReadStream();
            using var wb = new XLWorkbook(stream);
            var ws = wb.Worksheet(1);
            var rows = new List<Dictionary<string, string>>();

            var firstRow = ws.FirstRowUsed();
            if (firstRow is null) return rows;

            // Map header text -> column number.
            var headerMap = new Dictionary<string, int>();
            foreach (var cell in firstRow.CellsUsed())
                headerMap[cell.GetString().Trim().ToUpper()] = cell.Address.ColumnNumber;

            foreach (var row in ws.RowsUsed().Skip(1))
            {
                var dict = new Dictionary<string, string>();
                bool anyValue = false;
                foreach (var (header, col) in headerMap)
                {
                    var val = row.Cell(col).GetString().Trim();
                    dict[header] = val;
                    if (!string.IsNullOrWhiteSpace(val)) anyValue = true;
                }
                if (anyValue) rows.Add(dict);
            }
            return rows;
        }

        private static List<Dictionary<string, string>> ParseCsv(IFormFile file)
        {
            using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8);
            var text = reader.ReadToEnd();
            var lines = SplitCsvLines(text);
            var rows = new List<Dictionary<string, string>>();
            if (lines.Count == 0) return rows;

            var headers = ParseCsvLine(lines[0]).Select(h => h.Trim().ToUpper()).ToList();
            for (int i = 1; i < lines.Count; i++)
            {
                if (string.IsNullOrWhiteSpace(lines[i])) continue;
                var fields = ParseCsvLine(lines[i]);
                var dict = new Dictionary<string, string>();
                for (int c = 0; c < headers.Count; c++)
                    dict[headers[c]] = c < fields.Count ? fields[c].Trim() : "";
                rows.Add(dict);
            }
            return rows;
        }

        private static List<string> SplitCsvLines(string text)
        {
            // Split on newlines that are not inside quotes.
            var lines = new List<string>();
            var sb = new StringBuilder();
            bool inQuotes = false;
            for (int i = 0; i < text.Length; i++)
            {
                char ch = text[i];
                if (ch == '"') inQuotes = !inQuotes;
                if ((ch == '\n' || ch == '\r') && !inQuotes)
                {
                    if (ch == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                    lines.Add(sb.ToString());
                    sb.Clear();
                }
                else sb.Append(ch);
            }
            if (sb.Length > 0) lines.Add(sb.ToString());
            return lines;
        }

        private static List<string> ParseCsvLine(string line)
        {
            var fields = new List<string>();
            var sb = new StringBuilder();
            bool inQuotes = false;
            for (int i = 0; i < line.Length; i++)
            {
                char ch = line[i];
                if (ch == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"') { sb.Append('"'); i++; }
                    else inQuotes = !inQuotes;
                }
                else if (ch == ',' && !inQuotes) { fields.Add(sb.ToString()); sb.Clear(); }
                else sb.Append(ch);
            }
            fields.Add(sb.ToString());
            return fields;
        }

        private static bool IsValidEmail(string email)
        {
            try { return new System.Net.Mail.MailAddress(email).Address == email; }
            catch { return false; }
        }

        // Cryptographically strong temporary password (16 chars) guaranteed to satisfy the
        // identity policy (upper, lower, digit, non-alphanumeric). Scholars are prompted to
        // change it after first sign-in; the account also requires email verification.
        private static string GenerateTempPassword()
        {
            const string lower = "abcdefghijkmnpqrstuvwxyz";
            const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const string digits = "23456789";
            const string special = "!@#$%*";
            const string all = lower + upper + digits + special;

            var chars = new List<char>
            {
                upper[RandomNumberGenerator.GetInt32(upper.Length)],
                lower[RandomNumberGenerator.GetInt32(lower.Length)],
                digits[RandomNumberGenerator.GetInt32(digits.Length)],
                special[RandomNumberGenerator.GetInt32(special.Length)],
            };
            while (chars.Count < 16)
                chars.Add(all[RandomNumberGenerator.GetInt32(all.Length)]);

            // Fisher–Yates shuffle driven by a CSPRNG.
            for (int i = chars.Count - 1; i > 0; i--)
            {
                int j = RandomNumberGenerator.GetInt32(i + 1);
                (chars[i], chars[j]) = (chars[j], chars[i]);
            }
            return new string(chars.ToArray());
        }

        public record ImportRowResult(int Row, string Email, bool Success, string Message);
        public record ImportSummary(int Total, int Created, int Failed, List<ImportRowResult> Results);
    }
}
