using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : IdentityDbContext<ApplicationUser>(options)
    {
        public DbSet<Campus> Campuses => Set<Campus>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<ScholarshipType> ScholarshipTypes => Set<ScholarshipType>();
        public DbSet<AcademicProgram> AcademicPrograms => Set<AcademicProgram>();
        public DbSet<ScholarProfile> ScholarProfiles => Set<ScholarProfile>();
        public DbSet<AcademicGrade> AcademicGrades => Set<AcademicGrade>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<DocumentRequirement> DocumentRequirements => Set<DocumentRequirement>();
        public DbSet<DocumentSubmission> DocumentSubmissions => Set<DocumentSubmission>();
        public DbSet<ActiveSemester> ActiveSemesters => Set<ActiveSemester>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<Campus>()
                .HasIndex(c => c.Code)
                .IsUnique();

            builder.Entity<ApplicationUser>()
                .HasOne(u => u.Campus)
                .WithMany(c => c.Users)
                .HasForeignKey(u => u.CampusId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<ScholarProfile>()
                .HasOne(sp => sp.User)
                .WithOne()
                .HasForeignKey<ScholarProfile>(sp => sp.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ScholarProfile>()
                .HasOne(sp => sp.ScholarshipType)
                .WithMany(st => st.Scholars)
                .HasForeignKey(sp => sp.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<ScholarProfile>()
                .HasOne(sp => sp.Program)
                .WithMany(p => p.Scholars)
                .HasForeignKey(sp => sp.ProgramId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<AcademicGrade>()
                .HasOne(g => g.ScholarProfile)
                .WithMany(sp => sp.Grades)
                .HasForeignKey(g => g.ScholarProfileId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<AcademicGrade>()
                .HasOne(g => g.RecordedBy)
                .WithMany()
                .HasForeignKey(g => g.RecordedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<Announcement>()
                .HasOne(a => a.CreatedBy)
                .WithMany()
                .HasForeignKey(a => a.CreatedById)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Announcement>()
                .HasOne(a => a.TargetCampus)
                .WithMany()
                .HasForeignKey(a => a.TargetCampusId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<ScholarshipType>()
                .Property(st => st.MinimumGwa)
                .HasPrecision(3, 2);

            builder.Entity<AcademicGrade>()
                .Property(g => g.Gwa)
                .HasPrecision(3, 2);

            builder.Entity<DocumentRequirement>()
                .HasOne(dr => dr.ScholarshipType)
                .WithMany()
                .HasForeignKey(dr => dr.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<DocumentSubmission>()
                .HasOne(ds => ds.Scholar)
                .WithMany()
                .HasForeignKey(ds => ds.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<DocumentSubmission>()
                .HasOne(ds => ds.Requirement)
                .WithMany(dr => dr.Submissions)
                .HasForeignKey(ds => ds.RequirementId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<DocumentSubmission>()
                .HasOne(ds => ds.ReviewedBy)
                .WithMany()
                .HasForeignKey(ds => ds.ReviewedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<ActiveSemester>()
                .HasOne(a => a.UpdatedBy)
                .WithMany()
                .HasForeignKey(a => a.UpdatedById)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
