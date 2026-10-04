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
    /// <summary>
    /// Downloadable copies of the people lists, built from exactly the filters the office picked
    /// — the Export buttons on the Master List, a scholarship type's scholars and a grant type's
    /// grantees, and the report builder on Data Visualization. Excel to work with the figures;
    /// PDF to print. The filters are written into the report's heading, so a printed copy says
    /// what it is a list of (e.g. "Scholars · Campus: Lingayen · Sex: Female").
    /// </summary>
    [ApiController]
    [Route("api/reports/lists")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class ListReportsController(ApplicationDbContext db) : ControllerBase
    {
        private sealed record Report(string Title, string FileStem, string Subtitle, ReportPdf.Column[] Columns, List<string[]> Rows);

        // GET /api/reports/lists/masterlist.{xlsx|pdf}?kind=&status=&campusId=&sex=&scholarshipTypeId=&grantTypeId=&search=
        [HttpGet("masterlist.{format}")]
        public async Task<IActionResult> MasterList(string format, [FromQuery] ListFilters.MasterListFilter f)
        {
            var people = await ListFilters.MasterListPeopleAsync(db, f);
            var rows = people.Select(p => new[]
            {
                p.StudentId,
                p.FullName,
                p.Sex ?? "",
                string.Join(", ", p.Entries.Select(e => e.Kind).Distinct()),
                string.Join("; ", p.Entries.Select(e => e.Amount is decimal a ? $"{e.Name} (PHP {a:N2})" : e.Name)),
                p.CampusName ?? "",
                p.HasAccount ? (p.AccountActive == false ? "Account closed" : "Account created") : "Not yet signed up",
                p.Email ?? "",
            }).ToList();

            var filters = new List<string>();
            if (!string.IsNullOrWhiteSpace(f.Kind)) filters.Add(f.Kind == EligibilityKinds.Grantee ? "Grantees" : "Scholars");
            if (f.Status == "claimed") filters.Add("With an account");
            else if (f.Status == "unclaimed") filters.Add("Not yet signed up");
            await DescribeCommonAsync(filters, f.CampusId, f.Sex, f.ScholarshipTypeId, f.GrantTypeId, null, null, f.Search);

            return Render(format, new Report("Master List", "master_list", Subtitle(filters, "Every scholar and grantee"),
            [
                new("Student No.", 1.1f), new("Name", 2.2f), new("Sex", 0.7f), new("Kind", 1f),
                new("Scholarship / Grant", 2.6f), new("Campus", 1.5f), new("Account", 1.2f), new("Email", 2f),
            ], rows));
        }

        // GET /api/reports/lists/scholars.{xlsx|pdf}?scholarshipTypeId=&campusId=&programId=&yearLevel=&sex=&lifecycleStatus=&search=
        [HttpGet("scholars.{format}")]
        public async Task<IActionResult> Scholars(string format, [FromQuery] ListFilters.ScholarFilter f)
        {
            var list = await ListFilters.Scholars(db, f)
                .OrderBy(sp => sp.ScholarshipType != null ? sp.ScholarshipType.Name : "")
                .ThenBy(sp => sp.User.LastName).ThenBy(sp => sp.User.FirstName)
                .Select(sp => new
                {
                    sp.StudentId,
                    sp.User.LastName, sp.User.FirstName, sp.User.MiddleName, sp.User.Email,
                    sp.Personal.Sex,
                    Campus = sp.Campus != null ? sp.Campus.Name : null,
                    Program = sp.Program != null ? sp.Program.Name : null,
                    Major = sp.Program != null ? sp.Program.Major : null,
                    sp.YearLevel,
                    Scholarship = sp.ScholarshipType != null ? sp.ScholarshipType.Name : null,
                    sp.LifecycleStatus,
                    sp.ContactNumber,
                })
                .ToListAsync();

            var rows = list.Select(s => new[]
            {
                s.StudentId,
                $"{s.LastName}, {s.FirstName}{(s.MiddleName is null ? "" : " " + s.MiddleName)}",
                s.Sex ?? "",
                s.Campus ?? "",
                s.Program is null ? "" : AcademicProgram.Display(s.Program, s.Major),
                $"Year {s.YearLevel}",
                s.Scholarship ?? "",
                s.LifecycleStatus,
                s.ContactNumber ?? "",
                s.Email ?? "",
            }).ToList();

            var filters = new List<string>();
            await DescribeCommonAsync(filters, f.CampusId, f.Sex, f.ScholarshipTypeId, null, f.ProgramId, f.YearLevel, f.Search);
            if (!string.IsNullOrWhiteSpace(f.LifecycleStatus)) filters.Add($"Status: {f.LifecycleStatus}");

            return Render(format, new Report("Scholars", "scholars", Subtitle(filters, "All scholars"),
            [
                new("Student No.", 1.1f), new("Name", 2.2f), new("Sex", 0.7f), new("Campus", 1.5f),
                new("Program", 2.6f), new("Year", 0.7f), new("Scholarship", 1.8f), new("Status", 0.9f),
                new("Contact", 1.2f), new("Email", 2f),
            ], rows));
        }

        // GET /api/reports/lists/grantees.{xlsx|pdf}?grantTypeId=&campusId=&programId=&yearLevel=&sex=&active=&search=
        [HttpGet("grantees.{format}")]
        public async Task<IActionResult> Grantees(string format, [FromQuery] ListFilters.GranteeFilter f)
        {
            var list = await ListFilters.Grantees(db, f)
                .OrderBy(g => g.User.LastName).ThenBy(g => g.User.FirstName)
                .Select(g => new
                {
                    g.StudentId,
                    g.User.LastName, g.User.FirstName, g.User.MiddleName, g.User.Email, g.User.IsActive,
                    g.Personal.Sex,
                    Campus = g.Campus != null ? g.Campus.Name : null,
                    Program = g.Program != null ? g.Program.Name : null,
                    Major = g.Program != null ? g.Program.Major : null,
                    g.YearLevel,
                    Grants = db.OneTimeGrants.Where(x => x.ScholarId == g.UserId && (f.GrantTypeId == null || x.GrantTypeId == f.GrantTypeId))
                        .Select(x => new { x.Title, x.Amount, x.ReleaseStatus }).ToList(),
                })
                .ToListAsync();

            var rows = list.Select(g => new[]
            {
                g.StudentId,
                $"{g.LastName}, {g.FirstName}{(g.MiddleName is null ? "" : " " + g.MiddleName)}",
                g.Sex ?? "",
                g.Campus ?? "",
                g.Program is null ? "" : AcademicProgram.Display(g.Program, g.Major),
                $"Year {g.YearLevel}",
                string.Join("; ", g.Grants.Select(x => $"{x.Title} (PHP {x.Amount:N2}, {(x.ReleaseStatus == GrantReleaseStatuses.Released ? "received" : x.ReleaseStatus.ToLowerInvariant())})")),
                g.IsActive ? "Active" : "Closed",
                g.Email ?? "",
            }).ToList();

            var filters = new List<string>();
            await DescribeCommonAsync(filters, f.CampusId, f.Sex, null, f.GrantTypeId, f.ProgramId, f.YearLevel, f.Search);
            if (f.Active is bool a) filters.Add(a ? "Active accounts" : "Closed accounts");

            return Render(format, new Report("Grantees", "grantees", Subtitle(filters, "All grantees"),
            [
                new("Student No.", 1.1f), new("Name", 2.2f), new("Sex", 0.7f), new("Campus", 1.5f),
                new("Program", 2.4f), new("Year", 0.7f), new("Grants", 3f), new("Account", 0.9f), new("Email", 2f),
            ], rows));
        }

        /* ── helpers ── */

        private async Task DescribeCommonAsync(List<string> parts, int? campusId, string? sex, int? scholarshipTypeId,
            int? grantTypeId, int? programId, int? yearLevel, string? search)
        {
            if (scholarshipTypeId is int st)
                parts.Add($"Scholarship: {await db.ScholarshipTypes.Where(t => t.Id == st).Select(t => t.Name).FirstOrDefaultAsync() ?? $"#{st}"}");
            if (grantTypeId is int gt)
                parts.Add($"Grant: {await db.GrantTypes.Where(t => t.Id == gt).Select(t => t.Name).FirstOrDefaultAsync() ?? $"#{gt}"}");
            if (campusId is int c)
                parts.Add($"Campus: {await db.Campuses.Where(x => x.Id == c).Select(x => x.Name).FirstOrDefaultAsync() ?? $"#{c}"}");
            if (programId is int p)
            {
                var prog = await db.AcademicPrograms.Where(x => x.Id == p).Select(x => new { x.Name, x.Major }).FirstOrDefaultAsync();
                parts.Add($"Program: {(prog is null ? $"#{p}" : AcademicProgram.Display(prog.Name, prog.Major))}");
            }
            if (yearLevel is int y) parts.Add($"Year {y}");
            if (!string.IsNullOrWhiteSpace(sex)) parts.Add($"Sex: {sex}");
            if (!string.IsNullOrWhiteSpace(search)) parts.Add($"Search: \"{search.Trim()}\"");
        }

        private static string Subtitle(List<string> filters, string everyone) =>
            filters.Count == 0 ? everyone : string.Join("  ·  ", filters);

        private IActionResult Render(string format, Report report)
        {
            var stamp = DateTime.UtcNow.AddHours(8).ToString("yyyyMMdd");
            switch (format.ToLowerInvariant())
            {
                case "pdf":
                    var pdf = ReportPdf.Build(report.Title, report.Subtitle, report.Columns,
                        report.Rows.Select(r => r.Select(x => new ReportPdf.Cell(x)).ToArray()).ToList());
                    return File(pdf, "application/pdf", $"{report.FileStem}_{stamp}.pdf");

                case "xlsx":
                    using (var wb = new XLWorkbook())
                    {
                        var ws = wb.Worksheets.Add(report.Title.Length > 31 ? report.Title[..31] : report.Title);
                        ws.Cell(1, 1).Value = $"PSU e-Iskolar — {report.Title}";
                        ws.Cell(1, 1).Style.Font.Bold = true;
                        ws.Cell(1, 1).Style.Font.FontSize = 14;
                        ws.Cell(2, 1).Value = report.Subtitle;
                        ws.Cell(2, 1).Style.Font.Italic = true;
                        ws.Cell(3, 1).Value = $"{report.Rows.Count} record(s) · generated {DateTime.UtcNow.AddHours(8):MMM d, yyyy h:mm tt}";

                        const int headerRow = 5;
                        for (int c = 0; c < report.Columns.Length; c++)
                        {
                            var cell = ws.Cell(headerRow, c + 1);
                            cell.Value = report.Columns[c].Header;
                            cell.Style.Font.Bold = true;
                            cell.Style.Font.FontColor = XLColor.White;
                            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                        }
                        for (int r = 0; r < report.Rows.Count; r++)
                            for (int c = 0; c < report.Rows[r].Length; c++)
                                ws.Cell(headerRow + 1 + r, c + 1).Value = report.Rows[r][c];

                        if (report.Rows.Count > 0)
                            ws.Range(headerRow, 1, headerRow + report.Rows.Count, report.Columns.Length).SetAutoFilter();
                        ws.SheetView.FreezeRows(headerRow);
                        ws.Columns().AdjustToContents(headerRow, headerRow + Math.Min(report.Rows.Count, 500), 8, 60);

                        var ms = new MemoryStream();
                        wb.SaveAs(ms);
                        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            $"{report.FileStem}_{stamp}.xlsx");
                    }

                default:
                    return BadRequest(new { message = "Format must be xlsx or pdf." });
            }
        }
    }
}
