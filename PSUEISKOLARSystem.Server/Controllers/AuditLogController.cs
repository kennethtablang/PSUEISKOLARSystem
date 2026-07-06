using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/audit-log")]
    [Authorize]
    public class AuditLogController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/audit-log/recent — compact recent-activity feed for staff dashboards.
        // Available to coordinators too (unlike the full log), so allow both roles here.
        [HttpGet("recent")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Recent([FromQuery] int take = 8)
        {
            take = Math.Clamp(take, 1, 25);

            var logs = await db.AuditLogs
                .OrderByDescending(l => l.TimestampUtc)
                .Take(take)
                .ToListAsync();

            var userIds = logs.Select(l => l.UserId).Distinct().ToList();
            var users = await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToDictionaryAsync(u => u.Id);

            var items = logs.Select(l =>
            {
                users.TryGetValue(l.UserId, out var u);
                return new
                {
                    l.Id,
                    UserName = u != null ? $"{u.FirstName} {u.LastName}".Trim() : "System",
                    l.Action,
                    l.Details,
                    l.TimestampUtc,
                };
            });

            return Ok(items);
        }

        [HttpGet]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null,
            [FromQuery] string? action = null)
        {
            page     = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 10, 100);

            var query = db.AuditLogs.AsQueryable();

            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(l => l.Action == action);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                var matchingUserIds = db.Users
                    .Where(u =>
                        EF.Functions.Like((u.FirstName + " " + u.LastName).ToLower(), $"%{s}%") ||
                        (u.Email != null && EF.Functions.Like(u.Email.ToLower(), $"%{s}%")))
                    .Select(u => u.Id);
                query = query.Where(l => matchingUserIds.Contains(l.UserId));
            }

            var total = await query.CountAsync();

            var logs = await query
                .OrderByDescending(l => l.TimestampUtc)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userIds = logs.Select(l => l.UserId).Distinct().ToList();
            var users = await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
                .ToDictionaryAsync(u => u.Id);

            var items = logs.Select(l =>
            {
                users.TryGetValue(l.UserId, out var u);
                return new
                {
                    l.Id,
                    l.UserId,
                    UserName  = u != null ? $"{u.FirstName} {u.LastName}".Trim() : "Unknown",
                    UserEmail = u?.Email,
                    l.Action,
                    l.Details,
                    l.TimestampUtc,
                };
            });

            return Ok(new { total, page, pageSize, items });
        }

        // GET /api/audit-log/export.xlsx?search=&action=
        // Exports the full filtered activity log (no paging) to Excel.
        [HttpGet("export.xlsx")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Export(
            [FromQuery] string? search = null,
            [FromQuery] string? action = null)
        {
            var query = db.AuditLogs.AsQueryable();

            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(l => l.Action == action);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                var matchingUserIds = db.Users
                    .Where(u =>
                        EF.Functions.Like((u.FirstName + " " + u.LastName).ToLower(), $"%{s}%") ||
                        (u.Email != null && EF.Functions.Like(u.Email.ToLower(), $"%{s}%")))
                    .Select(u => u.Id);
                query = query.Where(l => matchingUserIds.Contains(l.UserId));
            }

            var logs = await query.OrderByDescending(l => l.TimestampUtc).ToListAsync();

            var userIds = logs.Select(l => l.UserId).Distinct().ToList();
            var users = await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
                .ToDictionaryAsync(u => u.Id);

            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Activity Log");

            var headers = new[] { "Timestamp (UTC)", "User", "Email", "Action", "Details" };
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                cell.Style.Font.FontColor = XLColor.White;
            }

            for (int row = 0; row < logs.Count; row++)
            {
                var l = logs[row];
                users.TryGetValue(l.UserId, out var u);
                int r = row + 2;
                ws.Cell(r, 1).Value = l.TimestampUtc.ToString("yyyy-MM-dd HH:mm:ss");
                ws.Cell(r, 2).Value = u != null ? $"{u.FirstName} {u.LastName}".Trim() : "Unknown";
                ws.Cell(r, 3).Value = u?.Email ?? "";
                ws.Cell(r, 4).Value = l.Action;
                ws.Cell(r, 5).Value = l.Details ?? "";
            }

            ws.Columns().AdjustToContents();
            ws.Column(5).Width = 50; // Details

            var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);

            return File(ms, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"activity_log_{DateTime.UtcNow:yyyyMMdd}.xlsx");
        }

        [HttpGet("actions")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> GetDistinctActions()
        {
            var actions = await db.AuditLogs
                .Select(l => l.Action)
                .Distinct()
                .OrderBy(a => a)
                .ToListAsync();
            return Ok(actions);
        }
    }
}
