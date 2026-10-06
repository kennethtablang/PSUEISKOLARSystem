using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// The auto-generated summary report (see <see cref="SummaryReport"/>). A coordinator always
    /// gets their own campus; the administrator gets every campus, or the one they pass.
    /// </summary>
    [ApiController]
    [Route("api/reports")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class SummaryReportController(ApplicationDbContext db, SummaryReport summary) : ControllerBase
    {
        // GET /api/reports/summary.pdf?campusId=
        [HttpGet("summary.pdf")]
        public async Task<IActionResult> Pdf([FromQuery] int? campusId, CancellationToken ct)
        {
            var report = await summary.BuildAsync(await db.CampusOfAsync(User) ?? campusId, ct);
            return File(ReportPdf.BuildSummary(report), "application/pdf", FileName(report, "pdf"));
        }

        // GET /api/reports/summary.xlsx?campusId= — the same sections, one block after another.
        [HttpGet("summary.xlsx")]
        public async Task<IActionResult> Xlsx([FromQuery] int? campusId, CancellationToken ct)
        {
            var report = await summary.BuildAsync(await db.CampusOfAsync(User) ?? campusId, ct);

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Summary");
            ws.Cell(1, 1).Value = report.Title;
            ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
            ws.Cell(2, 1).Value = $"Scope: {report.Scope} · Generated {DateTime.UtcNow.AddHours(8):MMM d, yyyy h:mm tt} (PHT)";
            ws.Cell(2, 1).Style.Font.SetItalic();

            var r = 4;
            ws.Cell(r++, 1).Value = "Highlights";
            ws.Cell(r - 1, 1).Style.Font.SetBold();
            foreach (var line in report.Highlights) ws.Cell(r++, 1).Value = "• " + line;

            foreach (var section in report.Sections)
            {
                r++;
                ws.Cell(r, 1).Value = section.Heading;
                ws.Cell(r++, 1).Style.Font.SetBold().Font.SetFontSize(12);
                for (int c = 0; c < section.Headers.Length; c++)
                {
                    var cell = ws.Cell(r, c + 1);
                    cell.Value = section.Headers[c];
                    cell.Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#eef2ff"));
                }
                r++;
                if (section.Rows.Count == 0) ws.Cell(r++, 1).Value = "Nothing to report yet.";
                foreach (var row in section.Rows)
                {
                    for (int c = 0; c < row.Length; c++) ws.Cell(r, c + 1).Value = row[c];
                    r++;
                }
                if (section.Note is not null) ws.Cell(r++, 1).Value = section.Note;
            }
            ws.Column(1).Width = 46;
            for (int c = 2; c <= 5; c++) ws.Column(c).Width = 18;

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return File(stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", FileName(report, "xlsx"));
        }

        private static string FileName(SummaryReport.Result report, string ext)
        {
            var slug = new string(report.Scope.Select(c => char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : '-').ToArray()).Trim('-');
            while (slug.Contains("--")) slug = slug.Replace("--", "-");
            return $"summary-report_{slug}_{DateTime.UtcNow.AddHours(8):yyyyMMdd}.{ext}";
        }
    }
}
