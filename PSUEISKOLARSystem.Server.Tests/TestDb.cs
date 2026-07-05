using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

// Builds an isolated in-memory ApplicationDbContext with convenience seeders.
public static class TestDb
{
    public static ApplicationDbContext New()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new ApplicationDbContext(options);
        db.Roles.Add(new IdentityRole { Id = "role-scholar", Name = UserRoles.Scholar, NormalizedName = "SCHOLAR" });
        db.SaveChanges();
        return db;
    }

    // Adds a scholar user (with the Scholar role) and returns it.
    public static ApplicationUser AddScholar(this ApplicationDbContext db, string id, bool active = true, int? campusId = null)
    {
        var u = new ApplicationUser { Id = id, UserName = id + "@t", Email = id + "@t", FirstName = id, LastName = "Test", IsActive = active, CampusId = campusId };
        db.Users.Add(u);
        db.UserRoles.Add(new IdentityUserRole<string> { UserId = id, RoleId = "role-scholar" });
        return u;
    }

    public static ScholarshipType AddType(this ApplicationDbContext db, int id, string name, decimal minGwa = 2.5m)
    {
        var t = new ScholarshipType { Id = id, Name = name, MinimumGwa = minGwa };
        db.ScholarshipTypes.Add(t);
        return t;
    }

    public static DocumentRequirement AddRequirement(this ApplicationDbContext db, int id, string name)
    {
        var r = new DocumentRequirement { Id = id, Name = name, IsActive = true, IsRequired = true };
        db.DocumentRequirements.Add(r);
        return r;
    }

    public static void LinkTypeRequirement(this ApplicationDbContext db, int typeId, int requirementId)
        => db.ScholarshipTypeRequirements.Add(new ScholarshipTypeRequirement { ScholarshipTypeId = typeId, RequirementId = requirementId });

    public static ScholarProfile AddProfile(this ApplicationDbContext db, string userId, int? typeId)
    {
        var p = new ScholarProfile { UserId = userId, StudentId = "S-" + userId, ScholarshipTypeId = typeId };
        db.ScholarProfiles.Add(p);
        return p;
    }

    public static void AddGrade(this ApplicationDbContext db, int profileId, string year, int sem, decimal gwa, bool meets)
        => db.AcademicGrades.Add(new AcademicGrade { ScholarProfileId = profileId, AcademicYear = year, Semester = sem, Gwa = gwa, MeetsRequirement = meets });

    public static void AddSubmission(this ApplicationDbContext db, string scholarId, int requirementId, DocumentStatus status, string year = "2025-2026", int sem = 1)
        => db.DocumentSubmissions.Add(new DocumentSubmission
        {
            ScholarId = scholarId, RequirementId = requirementId, Status = status,
            AcademicYear = year, Semester = sem,
            FileName = "f.pdf", StoredFileName = "s.pdf", ContentType = "application/pdf", FileSizeBytes = 1,
        });
}
