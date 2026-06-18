using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/audit-log")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class AuditLogController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
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

        [HttpGet("actions")]
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
