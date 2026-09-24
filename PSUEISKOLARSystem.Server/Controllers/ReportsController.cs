using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/reports")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class ReportsController(ApplicationDbContext db) : ControllerBase
    {
        private static readonly string[] ScholarHeaders =
        [
            "Student ID", "Last Name", "First Name", "Middle Name", "Email", "Campus",
            "Program", "Year Level", "Scholarship Type",
            "Latest GWA", "Meets Requirement", "Contact Number", "Birth Date"
        ];

        private static readonly string[] SubmissionHeaders =
        [
            "Scholar Name", "Email", "Requirement", "Status",
            "Academic Year", "Semester", "Submitted At", "Reviewed By", "Feedback", "File Name"
        ];

        /* ─────────────────────────── Scholars ─────────────────────────── */

        /* The master list is categorised by scholarship type: with no type chosen, every type
           gets its own worksheet (Excel) or its own section (PDF), so a DOST scholar never
           lands in the middle of the CHED list. Choosing a type exports that type alone. */

        // GET /api/reports/scholars.xlsx?scholarshipTypeId=&programId=&campusId=
        [HttpGet("scholars.xlsx")]
        public async Task<IActionResult> ScholarsExcel(
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] int? programId,
            [FromQuery] int? campusId)
        {
            var scholars = await LoadScholarsAsync(scholarshipTypeId, programId, campusId);

            using var wb = new XLWorkbook();
            var groups = GroupByType(scholars);
            if (groups.Count == 0) groups.Add(("Scholars", []));

            var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (heading, list) in groups)
            {
                var ws = wb.Worksheets.Add(SheetName(heading, usedNames));
                WriteHeaderRow(ws, ScholarHeaders);

                for (int row = 0; row < list.Count; row++)
                {
                    var sp = list[row];
                    var u = sp.User;
                    var latestGrade = sp.Grades.FirstOrDefault();
                    int r = row + 2;

                    ws.Cell(r, 1).Value = sp.StudentId ?? "";
                    ws.Cell(r, 2).Value = u?.LastName ?? "";
                    ws.Cell(r, 3).Value = u?.FirstName ?? "";
                    ws.Cell(r, 4).Value = u?.MiddleName ?? "";
                    ws.Cell(r, 5).Value = u?.Email ?? "";
                    ws.Cell(r, 6).Value = sp.Campus?.Name ?? "";
                    ws.Cell(r, 7).Value = sp.Program?.Code ?? "";
                    ws.Cell(r, 8).Value = $"Year {sp.YearLevel}";
                    ws.Cell(r, 9).Value = sp.ScholarshipType?.Name ?? "";
                    if (latestGrade != null)
                        ws.Cell(r, 10).Value = latestGrade.Gwa;
                    else
                        ws.Cell(r, 10).Value = "";
                    ws.Cell(r, 11).Value = latestGrade == null ? "No GWA" : (latestGrade.MeetsRequirement ? "Yes" : "No");
                    ws.Cell(r, 12).Value = sp.ContactNumber ?? "";
                    ws.Cell(r, 13).Value = sp.BirthDate.HasValue ? sp.BirthDate.Value.ToString("yyyy-MM-dd") : "";

                    if (latestGrade != null)
                    {
                        var complianceCell = ws.Cell(r, 11);
                        complianceCell.Style.Font.FontColor = XLColor.FromHtml(ReportPdf.ComplianceColor(latestGrade.MeetsRequirement));
                        complianceCell.Style.Font.Bold = true;
                    }
                }

                ws.Columns().AdjustToContents();
                ws.Column(5).Width = 30; // Email column
            }

            var suffix = await FileSuffixAsync(scholarshipTypeId);
            return Workbook(wb, $"scholars{suffix}_{DateTime.UtcNow:yyyyMMdd}.xlsx");
        }

        // GET /api/reports/scholars.pdf?scholarshipTypeId=&programId=&campusId=
        [HttpGet("scholars.pdf")]
        public async Task<IActionResult> ScholarsPdf(
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] int? programId,
            [FromQuery] int? campusId)
        {
            var scholars = await LoadScholarsAsync(scholarshipTypeId, programId, campusId);

            // The scholarship column is dropped: each section is already one scholarship.
            var columns = new ReportPdf.Column[]
            {
                new("Student ID", 1.1f), new("Last Name", 1.3f), new("First Name", 1.3f),
                new("Middle Name", 1.1f), new("Email", 2.2f), new("Campus", 1.4f), new("Program", 0.9f),
                new("Year", 0.5f), new("GWA", 0.6f),
                new("Meets Req.", 0.9f), new("Contact", 1.2f), new("Birth Date", 1.0f),
            };

            var groups = GroupByType(scholars)
                .Select(g => new ReportPdf.Group(g.Heading, g.Scholars.Select(sp =>
                {
                    var latest = sp.Grades.FirstOrDefault();
                    return new[]
                    {
                        new ReportPdf.Cell(sp.StudentId ?? ""),
                        new ReportPdf.Cell(sp.User?.LastName ?? ""),
                        new ReportPdf.Cell(sp.User?.FirstName ?? ""),
                        new ReportPdf.Cell(sp.User?.MiddleName ?? ""),
                        new ReportPdf.Cell(sp.User?.Email ?? ""),
                        new ReportPdf.Cell(sp.Campus?.Name ?? ""),
                        new ReportPdf.Cell(sp.Program?.Code ?? ""),
                        new ReportPdf.Cell(sp.YearLevel.ToString()),
                        new ReportPdf.Cell(latest?.Gwa.ToString("0.00") ?? "—"),
                        new ReportPdf.Cell(
                            latest is null ? "No GWA" : latest.MeetsRequirement ? "Yes" : "No",
                            ReportPdf.ComplianceColor(latest?.MeetsRequirement), Bold: latest is not null),
                        new ReportPdf.Cell(sp.ContactNumber ?? ""),
                        new ReportPdf.Cell(sp.BirthDate?.ToString("yyyy-MM-dd") ?? ""),
                    };
                }).ToList()))
                .ToList();

            var subtitle = await DescribeScholarFiltersAsync(scholarshipTypeId, programId, campusId);
            var pdf = ReportPdf.BuildGrouped("Scholars Master List", subtitle, columns, groups);
            var suffix = await FileSuffixAsync(scholarshipTypeId);
            return File(pdf, "application/pdf", $"scholars{suffix}_{DateTime.UtcNow:yyyyMMdd}.pdf");
        }

        private static List<(string Heading, List<ScholarProfile> Scholars)> GroupByType(List<ScholarProfile> scholars) =>
            scholars
                .GroupBy(sp => sp.ScholarshipType?.Name ?? "No scholarship assigned")
                .OrderBy(g => g.Key == "No scholarship assigned" ? 1 : 0).ThenBy(g => g.Key)
                .Select(g => (g.Key, g.ToList()))
                .ToList();

        // Excel sheet names: max 31 chars, no []:*?/\ and unique within the workbook.
        private static string SheetName(string heading, HashSet<string> used)
        {
            var clean = new string(heading.Where(c => !"[]:*?/\\".Contains(c)).ToArray()).Trim();
            if (clean.Length == 0) clean = "Scholars";
            if (clean.Length > 31) clean = clean[..31];
            var name = clean;
            for (int n = 2; !used.Add(name); n++)
                name = clean[..Math.Min(clean.Length, 27)] + $" ({n})";
            return name;
        }

        private async Task<string> FileSuffixAsync(int? scholarshipTypeId)
        {
            if (scholarshipTypeId is null) return "";
            var name = await db.ScholarshipTypes.Where(t => t.Id == scholarshipTypeId).Select(t => t.Name).FirstOrDefaultAsync();
            if (name is null) return "";
            var slug = new string(name.Select(c => char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : '-').ToArray()).Trim('-');
            while (slug.Contains("--")) slug = slug.Replace("--", "-");
            return "_" + slug;
        }

        private Task<List<ScholarProfile>> LoadScholarsAsync(int? scholarshipTypeId, int? programId, int? campusId)
        {
            var query = db.ScholarProfiles
                .Include(sp => sp.User)
                .Include(sp => sp.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .AsQueryable();

            if (scholarshipTypeId.HasValue)
                query = query.Where(sp => sp.ScholarshipTypeId == scholarshipTypeId);
            if (programId.HasValue)
                query = query.Where(sp => sp.ProgramId == programId);
            if (campusId.HasValue)
                query = query.Where(sp => sp.CampusId == campusId);

            return query.OrderBy(sp => sp.User!.LastName).ThenBy(sp => sp.User!.FirstName).ToListAsync();
        }

        // A printed report has no filter bar above it, so the filters go in the header instead.
        private async Task<string> DescribeScholarFiltersAsync(int? scholarshipTypeId, int? programId, int? campusId)
        {
            var parts = new List<string>();

            if (scholarshipTypeId.HasValue)
            {
                var name = await db.ScholarshipTypes.Where(t => t.Id == scholarshipTypeId).Select(t => t.Name).FirstOrDefaultAsync();
                parts.Add($"Scholarship: {name ?? $"#{scholarshipTypeId}"}");
            }
            else
            {
                parts.Add("All scholarships, grouped by type");
            }
            if (campusId.HasValue)
            {
                var name = await db.Campuses.Where(c => c.Id == campusId).Select(c => c.Name).FirstOrDefaultAsync();
                parts.Add($"Campus: {name ?? $"#{campusId}"}");
            }
            if (programId.HasValue)
            {
                var name = await db.AcademicPrograms.Where(p => p.Id == programId).Select(p => p.Name).FirstOrDefaultAsync();
                parts.Add($"Program: {name ?? $"#{programId}"}");
            }

            return string.Join("  ·  ", parts);
        }

        /* ───────────────────────── Submissions ───────────────────────── */

        // GET /api/reports/submissions.xlsx?academicYear=&semester=&status=
        [HttpGet("submissions.xlsx")]
        public async Task<IActionResult> SubmissionsExcel(
            [FromQuery] string? academicYear,
            [FromQuery] int? semester,
            [FromQuery] string? status)
        {
            var subs = await LoadSubmissionsAsync(academicYear, semester, status);

            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Submissions");
            WriteHeaderRow(ws, SubmissionHeaders);

            for (int row = 0; row < subs.Count; row++)
            {
                var s = subs[row];
                int r = row + 2;

                ws.Cell(r, 1).Value = s.Scholar?.FullName ?? "";
                ws.Cell(r, 2).Value = s.Scholar?.Email ?? "";
                ws.Cell(r, 3).Value = s.Requirement?.Name ?? "";
                ws.Cell(r, 4).Value = s.Status.ToString();
                ws.Cell(r, 5).Value = s.AcademicYear ?? "";
                ws.Cell(r, 6).Value = $"Sem {s.Semester}";
                ws.Cell(r, 7).Value = s.SubmittedAt.ToString("yyyy-MM-dd HH:mm");
                ws.Cell(r, 8).Value = s.ReviewedBy?.FullName ?? "";
                ws.Cell(r, 9).Value = s.FeedbackNote ?? "";
                ws.Cell(r, 10).Value = s.FileName;

                // Column 4 is Status — the colouring used to land on Academic Year.
                var statusCell = ws.Cell(r, 4);
                statusCell.Style.Font.FontColor = XLColor.FromHtml(ReportPdf.StatusColor(s.Status.ToString()));
                statusCell.Style.Font.Bold = true;
            }

            ws.Columns().AdjustToContents();
            ws.Column(1).Width = 28;
            ws.Column(2).Width = 30;

            return Workbook(wb, $"submissions_{DateTime.UtcNow:yyyyMMdd}.xlsx");
        }

        // GET /api/reports/submissions.pdf?academicYear=&semester=&status=
        [HttpGet("submissions.pdf")]
        public async Task<IActionResult> SubmissionsPdf(
            [FromQuery] string? academicYear,
            [FromQuery] int? semester,
            [FromQuery] string? status)
        {
            var subs = await LoadSubmissionsAsync(academicYear, semester, status);

            var columns = new ReportPdf.Column[]
            {
                new("Scholar Name", 1.7f), new("Email", 2.1f), new("Requirement", 1.9f),
                new("Status", 0.9f), new("A.Y.", 0.9f), new("Sem", 0.5f),
                new("Submitted", 1.1f), new("Reviewed By", 1.5f), new("Feedback", 2.0f),
            };

            var rows = subs.Select(s => new[]
            {
                new ReportPdf.Cell(s.Scholar?.FullName ?? ""),
                new ReportPdf.Cell(s.Scholar?.Email ?? ""),
                new ReportPdf.Cell(s.Requirement?.Name ?? ""),
                new ReportPdf.Cell(s.Status.ToString(), ReportPdf.StatusColor(s.Status.ToString()), Bold: true),
                new ReportPdf.Cell(s.AcademicYear ?? ""),
                new ReportPdf.Cell(s.Semester.ToString()),
                new ReportPdf.Cell(s.SubmittedAt.ToString("yyyy-MM-dd")),
                new ReportPdf.Cell(s.ReviewedBy?.FullName ?? "—"),
                new ReportPdf.Cell(s.FeedbackNote ?? ""),
            }).ToList();

            var subtitle = DescribeSubmissionFilters(academicYear, semester, status);
            var pdf = ReportPdf.Build("Document Submissions", subtitle, columns, rows);
            return File(pdf, "application/pdf", $"submissions_{DateTime.UtcNow:yyyyMMdd}.pdf");
        }

        private Task<List<DocumentSubmission>> LoadSubmissionsAsync(string? academicYear, int? semester, string? status)
        {
            var query = db.DocumentSubmissions
                .Include(s => s.Scholar)
                .Include(s => s.Requirement)
                .Include(s => s.ReviewedBy)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(academicYear))
                query = query.Where(s => s.AcademicYear == academicYear);
            if (semester.HasValue)
                query = query.Where(s => s.Semester == semester);
            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DocumentStatus>(status, out var parsed))
                query = query.Where(s => s.Status == parsed);

            return query.OrderByDescending(s => s.SubmittedAt).ToListAsync();
        }

        private static string DescribeSubmissionFilters(string? academicYear, int? semester, string? status)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(academicYear)) parts.Add($"A.Y. {academicYear}");
            if (semester.HasValue) parts.Add($"Semester {semester}");
            if (!string.IsNullOrWhiteSpace(status)) parts.Add($"Status: {status}");
            return parts.Count == 0 ? "All submissions" : string.Join("  ·  ", parts);
        }

        /* ─────────────────────────── Shared ─────────────────────────── */

        private static void WriteHeaderRow(IXLWorksheet ws, string[] headers)
        {
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                cell.Style.Font.FontColor = XLColor.White;
            }
        }

        private FileStreamResult Workbook(XLWorkbook wb, string fileName)
        {
            var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);
            return File(ms, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
