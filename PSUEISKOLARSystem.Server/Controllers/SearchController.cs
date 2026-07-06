using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    // Global search across scholars, announcements, and document requirements (staff only).
    [ApiController]
    [Route("api/search")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class SearchController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Search([FromQuery] string? q)
        {
            var term = q?.Trim().ToLower() ?? "";
            if (term.Length < 2)
                return Ok(new { scholars = Array.Empty<object>(), announcements = Array.Empty<object>(), requirements = Array.Empty<object>() });

            const int take = 6;

            var scholars = await (
                from u in db.Users
                join ur in db.UserRoles on u.Id equals ur.UserId
                join r in db.Roles on ur.RoleId equals r.Id
                where r.Name == UserRoles.Scholar &&
                    (EF.Functions.Like((u.FirstName + " " + u.LastName).ToLower(), $"%{term}%") ||
                     (u.Email != null && EF.Functions.Like(u.Email.ToLower(), $"%{term}%")))
                orderby u.LastName, u.FirstName
                select new { u.Id, Name = u.FirstName + " " + u.LastName, u.Email })
                .Take(take)
                .ToListAsync();

            var announcements = await db.Announcements
                .Where(a => EF.Functions.Like(a.Title.ToLower(), $"%{term}%") ||
                            EF.Functions.Like(a.Content.ToLower(), $"%{term}%"))
                .OrderByDescending(a => a.CreatedAt)
                .Take(take)
                .Select(a => new { a.Id, a.Title })
                .ToListAsync();

            var requirements = await db.DocumentRequirements
                .Where(rq => EF.Functions.Like(rq.Name.ToLower(), $"%{term}%"))
                .OrderBy(rq => rq.Name)
                .Take(take)
                .Select(rq => new { rq.Id, rq.Name })
                .ToListAsync();

            return Ok(new { scholars, announcements, requirements });
        }
    }
}
