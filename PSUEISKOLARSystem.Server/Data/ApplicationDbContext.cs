using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : IdentityDbContext<ApplicationUser>(options)
    {
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<ScholarshipType> ScholarshipTypes => Set<ScholarshipType>();
        public DbSet<AcademicProgram> AcademicPrograms => Set<AcademicProgram>();
        public DbSet<ScholarProfile> ScholarProfiles => Set<ScholarProfile>();
        public DbSet<AcademicGrade> AcademicGrades => Set<AcademicGrade>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<DocumentRequirement> DocumentRequirements => Set<DocumentRequirement>();
        public DbSet<DocumentSubmission> DocumentSubmissions => Set<DocumentSubmission>();
        public DbSet<ActiveSemester> ActiveSemesters => Set<ActiveSemester>();
        public DbSet<ScholarshipTypeRequirement> ScholarshipTypeRequirements => Set<ScholarshipTypeRequirement>();
        public DbSet<DocumentStatusHistory> DocumentStatusHistories => Set<DocumentStatusHistory>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<SubmissionDeadline> SubmissionDeadlines => Set<SubmissionDeadline>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<ScholarshipAssignment> ScholarshipAssignments => Set<ScholarshipAssignment>();
        public DbSet<OneTimeGrant> OneTimeGrants => Set<OneTimeGrant>();
        public DbSet<AnnouncementRecipient> AnnouncementRecipients => Set<AnnouncementRecipient>();
        public DbSet<MessagingSettings> MessagingSettings => Set<MessagingSettings>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

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
                .HasOne(a => a.TargetScholarshipType)
                .WithMany()
                .HasForeignKey(a => a.TargetScholarshipTypeId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<Announcement>()
                .HasOne(a => a.TargetProgram)
                .WithMany()
                .HasForeignKey(a => a.TargetProgramId)
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

            builder.Entity<ScholarshipTypeRequirement>()
                .HasKey(str => new { str.ScholarshipTypeId, str.RequirementId });

            builder.Entity<ScholarshipTypeRequirement>()
                .HasOne(str => str.ScholarshipType)
                .WithMany(st => st.Requirements)
                .HasForeignKey(str => str.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ScholarshipTypeRequirement>()
                .HasOne(str => str.Requirement)
                .WithMany(dr => dr.ScholarshipTypes)
                .HasForeignKey(str => str.RequirementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<DocumentStatusHistory>()
                .HasOne(h => h.Submission)
                .WithMany(ds => ds.StatusHistory)
                .HasForeignKey(h => h.SubmissionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<DocumentStatusHistory>()
                .HasOne(h => h.ChangedBy)
                .WithMany()
                .HasForeignKey(h => h.ChangedById)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Notification>()
                .HasOne(n => n.Recipient)
                .WithMany()
                .HasForeignKey(n => n.RecipientId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<Notification>()
                .HasIndex(n => new { n.RecipientId, n.IsRead });

            builder.Entity<SubmissionDeadline>()
                .HasOne(d => d.Requirement)
                .WithMany()
                .HasForeignKey(d => d.RequirementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<SubmissionDeadline>()
                .HasOne(d => d.CreatedBy)
                .WithMany()
                .HasForeignKey(d => d.CreatedById)
                .OnDelete(DeleteBehavior.SetNull);

            // One deadline per requirement per academic period.
            builder.Entity<SubmissionDeadline>()
                .HasIndex(d => new { d.RequirementId, d.AcademicYear, d.Semester })
                .IsUnique();

            // Two FKs to ApplicationUser → Restrict to avoid multiple cascade paths.
            builder.Entity<Message>()
                .HasOne(m => m.Scholar)
                .WithMany()
                .HasForeignKey(m => m.ScholarId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Message>()
                .HasOne(m => m.Requirement)
                .WithMany()
                .HasForeignKey(m => m.RequirementId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<Message>()
                .HasIndex(m => new { m.ScholarId, m.RequirementId });

            /* ── Scholarship assignment history (strictly one active per scholar) ── */

            builder.Entity<ScholarshipAssignment>()
                .HasOne(a => a.Scholar)
                .WithMany()
                .HasForeignKey(a => a.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ScholarshipAssignment>()
                .HasOne(a => a.ScholarshipType)
                .WithMany()
                .HasForeignKey(a => a.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Actor FKs are nulled out before a user is deleted (see UsersController.Delete)
            // to avoid multiple cascade paths into ApplicationUser.
            builder.Entity<ScholarshipAssignment>()
                .HasOne(a => a.AssignedBy)
                .WithMany()
                .HasForeignKey(a => a.AssignedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            // The single-active-scholarship rule, enforced in the database.
            builder.Entity<ScholarshipAssignment>()
                .HasIndex(a => a.ScholarId)
                .HasFilter("[EndedAt] IS NULL")
                .IsUnique();

            builder.Entity<ScholarshipAssignment>()
                .HasIndex(a => new { a.ScholarId, a.AssignedAt });

            /* ── One-time grants ── */

            builder.Entity<OneTimeGrant>()
                .HasOne(g => g.Scholar)
                .WithMany()
                .HasForeignKey(g => g.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<OneTimeGrant>()
                .HasOne(g => g.RecordedBy)
                .WithMany()
                .HasForeignKey(g => g.RecordedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<OneTimeGrant>()
                .Property(g => g.Amount)
                .HasPrecision(12, 2);

            builder.Entity<OneTimeGrant>()
                .HasIndex(g => new { g.ScholarId, g.AwardedOn });

            /* ── Per-scholar announcement recipients ── */

            builder.Entity<AnnouncementRecipient>()
                .HasKey(r => new { r.AnnouncementId, r.ScholarId });

            builder.Entity<AnnouncementRecipient>()
                .HasOne(r => r.Announcement)
                .WithMany(a => a.Recipients)
                .HasForeignKey(r => r.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<AnnouncementRecipient>()
                .HasOne(r => r.Scholar)
                .WithMany()
                .HasForeignKey(r => r.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            /* ── Messaging settings (single row) ── */

            builder.Entity<MessagingSettings>()
                .HasOne(s => s.UpdatedBy)
                .WithMany()
                .HasForeignKey(s => s.UpdatedById)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
