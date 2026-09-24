using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// The master list of scholars and grantees that sign-ups are cross-matched against
    /// (see <see cref="MasterList"/>). The office maintains it here — one line at a time or by
    /// uploading a spreadsheet — and a student can only create an account once their line is on it.
    /// </summary>
    [ApiController]
    [Route("api/master-list")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class MasterListController(ApplicationDbContext db) : ControllerBase
    {
        private const int MaxRows = 2000;

        private static readonly string[] TemplateHeaders =
            ["Kind", "StudentId", "LastName", "FirstName", "MiddleName", "CampusCode", "ScholarshipType", "GrantType", "GrantAmount", "Notes"];

        // GET /api/master-list?kind=&status=claimed|unclaimed&campusId=&search=&page=&pageSize=
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? kind,
            [FromQuery] string? status,
            [FromQuery] int? campusId,
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] int? grantTypeId,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = db.EligibilityRecords.AsQueryable();

            if (!string.IsNullOrWhiteSpace(kind)) query = query.Where(e => e.Kind == kind);
            if (status == "claimed") query = query.Where(e => e.ClaimedByUserId != null);
            else if (status == "unclaimed") query = query.Where(e => e.ClaimedByUserId == null);
            if (campusId is int cid) query = query.Where(e => e.CampusId == cid);
            if (scholarshipTypeId is int st) query = query.Where(e => e.ScholarshipTypeId == st);
            if (grantTypeId is int gt) query = query.Where(e => e.GrantTypeId == gt);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToUpper();
                query = query.Where(e =>
                    e.StudentId.Contains(s) ||
                    (e.FirstName + " " + e.LastName).Contains(s) ||
                    e.LastName.Contains(s));
            }

            var total = await query.CountAsync();
            var claimed = await query.CountAsync(e => e.ClaimedByUserId != null);

            var items = await query
                .OrderBy(e => e.ClaimedByUserId != null)
                .ThenBy(e => e.LastName).ThenBy(e => e.FirstName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(e => new
                {
                    e.Id,
                    e.Kind,
                    e.StudentId,
                    e.LastName,
                    e.FirstName,
                    e.MiddleName,
                    e.CampusId,
                    CampusName = e.Campus != null ? e.Campus.Name : null,
                    e.ScholarshipTypeId,
                    ScholarshipTypeName = e.ScholarshipType != null ? e.ScholarshipType.Name : null,
                    e.GrantTypeId,
                    GrantTypeName = e.GrantType != null ? e.GrantType.Name : null,
                    e.GrantAmount,
                    e.Notes,
                    e.ClaimedByUserId,
                    ClaimedByEmail = e.ClaimedBy != null ? e.ClaimedBy.Email : null,
                    e.ClaimedAt,
                    e.CreatedAt,
                })
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                pageSize,
                totalPages = PagedResult<object>.PageCount(total, pageSize),
                claimed,
                unclaimed = total - claimed,
                items,
            });
        }

        // POST /api/master-list
        [HttpPost]
        public async Task<IActionResult> Create(MasterListRequest dto)
        {
            var (line, error) = await BuildAsync(dto.Kind, dto.StudentId, dto.LastName, dto.FirstName, dto.MiddleName,
                dto.CampusId, dto.ScholarshipTypeId, dto.GrantTypeId, dto.GrantAmount, dto.Notes);
            if (error is not null) return BadRequest(new { message = error });

            var applied = await MasterList.ApplyToExistingAccountAsync(db, line!, ActorId);
            db.EligibilityRecords.Add(line!);
            db.Audit(this, "AddMasterListLine",
                $"Added {line!.Kind} {line.LastName}, {line.FirstName} ({line.StudentId}) to the master list" +
                (applied is null ? "" : $" — {applied}"));
            await db.SaveChangesAsync();

            return Ok(new { line.Id, applied });
        }

        // PUT /api/master-list/{id} — only an unclaimed line can be edited; a claimed one is history.
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, MasterListRequest dto)
        {
            var line = await db.EligibilityRecords.FindAsync(id);
            if (line is null) return NotFound();
            if (line.ClaimedByUserId is not null)
                return BadRequest(new { message = "This line has already been used to open an account and can no longer be edited." });

            var (updated, error) = await BuildAsync(dto.Kind, dto.StudentId, dto.LastName, dto.FirstName, dto.MiddleName,
                dto.CampusId, dto.ScholarshipTypeId, dto.GrantTypeId, dto.GrantAmount, dto.Notes, excludingId: id);
            if (error is not null) return BadRequest(new { message = error });

            line.Kind = updated!.Kind;
            line.StudentId = updated.StudentId;
            line.LastName = updated.LastName;
            line.FirstName = updated.FirstName;
            line.MiddleName = updated.MiddleName;
            line.CampusId = updated.CampusId;
            line.ScholarshipTypeId = updated.ScholarshipTypeId;
            line.GrantTypeId = updated.GrantTypeId;
            line.GrantAmount = updated.GrantAmount;
            line.Notes = updated.Notes;

            db.Audit(this, "UpdateMasterListLine", $"Updated master-list line for {line.LastName}, {line.FirstName} ({line.StudentId})");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/master-list/{id} — removing a claimed line leaves the account alone.
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var line = await db.EligibilityRecords.FindAsync(id);
            if (line is null) return NotFound();

            db.Audit(this, "DeleteMasterListLine", $"Removed {line.Kind} {line.LastName}, {line.FirstName} ({line.StudentId}) from the master list");
            db.EligibilityRecords.Remove(line);
            await db.SaveChangesAsync();
            return NoContent();
        }

        // GET /api/master-list/template.xlsx
        [HttpGet("template.xlsx")]
        public async Task<IActionResult> Template()
        {
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Master List");
            for (int i = 0; i < TemplateHeaders.Length; i++)
            {
                var cell = ws.Cell(1, i + 1);
                cell.Value = TemplateHeaders[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#002570");
                cell.Style.Font.FontColor = XLColor.White;
            }
            ws.Cell(2, 1).Value = "Scholar"; ws.Cell(2, 2).Value = "23-LN-0001"; ws.Cell(2, 3).Value = "DELA CRUZ";
            ws.Cell(2, 4).Value = "JUAN"; ws.Cell(2, 5).Value = "SANTOS"; ws.Cell(2, 6).Value = "LIN";
            ws.Cell(2, 7).Value = "CHED Scholarship";
            ws.Cell(3, 1).Value = "Grantee"; ws.Cell(3, 2).Value = "23-LN-0002"; ws.Cell(3, 3).Value = "REYES";
            ws.Cell(3, 4).Value = "ANA"; ws.Cell(3, 6).Value = "LIN"; ws.Cell(3, 8).Value = "Tulong Dunong"; ws.Cell(3, 9).Value = 5000;
            ws.Columns().AdjustToContents();

            var reference = wb.Worksheets.Add("Reference");
            reference.Cell(1, 1).Value = "Campus codes"; reference.Cell(1, 1).Style.Font.Bold = true;
            var campuses = await db.Campuses.OrderBy(c => c.Name).ToListAsync();
            for (int i = 0; i < campuses.Count; i++) { reference.Cell(i + 2, 1).Value = campuses[i].Code; reference.Cell(i + 2, 2).Value = campuses[i].Name; }
            reference.Cell(1, 4).Value = "Scholarship types"; reference.Cell(1, 4).Style.Font.Bold = true;
            var types = await db.ScholarshipTypes.OrderBy(t => t.Name).Select(t => t.Name).ToListAsync();
            for (int i = 0; i < types.Count; i++) reference.Cell(i + 2, 4).Value = types[i];
            reference.Cell(1, 6).Value = "Grant types"; reference.Cell(1, 6).Style.Font.Bold = true;
            var grants = await db.GrantTypes.OrderBy(t => t.Name).Select(t => t.Name).ToListAsync();
            for (int i = 0; i < grants.Count; i++) reference.Cell(i + 2, 6).Value = grants[i];
            reference.Columns().AdjustToContents();

            var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);
            return File(ms, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "master_list_template.xlsx");
        }

        // POST /api/master-list/import (multipart, field "file") — .xlsx or .csv
        [HttpPost("import")]
        public async Task<IActionResult> Import(IFormFile file)
        {
            if (file is null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded." });

            List<Dictionary<string, string>> rows;
            try
            {
                rows = file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
                    ? UserImportController.ParseCsv(file)
                    : UserImportController.ParseXlsx(file);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Could not read the file: {ex.Message}" });
            }

            if (rows.Count == 0) return BadRequest(new { message = "The file contains no data rows." });
            if (rows.Count > MaxRows) return BadRequest(new { message = $"Too many rows ({rows.Count}). Maximum is {MaxRows} per import." });

            var campusByCode = await db.Campuses.ToDictionaryAsync(c => c.Code.ToUpper(), c => c.Id);
            var typeByName = await db.ScholarshipTypes.ToDictionaryAsync(t => t.Name.ToUpper(), t => t.Id);
            var grantByName = await db.GrantTypes.ToDictionaryAsync(t => t.Name.ToUpper(), t => t.Id);

            var results = new List<ImportRowResult>();
            var created = 0;

            for (int i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                string Get(string key) => row.TryGetValue(key.ToUpper(), out var v) ? v.Trim() : "";
                var rowNo = i + 2;
                var sid = Get("StudentId");

                int? campusId = null, typeId = null, grantId = null;
                decimal? amount = null;
                var fail = (string?)null;

                var campusCode = Get("CampusCode");
                if (campusCode.Length > 0)
                {
                    if (campusByCode.TryGetValue(campusCode.ToUpper(), out var c)) campusId = c;
                    else fail = $"Unknown campus code '{campusCode}'.";
                }
                var typeName = Get("ScholarshipType");
                if (fail is null && typeName.Length > 0)
                {
                    if (typeByName.TryGetValue(typeName.ToUpper(), out var t)) typeId = t;
                    else fail = $"Unknown scholarship type '{typeName}'.";
                }
                var grantName = Get("GrantType");
                if (fail is null && grantName.Length > 0)
                {
                    if (grantByName.TryGetValue(grantName.ToUpper(), out var g)) grantId = g;
                    else fail = $"Unknown grant type '{grantName}'.";
                }
                var amountText = Get("GrantAmount");
                if (fail is null && amountText.Length > 0)
                {
                    if (decimal.TryParse(amountText.Replace(",", ""), out var a)) amount = a;
                    else fail = $"Grant amount '{amountText}' is not a number.";
                }

                if (fail is not null)
                {
                    results.Add(new ImportRowResult(rowNo, sid, false, fail));
                    continue;
                }

                var kind = Get("Kind");
                if (kind.Length == 0) kind = grantId is not null ? EligibilityKinds.Grantee : EligibilityKinds.Scholar;

                var (line, error) = await BuildAsync(kind, sid, Get("LastName"), Get("FirstName"), Get("MiddleName"),
                    campusId, typeId, grantId, amount, Get("Notes"));

                // Lines added earlier in this same file are not in the database yet.
                if (error is null && db.ChangeTracker.Entries<EligibilityRecord>().Any(e =>
                        e.State == EntityState.Added && e.Entity.Kind == line!.Kind &&
                        e.Entity.StudentId == line.StudentId && e.Entity.GrantTypeId == line.GrantTypeId))
                    error = "Duplicate of an earlier row in this file.";

                if (error is not null)
                {
                    results.Add(new ImportRowResult(rowNo, sid, false, error));
                    continue;
                }

                var applied = await MasterList.ApplyToExistingAccountAsync(db, line!, ActorId);
                db.EligibilityRecords.Add(line!);
                created++;
                results.Add(new ImportRowResult(rowNo, line!.StudentId, true, applied is null ? "Added" : $"Added — {applied}"));
            }

            if (created > 0)
            {
                db.Audit(this, "ImportMasterList", $"Imported {created} master-list line(s) from {file.FileName}");
                await db.SaveChangesAsync();
            }

            return Ok(new { total = rows.Count, created, failed = rows.Count - created, results });
        }

        /* ── helpers ── */

        private string? ActorId => User.FindFirstValue(ClaimTypes.NameIdentifier);

        private async Task<(EligibilityRecord?, string?)> BuildAsync(
            string? kind, string? studentId, string? lastName, string? firstName, string? middleName,
            int? campusId, int? scholarshipTypeId, int? grantTypeId, decimal? grantAmount, string? notes,
            int? excludingId = null)
        {
            kind = EligibilityKinds.All.FirstOrDefault(k => string.Equals(k, kind?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (kind is null) return (null, "Kind must be Scholar or Grantee.");

            var sid = MasterList.NormalizeStudentId(studentId);
            if (!System.Text.RegularExpressions.Regex.IsMatch(sid, @"^[A-Z0-9\-]{3,30}$"))
                return (null, "Student ID may only contain letters, numbers, and hyphens (3–30 characters).");

            var last = MasterList.NormalizeName(lastName);
            var first = MasterList.NormalizeName(firstName);
            if (last.Length == 0 || first.Length == 0) return (null, "First and last name are required.");
            if (last.Length > 100 || first.Length > 100) return (null, "Names must be 100 characters or fewer.");

            if (campusId is int cid && !await db.Campuses.AnyAsync(c => c.Id == cid))
                return (null, "The selected campus does not exist.");

            if (kind == EligibilityKinds.Scholar)
            {
                if (scholarshipTypeId is not int st) return (null, "A scholar line needs a scholarship type.");
                if (!await db.ScholarshipTypes.AnyAsync(t => t.Id == st)) return (null, "The selected scholarship type does not exist.");
                grantTypeId = null;
                grantAmount = null;
            }
            else
            {
                if (grantTypeId is not int gt) return (null, "A grantee line needs a grant type.");
                var type = await db.GrantTypes.FindAsync(gt);
                if (type is null) return (null, "The selected grant type does not exist.");
                if (!type.IsActive) return (null, $"'{type.Name}' is deactivated. Reactivate it before adding grantees.");
                if (grantAmount is decimal a && (a <= 0 || a > 10_000_000m)) return (null, "Grant amount must be greater than zero.");
                if (grantAmount is null && type.DefaultAmount is null)
                    return (null, $"'{type.Name}' has no default amount, so a grant amount is required.");
                scholarshipTypeId = null;
            }

            var duplicate = await db.EligibilityRecords.AnyAsync(e =>
                e.Id != excludingId && e.Kind == kind && e.StudentId == sid && e.GrantTypeId == grantTypeId);
            if (duplicate)
                return (null, kind == EligibilityKinds.Scholar
                    ? $"{sid} is already on the scholar list."
                    : $"{sid} is already on the list for this grant.");

            return (new EligibilityRecord
            {
                Kind = kind,
                StudentId = sid,
                LastName = last,
                FirstName = first,
                MiddleName = MasterList.NormalizeOptionalName(middleName),
                CampusId = campusId,
                ScholarshipTypeId = scholarshipTypeId,
                GrantTypeId = grantTypeId,
                GrantAmount = grantAmount,
                Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
                CreatedById = ActorId,
            }, null);
        }

        public record ImportRowResult(int Row, string StudentId, bool Success, string Message);
    }

    public record MasterListRequest(
        [Required] string Kind,
        [Required, MaxLength(30)] string StudentId,
        [Required, MaxLength(100)] string LastName,
        [Required, MaxLength(100)] string FirstName,
        [MaxLength(100)] string? MiddleName,
        int? CampusId,
        int? ScholarshipTypeId,
        int? GrantTypeId,
        decimal? GrantAmount,
        [MaxLength(300)] string? Notes);
}
