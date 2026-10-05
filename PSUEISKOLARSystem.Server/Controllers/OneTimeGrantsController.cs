using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

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
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] int? grantTypeId,
            [FromQuery] string? recipient,
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

            // Scholars only ever see their own grants; a coordinator their campus's.
            if (!isStaff)
                query = query.Where(g => g.ScholarId == currentUserId);
            else
            {
                if (db.StudentsAt(await db.CampusOfAsync(User)) is { } atCampus)
                    query = query.Where(g => atCampus.Contains(g.ScholarId));
                if (!string.IsNullOrWhiteSpace(scholarId))
                    query = query.Where(g => g.ScholarId == scholarId);
            }

            if (scholarshipTypeId is int typeFilter)
                query = query.Where(g => g.ScholarshipTypeId == typeFilter);

            if (grantTypeId is int grantFilter)
                query = query.Where(g => g.GrantTypeId == grantFilter);

            // recipient=scholar|grantee — a scholar can also be a grantee, so this splits the
            // list by the kind of account the grant was paid to.
            if (recipient is "grantee")
                query = query.Where(g => db.GranteeProfiles.Any(gp => gp.UserId == g.ScholarId));
            else if (recipient is "scholar")
                query = query.Where(g => db.ScholarProfiles.Any(sp => sp.UserId == g.ScholarId));

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
                    g.ScholarshipTypeId,
                    ScholarshipTypeName = g.ScholarshipType != null ? g.ScholarshipType.Name : null,
                    g.GrantTypeId,
                    GrantTypeName = g.GrantType != null ? g.GrantType.Name : null,
                    GrantTypeActive = g.GrantType == null || g.GrantType.IsActive,
                    ScheduledReleaseDate = g.GrantType != null ? g.GrantType.ScheduledDate : null,
                    IsGrantee = db.GranteeProfiles.Any(gp => gp.UserId == g.ScholarId),
                    RecipientActive = g.Scholar.IsActive,
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
                // Envelope kept as-is because it carries money totals alongside the page;
                // only the page-count arithmetic is shared (see PagedResult).
                totalPages = PagedResult<object>.PageCount(total, pageSize),
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
            var grants = db.OneTimeGrants.AsQueryable();
            if (db.StudentsAt(await db.CampusOfAsync(User)) is { } atCampus)
                grants = grants.Where(g => atCampus.Contains(g.ScholarId));

            var grouped = await grants
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
                beneficiaries = await grants
                    .Where(g => g.ReleaseStatus != GrantReleaseStatuses.Cancelled)
                    .Select(g => g.ScholarId)
                    .Distinct()
                    .CountAsync(),
                // What each scholarship type has paid out in one-off awards, so a type's
                // total spend is the sum of its releases and its grants rather than just one.
                byScholarshipType = await grants
                    .Where(g => g.ReleaseStatus != GrantReleaseStatuses.Cancelled)
                    .GroupBy(g => new { g.ScholarshipTypeId, Name = g.ScholarshipType != null ? g.ScholarshipType.Name : null })
                    .Select(g => new
                    {
                        scholarshipTypeId = g.Key.ScholarshipTypeId,
                        name = g.Key.Name ?? "Unassigned",
                        count = g.Count(),
                        amount = g.Sum(x => x.Amount),
                    })
                    .OrderByDescending(g => g.amount)
                    .ToListAsync(),
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

            var isRecipient = await db.UserRoles.AnyAsync(ur =>
                ur.UserId == dto.ScholarId &&
                db.Roles.Any(r => r.Id == ur.RoleId && (r.Name == UserRoles.Scholar || r.Name == UserRoles.Grantee)));
            if (!isRecipient) return BadRequest(new { message = "One-time grants can only be awarded to scholar or grantee accounts." });

            if (dto.ScholarshipTypeId is int newTypeId &&
                !await db.ScholarshipTypes.AnyAsync(t => t.Id == newTypeId))
                return BadRequest(new { message = "Scholarship type not found." });

            var grantTypeError = await CheckGrantTypeAsync(dto.GrantTypeId);
            if (grantTypeError is not null) return BadRequest(new { message = grantTypeError });

            var grant = new OneTimeGrant
            {
                ScholarId = dto.ScholarId,
                ScholarshipTypeId = dto.ScholarshipTypeId,
                GrantTypeId = dto.GrantTypeId,
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
                GrantReleaseService.GrantsLink(await IsGranteeAsync(scholar.Id)));

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

            if (dto.ScholarshipTypeId is int editTypeId &&
                !await db.ScholarshipTypes.AnyAsync(t => t.Id == editTypeId))
                return BadRequest(new { message = "Scholarship type not found." });

            if (dto.GrantTypeId != grant.GrantTypeId)
            {
                var grantTypeError = await CheckGrantTypeAsync(dto.GrantTypeId);
                if (grantTypeError is not null) return BadRequest(new { message = grantTypeError });
            }

            grant.ScholarshipTypeId = dto.ScholarshipTypeId;
            grant.GrantTypeId = dto.GrantTypeId;
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
            // A typing slip in the year (0202) would otherwise enter the disbursement record,
            // which cannot be edited once released.
            if (releasedAt < new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc))
                return BadRequest(new { message = "Release date must be in the year 2000 or later." });

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
                GrantReleaseService.GrantsLink(await IsGranteeAsync(grant.ScholarId)));

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

        private Task<bool> IsGranteeAsync(string userId) =>
            db.GranteeProfiles.AnyAsync(gp => gp.UserId == userId);

        private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private async Task<string?> CheckGrantTypeAsync(int? grantTypeId)
        {
            if (grantTypeId is not int id) return null;
            var type = await db.GrantTypes.FindAsync(id);
            if (type is null) return "Grant type not found.";
            if (!type.IsActive) return $"'{type.Name}' is deactivated and no longer takes new grants.";
            return null;
        }

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
        // The kind of scholarship the award is filed under; null when it belongs to none.
        int? ScholarshipTypeId,
        string Title,
        string? Purpose,
        decimal Amount,
        string? Source,
        DateTime AwardedOn,
        string? Notes,
        int? GrantTypeId = null);

    public record ReleaseGrantRequest(string? ReferenceNo, DateTime? ReleasedAt);
    public record CancelGrantRequest(string Reason);
}
