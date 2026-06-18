using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/reports")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class ReportsController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/reports/scholars.xlsx?campusId=&scholarshipTypeId=&programId=
        [HttpGet("scholars.xlsx")]
        public async Task<IActionResult> ScholarsExcel(
            [FromQuery] int? campusId,
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] int? programId)
        {
            var query = db.ScholarProfiles
                .Include(sp => sp.User).ThenInclude(u => u!.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .AsQueryable();

            if (campusId.HasValue)
                query = query.Where(sp => sp.User!.CampusId == campusId);
            if (scholarshipTypeId.HasValue)
                query = query.Where(sp => sp.ScholarshipTypeId == scholarshipTypeId);
            if (programId.HasValue)
                query = query.Where(sp => sp.ProgramId == programId);

            var scholars = await query.OrderBy(sp => sp.User!.LastName).ThenBy(sp => sp.User!.FirstName).ToListAsync();

            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Scholars");

            // Header row
            var headers = new[]
            {
                "Student ID", "Last Name", "First Name", "Middle Name", "Email",
                "Campus", "Program", "Year Level", "Scholarship Type",
                "Latest GWA", "Meets Requirement", "Contact Number", "Birth Date"
            };

            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                cell.Style.Font.FontColor = XLColor.White;
            }

            // Data rows
            for (int row = 0; row < scholars.Count; row++)
            {
                var sp = scholars[row];
                var u = sp.User;
                var latestGrade = sp.Grades.FirstOrDefault();
                int r = row + 2;

                ws.Cell(r, 1).Value = sp.StudentId ?? "";
                ws.Cell(r, 2).Value = u?.LastName ?? "";
                ws.Cell(r, 3).Value = u?.FirstName ?? "";
                ws.Cell(r, 4).Value = u?.MiddleName ?? "";
                ws.Cell(r, 5).Value = u?.Email ?? "";
                ws.Cell(r, 6).Value = u?.Campus?.Name ?? "";
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
                    complianceCell.Style.Font.FontColor = latestGrade.MeetsRequirement ? XLColor.FromHtml("#065f46") : XLColor.FromHtml("#991b1b");
                    complianceCell.Style.Font.Bold = true;
                }
            }

            ws.Columns().AdjustToContents();
            ws.Column(5).Width = 30; // Email column

            var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);

            return File(ms, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"scholars_{DateTime.UtcNow:yyyyMMdd}.xlsx");
        }

        // GET /api/reports/submissions.xlsx?academicYear=&semester=&status=
        [HttpGet("submissions.xlsx")]
        public async Task<IActionResult> SubmissionsExcel(
            [FromQuery] string? academicYear,
            [FromQuery] int? semester,
            [FromQuery] string? status)
        {
            var query = db.DocumentSubmissions
                .Include(s => s.Scholar).ThenInclude(u => u!.Campus)
                .Include(s => s.Requirement)
                .Include(s => s.ReviewedBy)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(academicYear))
                query = query.Where(s => s.AcademicYear == academicYear);
            if (semester.HasValue)
                query = query.Where(s => s.Semester == semester);
            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DocumentStatus>(status, out var parsed))
                query = query.Where(s => s.Status == parsed);

            var subs = await query.OrderByDescending(s => s.SubmittedAt).ToListAsync();

            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Submissions");

            var headers = new[]
            {
                "Scholar Name", "Email", "Campus", "Requirement", "Status",
                "Academic Year", "Semester", "Submitted At", "Reviewed By", "Feedback", "File Name"
            };

            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                cell.Style.Font.FontColor = XLColor.White;
            }

            for (int row = 0; row < subs.Count; row++)
            {
                var s = subs[row];
                int r = row + 2;

                ws.Cell(r, 1).Value = s.Scholar?.FullName ?? "";
                ws.Cell(r, 2).Value = s.Scholar?.Email ?? "";
                ws.Cell(r, 3).Value = s.Scholar?.Campus?.Name ?? "";
                ws.Cell(r, 4).Value = s.Requirement?.Name ?? "";
                ws.Cell(r, 5).Value = s.Status.ToString();
                ws.Cell(r, 6).Value = s.AcademicYear ?? "";
                ws.Cell(r, 7).Value = $"Sem {s.Semester}";
                ws.Cell(r, 8).Value = s.SubmittedAt.ToString("yyyy-MM-dd HH:mm");
                ws.Cell(r, 9).Value = s.ReviewedBy?.FullName ?? "";
                ws.Cell(r, 10).Value = s.FeedbackNote ?? "";
                ws.Cell(r, 11).Value = s.FileName;

                var statusCell = ws.Cell(r, 5);
                statusCell.Style.Font.FontColor = s.Status switch
                {
                    DocumentStatus.Verified   => XLColor.FromHtml("#065f46"),
                    DocumentStatus.Incomplete => XLColor.FromHtml("#991b1b"),
                    _                         => XLColor.FromHtml("#92400e"),
                };
                statusCell.Style.Font.Bold = true;
            }

            ws.Columns().AdjustToContents();
            ws.Column(1).Width = 28;
            ws.Column(2).Width = 30;

            var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);

            return File(ms, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"submissions_{DateTime.UtcNow:yyyyMMdd}.xlsx");
        }
    }
}
