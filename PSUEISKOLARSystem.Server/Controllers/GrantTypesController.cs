using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// Kinds of one-time grant, managed like scholarship types. Deactivating a type is the
    /// "this grant has been released, close it out" action: it also deactivates every grantee
    /// account under the type so they can no longer sign in, while their profiles and grants
    /// stay on record for the analytics. Scholars who received the grant are not touched —
    /// their account belongs to their scholarship, not to the grant.
    /// </summary>
    [ApiController]
    [Route("api/grant-types")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class GrantTypesController(
        ApplicationDbContext db,
        INotificationService notifications,
        IAnnouncementDelivery announcements) : ControllerBase
    {
        // GET /api/grant-types
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var granteeRoleId = await RoleIdAsync(UserRoles.Grantee);

            // A coordinator's counts are their own campus's grantees.
            var campusId = await db.CampusOfAsync(User);
            var grants = db.OneTimeGrants.AsQueryable();
            if (db.StudentsAt(campusId) is { } atCampus) grants = grants.Where(g => atCampus.Contains(g.ScholarId));
            var lines = db.EligibilityRecords.AtCampus(campusId);

            var types = await db.GrantTypes
                .OrderByDescending(t => t.IsActive)
                .ThenBy(t => t.Name)
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Description,
                    t.Sponsor,
                    t.DefaultAmount,
                    t.ScheduledDate,
                    t.IsActive,
                    t.CreatedAt,
                    t.DeactivatedAt,
                    t.AccountsClosedAt,
                    GrantCount = grants.Count(g => g.GrantTypeId == t.Id),
                    ReleasedCount = grants.Count(g => g.GrantTypeId == t.Id && g.ReleaseStatus == GrantReleaseStatuses.Released),
                    PendingCount = grants.Count(g => g.GrantTypeId == t.Id && g.ReleaseStatus == GrantReleaseStatuses.Pending),
                    ReleasedAmount = grants
                        .Where(g => g.GrantTypeId == t.Id && g.ReleaseStatus == GrantReleaseStatuses.Released)
                        .Sum(g => (decimal?)g.Amount) ?? 0m,
                    GranteeAccounts = grants
                        .Where(g => g.GrantTypeId == t.Id && db.UserRoles.Any(ur => ur.UserId == g.ScholarId && ur.RoleId == granteeRoleId))
                        .Select(g => g.ScholarId).Distinct().Count(),
                    MasterListLines = lines.Count(e => e.GrantTypeId == t.Id),
                })
                .ToListAsync();

            return Ok(types);
        }

        // POST /api/grant-types
        [HttpPost]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Create(GrantTypeRequest dto)
        {
            var error = await ValidateAsync(dto, null);
            if (error is not null) return BadRequest(new { message = error });

            var type = new GrantType
            {
                Name = dto.Name.Trim(),
                Description = Trim(dto.Description),
                Sponsor = Trim(dto.Sponsor),
                DefaultAmount = dto.DefaultAmount,
                ScheduledDate = dto.ScheduledDate?.Date,
            };
            db.GrantTypes.Add(type);
            db.Audit(this, "CreateGrantType", $"Added grant type '{type.Name}'" +
                (type.ScheduledDate is DateTime d ? $" — release on {d:MMM d, yyyy}" : " — release date not set yet"));
            await db.SaveChangesAsync();
            await AnnounceReleaseDateAsync(type);
            return Ok(new { type.Id });
        }

        // PUT /api/grant-types/{id}
        [HttpPut("{id:int}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Update(int id, GrantTypeRequest dto)
        {
            var type = await db.GrantTypes.FindAsync(id);
            if (type is null) return NotFound();

            var error = await ValidateAsync(dto, id);
            if (error is not null) return BadRequest(new { message = error });

            type.Name = dto.Name.Trim();
            type.Description = Trim(dto.Description);
            type.Sponsor = Trim(dto.Sponsor);
            type.DefaultAmount = dto.DefaultAmount;

            var newDate = dto.ScheduledDate?.Date;
            var rescheduled = newDate != type.ScheduledDate;
            type.ScheduledDate = newDate;
            // A new release date means a new release day to close the accounts after.
            if (rescheduled) type.AccountsClosedAt = null;

            db.Audit(this, "UpdateGrantType", $"Updated grant type '{type.Name}'" +
                (rescheduled ? $" — release {(newDate is DateTime d ? $"scheduled for {d:MMM d, yyyy}" : "schedule cleared")}" : ""));
            await db.SaveChangesAsync();

            // Tell everyone still waiting for this grant when it will arrive.
            if (rescheduled) await AnnounceReleaseDateAsync(type);

            return NoContent();
        }

        /// <summary>
        /// Once the release date is known, the system announces it on its own to every account
        /// waiting on a grant of this type — an announcement addressed to exactly those people,
        /// so it sits in their announcements feed as well as ringing the bell.
        /// </summary>
        private async Task AnnounceReleaseDateAsync(GrantType type)
        {
            if (type.ScheduledDate is not DateTime date || date < GrantReleaseService.PhilippineToday()) return;

            var waiting = await db.OneTimeGrants
                .Where(g => g.GrantTypeId == type.Id && g.ReleaseStatus == GrantReleaseStatuses.Pending)
                .Select(g => g.ScholarId)
                .Distinct()
                .ToListAsync();
            if (waiting.Count == 0) return;

            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (actorId is null) return;

            var announcement = new Announcement
            {
                Title = $"{type.Name}: release on {date:MMMM d, yyyy}",
                Content = $"The release date of your '{type.Name}' grant has been set to {date:dddd, MMMM d, yyyy}." +
                          (type.Sponsor is null ? "" : $" Sponsor: {type.Sponsor}.") +
                          " Please be ready to receive it on that day. Grantee accounts under this grant are closed " +
                          "automatically once the release day is over.",
                CreatedById = actorId,
                Recipients = waiting.Select(id => new AnnouncementRecipient { ScholarId = id }).ToList(),
            };
            db.Announcements.Add(announcement);
            db.Audit(this, "AnnounceGrantRelease", $"Announced the {date:MMM d, yyyy} release of '{type.Name}' to {waiting.Count} account(s)");
            await db.SaveChangesAsync();
            await announcements.PublishAsync(announcement);
        }

        /// <summary>
        /// PATCH /api/grant-types/{id}/deactivate — closes the grant type and deactivates the
        /// grantee accounts under it. A grantee who also has a pending grant under another,
        /// still-active type keeps their account, since they are still owed something.
        /// </summary>
        [HttpPatch("{id:int}/deactivate")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Deactivate(int id)
        {
            var type = await db.GrantTypes.FindAsync(id);
            if (type is null) return NotFound();
            if (!type.IsActive) return BadRequest(new { message = $"'{type.Name}' is already deactivated." });

            var (closed, keptOpen) = await GrantReleaseService.CloseGranteeAccountsAsync(db, id);

            type.IsActive = false;
            type.DeactivatedAt = DateTime.UtcNow;
            type.AccountsClosedAt = DateTime.UtcNow;

            var pending = await db.OneTimeGrants.CountAsync(g => g.GrantTypeId == id && g.ReleaseStatus == GrantReleaseStatuses.Pending);

            db.Audit(this, "DeactivateGrantType",
                $"Deactivated grant type '{type.Name}' and {closed} grantee account(s)" +
                (pending > 0 ? $" ({pending} grant(s) were still pending)" : ""));
            await db.SaveChangesAsync();

            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { deactivatedAccounts = closed, keptOpen, pendingGrants = pending });
        }

        // PATCH /api/grant-types/{id}/activate — reopens the type and the grantee accounts that
        // were closed with it. Grantee accounts close automatically after the release day, so
        // this is the way back when the office needs them open again (e.g. someone did not
        // receive their grant). The automatic close does not run again for the same date.
        [HttpPatch("{id:int}/activate")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Activate(int id)
        {
            var type = await db.GrantTypes.FindAsync(id);
            if (type is null) return NotFound();

            var granteeIds = await GrantReleaseService.GranteeIdsAsync(db, id);
            var users = await db.Users.Where(u => granteeIds.Contains(u.Id) && !u.IsActive).ToListAsync();
            foreach (var u in users) u.IsActive = true;

            type.IsActive = true;
            type.DeactivatedAt = null;
            db.Audit(this, "ActivateGrantType", $"Reactivated grant type '{type.Name}' and {users.Count} grantee account(s)");
            await db.SaveChangesAsync();
            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { reactivatedAccounts = users.Count });
        }

        // DELETE /api/grant-types/{id} — only while nothing has been recorded under it.
        [HttpDelete("{id:int}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Delete(int id)
        {
            var type = await db.GrantTypes.FindAsync(id);
            if (type is null) return NotFound();

            if (await db.OneTimeGrants.AnyAsync(g => g.GrantTypeId == id) ||
                await db.EligibilityRecords.AnyAsync(e => e.GrantTypeId == id))
                return BadRequest(new { message = $"'{type.Name}' has grants or master-list lines recorded under it. Deactivate it instead." });

            db.Audit(this, "DeleteGrantType", $"Deleted grant type '{type.Name}'");
            db.GrantTypes.Remove(type);
            await db.SaveChangesAsync();
            return NoContent();
        }

        private Task<string?> RoleIdAsync(string role) =>
            db.Roles.Where(r => r.Name == role).Select(r => r.Id).FirstOrDefaultAsync();

        private async Task<string?> ValidateAsync(GrantTypeRequest dto, int? id)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";
            if (dto.DefaultAmount is decimal a && (a <= 0 || a > 10_000_000m)) return "Default amount must be greater than zero.";
            if (dto.ScheduledDate is DateTime d && (d.Year < 2000 || d.Year > 2100)) return "Enter a valid release date.";

            var name = dto.Name.Trim();
            if (await db.GrantTypes.AnyAsync(t => t.Id != id && t.Name == name))
                return $"A grant type named '{name}' already exists.";
            return null;
        }

        private static string? Trim(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
    }

    public record GrantTypeRequest(
        [Required, MaxLength(150)] string Name,
        [MaxLength(500)] string? Description,
        [MaxLength(150)] string? Sponsor,
        decimal? DefaultAmount,
        // The day grants of this type are released; pending ones flip to Released automatically.
        DateTime? ScheduledDate = null);
}
