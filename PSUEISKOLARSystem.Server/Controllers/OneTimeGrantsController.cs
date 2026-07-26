using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// One-time grants: individual financial awards (assistance, allowance, stipend top-up)
    /// recorded against a scholar and released once. These sit <i>on top of</i> the scholar's
    /// single ongoing scholarship, so a scholar may have several of them.
    /// </summary>
    [ApiController]
    [Route("api/one-time-grants")]
    [Authorize]
    public class OneTimeGrantsController(ApplicationDbContext db, INotificationService notifications) : ControllerBase
    {
        private const string StaffRoles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}";

        // GET /api/one-time-grants?scholarId=&status=&search=&page=1&pageSize=20
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? scholarId,
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isStaff = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            var query = db.OneTimeGrants.AsQueryable();

            // Scholars only ever see their own grants.
            if (!isStaff)
                query = query.Where(g => g.ScholarId == currentUserId);
            else if (!string.IsNullOrWhiteSpace(scholarId))
                query = query.Where(g => g.ScholarId == scholarId);

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!GrantReleaseStatuses.All.Contains(status))
                    return BadRequest(new { message = "Invalid release status." });
                query = query.Where(g => g.ReleaseStatus == status);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(g =>
                    EF.Functions.Like(g.Title.ToLower(), $"%{s}%") ||
                    (g.Source != null && EF.Functions.Like(g.Source.ToLower(), $"%{s}%")) ||
                    EF.Functions.Like((g.Scholar.FirstName + " " + g.Scholar.LastName).ToLower(), $"%{s}%"));
            }

            var total = await query.CountAsync();
            var totalAmount = total == 0 ? 0m : await query.SumAsync(g => g.Amount);
            var releasedAmount = total == 0 ? 0m
                : await query.Where(g => g.ReleaseStatus == GrantReleaseStatuses.Released).SumAsync(g => g.Amount);

            var items = await query
                .OrderByDescending(g => g.AwardedOn)
                .ThenByDescending(g => g.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(g => new
                {
                    g.Id,
                    g.ScholarId,
                    ScholarName = g.Scholar.MiddleName != null
                        ? g.Scholar.FirstName + " " + g.Scholar.MiddleName + " " + g.Scholar.LastName
                        : g.Scholar.FirstName + " " + g.Scholar.LastName,
                    ScholarEmail = g.Scholar.Email,
                    g.Title,
                    g.Purpose,
                    g.Amount,
                    g.Source,
                    g.AwardedOn,
                    g.ReleaseStatus,
                    g.ReleasedAt,
                    g.ReferenceNo,
                    g.Notes,
                    RecordedBy = g.RecordedBy != null
                        ? g.RecordedBy.FirstName + " " + g.RecordedBy.LastName
                        : null,
                    g.CreatedAt,
                })
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize),
                totalAmount,
                releasedAmount,
                pendingAmount = totalAmount - releasedAmount,
                items,
            });
        }

        // GET /api/one-time-grants/summary  — headline figures for dashboards/reports
        [HttpGet("summary")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Summary()
        {
            var grouped = await db.OneTimeGrants
                .GroupBy(g => g.ReleaseStatus)
                .Select(g => new { Status = g.Key, Count = g.Count(), Amount = g.Sum(x => x.Amount) })
                .ToListAsync();

            decimal AmountFor(string s) => grouped.FirstOrDefault(g => g.Status == s)?.Amount ?? 0m;
            int CountFor(string s) => grouped.FirstOrDefault(g => g.Status == s)?.Count ?? 0;

            return Ok(new
            {
                totalGrants = grouped.Sum(g => g.Count),
                totalAmount = grouped.Sum(g => g.Amount),
                pendingCount = CountFor(GrantReleaseStatuses.Pending),
                pendingAmount = AmountFor(GrantReleaseStatuses.Pending),
                releasedCount = CountFor(GrantReleaseStatuses.Released),
                releasedAmount = AmountFor(GrantReleaseStatuses.Released),
                cancelledCount = CountFor(GrantReleaseStatuses.Cancelled),
                beneficiaries = await db.OneTimeGrants
                    .Where(g => g.ReleaseStatus != GrantReleaseStatuses.Cancelled)
                    .Select(g => g.ScholarId)
                    .Distinct()
                    .CountAsync(),
            });
        }

        // POST /api/one-time-grants
        [HttpPost]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Create(OneTimeGrantRequest dto)
        {
            var validationError = Validate(dto);
            if (validationError is not null) return BadRequest(new { message = validationError });

            var scholar = await db.Users.FirstOrDefaultAsync(u => u.Id == dto.ScholarId);
            if (scholar is null) return BadRequest(new { message = "Scholar not found." });

            var isScholar = await db.UserRoles.AnyAsync(ur =>
                ur.UserId == dto.ScholarId &&
                db.Roles.Any(r => r.Id == ur.RoleId && r.Name == UserRoles.Scholar));
            if (!isScholar) return BadRequest(new { message = "One-time grants can only be awarded to scholar accounts." });

            var grant = new OneTimeGrant
            {
                ScholarId = dto.ScholarId,
                Title = dto.Title.Trim(),
                Purpose = Trim(dto.Purpose),
                Amount = dto.Amount,
                Source = Trim(dto.Source),
                AwardedOn = dto.AwardedOn,
                Notes = Trim(dto.Notes),
                RecordedById = User.FindFirstValue(ClaimTypes.NameIdentifier),
            };

            db.OneTimeGrants.Add(grant);
            db.Audit(this, "CreateOneTimeGrant",
                $"Awarded one-time grant '{grant.Title}' ({grant.Amount:N2}) to {scholar.FullName}");
            await db.SaveChangesAsync();

            await notifications.CreateAsync(
                scholar.Id,
                "One-time grant awarded",
                $"You have been awarded '{grant.Title}' worth PHP {grant.Amount:N2}. " +
                "You will be notified once it is released.",
                NotificationCategories.Account,
                "/my-profile");

            return Ok(new { grant.Id });
        }

        // PUT /api/one-time-grants/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Update(int id, OneTimeGrantRequest dto)
        {
            var grant = await db.OneTimeGrants.FindAsync(id);
            if (grant is null) return NotFound();

            if (grant.ReleaseStatus == GrantReleaseStatuses.Released)
                return BadRequest(new { message = "A released grant can no longer be edited." });

            var validationError = Validate(dto);
            if (validationError is not null) return BadRequest(new { message = validationError });

            grant.Title = dto.Title.Trim();
            grant.Purpose = Trim(dto.Purpose);
            grant.Amount = dto.Amount;
            grant.Source = Trim(dto.Source);
            grant.AwardedOn = dto.AwardedOn;
            grant.Notes = Trim(dto.Notes);

            db.Audit(this, "UpdateOneTimeGrant", $"Updated one-time grant #{id} '{grant.Title}'");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // PATCH /api/one-time-grants/{id}/release
        [HttpPatch("{id}/release")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Release(int id, ReleaseGrantRequest dto)
        {
            var grant = await db.OneTimeGrants.Include(g => g.Scholar).FirstOrDefaultAsync(g => g.Id == id);
            if (grant is null) return NotFound();

            if (grant.ReleaseStatus != GrantReleaseStatuses.Pending)
                return BadRequest(new { message = $"Only a pending grant can be released (this one is {grant.ReleaseStatus})." });

            var releasedAt = dto.ReleasedAt ?? DateTime.UtcNow;
            if (releasedAt > DateTime.UtcNow.AddDays(1))
                return BadRequest(new { message = "Release date cannot be in the future." });

            grant.ReleaseStatus = GrantReleaseStatuses.Released;
            grant.ReleasedAt = releasedAt;
            grant.ReferenceNo = Trim(dto.ReferenceNo);

            db.Audit(this, "ReleaseOneTimeGrant",
                $"Released one-time grant #{id} '{grant.Title}' ({grant.Amount:N2}) to {grant.Scholar.FullName}" +
                (string.IsNullOrWhiteSpace(grant.ReferenceNo) ? "" : $" — ref {grant.ReferenceNo}"));
            await db.SaveChangesAsync();

            await notifications.CreateAsync(
                grant.ScholarId,
                "One-time grant released",
                $"'{grant.Title}' (PHP {grant.Amount:N2}) has been released" +
                (string.IsNullOrWhiteSpace(grant.ReferenceNo) ? "." : $" under reference {grant.ReferenceNo}."),
                NotificationCategories.Account,
                "/my-profile");

            return Ok(new { grant.ReleaseStatus, grant.ReleasedAt, grant.ReferenceNo });
        }

        // PATCH /api/one-time-grants/{id}/cancel
        [HttpPatch("{id}/cancel")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Cancel(int id, CancelGrantRequest dto)
        {
            var grant = await db.OneTimeGrants.FindAsync(id);
            if (grant is null) return NotFound();

            if (grant.ReleaseStatus == GrantReleaseStatuses.Released)
                return BadRequest(new { message = "A released grant cannot be cancelled." });
            if (grant.ReleaseStatus == GrantReleaseStatuses.Cancelled)
                return BadRequest(new { message = "This grant is already cancelled." });
            if (string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest(new { message = "A reason is required when cancelling a grant." });

            grant.ReleaseStatus = GrantReleaseStatuses.Cancelled;
            grant.Notes = string.IsNullOrWhiteSpace(grant.Notes)
                ? $"Cancelled: {dto.Reason.Trim()}"
                : $"{grant.Notes}\nCancelled: {dto.Reason.Trim()}";

            db.Audit(this, "CancelOneTimeGrant", $"Cancelled one-time grant #{id} '{grant.Title}' — {dto.Reason.Trim()}");
            await db.SaveChangesAsync();
            return Ok(new { grant.ReleaseStatus });
        }

        // DELETE /api/one-time-grants/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Delete(int id)
        {
            var grant = await db.OneTimeGrants.FindAsync(id);
            if (grant is null) return NotFound();

            if (grant.ReleaseStatus == GrantReleaseStatuses.Released)
                return BadRequest(new { message = "A released grant is part of the disbursement record and cannot be deleted. Cancel it instead." });

            db.Audit(this, "DeleteOneTimeGrant", $"Deleted one-time grant #{id} '{grant.Title}'");
            db.OneTimeGrants.Remove(grant);
            await db.SaveChangesAsync();
            return NoContent();
        }

        private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static string? Validate(OneTimeGrantRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
                return "A grant title is required.";
            if (dto.Title.Trim().Length > 150)
                return "Grant title must be 150 characters or fewer.";
            if (dto.Amount <= 0)
                return "Amount must be greater than zero.";
            if (dto.Amount > 10_000_000m)
                return "Amount looks too large — please check the figure.";
            if (dto.AwardedOn > DateTime.UtcNow.AddYears(1))
                return "Award date cannot be more than a year in the future.";
            if (dto.AwardedOn < new DateTime(2000, 1, 1))
                return "Award date is not valid.";
            return null;
        }
    }

    public record OneTimeGrantRequest(
        string ScholarId,
        string Title,
        string? Purpose,
        decimal Amount,
        string? Source,
        DateTime AwardedOn,
        string? Notes);

    public record ReleaseGrantRequest(string? ReferenceNo, DateTime? ReleasedAt);
    public record CancelGrantRequest(string Reason);
}
