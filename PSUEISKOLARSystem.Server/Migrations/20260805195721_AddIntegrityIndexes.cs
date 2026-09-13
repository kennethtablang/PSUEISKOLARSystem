using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <summary>
    /// Turns three invariants that were only ever described in comments into database
    /// constraints, and indexes the columns the largest tables are actually queried by.
    /// <para>
    /// Two of the new indexes are unique, so rows that already violate them have to be
    /// reconciled first — see <c>ReconcileDuplicates</c>. A third, the unique student number,
    /// is deliberately <i>not</i> auto-reconciled: which of two scholars owns a student number
    /// is not a decision a migration should make. If this migration fails on
    /// <c>IX_ScholarProfiles_StudentId</c>, the Scholarship Check report
    /// (<c>/scholarship-verification</c>) lists the affected scholars; correct them there and
    /// run the migration again.
    /// </para>
    /// </summary>
    public partial class AddIntegrityIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ReconcileDuplicates(migrationBuilder);

            migrationBuilder.DropIndex(
                name: "IX_DocumentSubmissions_ScholarId",
                table: "DocumentSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_AcademicGrades_ScholarProfileId",
                table: "AcademicGrades");

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                table: "AuditLogs",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateIndex(
                name: "IX_ScholarProfiles_StudentId",
                table: "ScholarProfiles",
                column: "StudentId",
                unique: true,
                filter: "[StudentId] <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentSubmissions_AcademicYear_Semester_Status",
                table: "DocumentSubmissions",
                columns: new[] { "AcademicYear", "Semester", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentSubmissions_ScholarId_RequirementId_AcademicYear_Semester",
                table: "DocumentSubmissions",
                columns: new[] { "ScholarId", "RequirementId", "AcademicYear", "Semester" },
                unique: true,
                filter: "[Status] <> 2");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentSubmissions_ScholarId_Status",
                table: "DocumentSubmissions",
                columns: new[] { "ScholarId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TimestampUtc",
                table: "AuditLogs",
                column: "TimestampUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId_TimestampUtc",
                table: "AuditLogs",
                columns: new[] { "UserId", "TimestampUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AcademicGrades_ScholarProfileId_AcademicYear_Semester",
                table: "AcademicGrades",
                columns: new[] { "ScholarProfileId", "AcademicYear", "Semester" },
                unique: true);
        }

        /// <summary>
        /// Clears the way for the two unique indexes below. Both cases are corruption the
        /// application could previously produce and had no way to correct.
        /// </summary>
        private static void ReconcileDuplicates(MigrationBuilder migrationBuilder)
        {
            /* A GWA recorded twice for the same period. There was no edit endpoint, so the
               only way to fix a mistyped grade was to enter it again — the later row is the
               correction and the earlier one is what it was correcting. Keep the newest. */
            migrationBuilder.Sql("""
                WITH ranked AS (
                    SELECT Id,
                           ROW_NUMBER() OVER (
                               PARTITION BY ScholarProfileId, AcademicYear, Semester
                               ORDER BY RecordedAt DESC, Id DESC) AS rn
                    FROM AcademicGrades)
                DELETE FROM AcademicGrades
                WHERE Id IN (SELECT Id FROM ranked WHERE rn > 1);
                """);

            /* Two live submissions for one requirement and period — what the verified-replace
               fall-through produced. Nothing is deleted here: the older rows are marked
               Incomplete (2), which is how a superseded attempt is already represented, keeps
               them out of the filtered unique index, and leaves their files intact. */
            migrationBuilder.Sql("""
                WITH ranked AS (
                    SELECT Id,
                           ROW_NUMBER() OVER (
                               PARTITION BY ScholarId, RequirementId, AcademicYear, Semester
                               ORDER BY SubmittedAt DESC, Id DESC) AS rn
                    FROM DocumentSubmissions
                    WHERE Status <> 2)
                UPDATE DocumentSubmissions
                SET Status = 2
                WHERE Id IN (SELECT Id FROM ranked WHERE rn > 1);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ScholarProfiles_StudentId",
                table: "ScholarProfiles");

            migrationBuilder.DropIndex(
                name: "IX_DocumentSubmissions_AcademicYear_Semester_Status",
                table: "DocumentSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_DocumentSubmissions_ScholarId_RequirementId_AcademicYear_Semester",
                table: "DocumentSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_DocumentSubmissions_ScholarId_Status",
                table: "DocumentSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_TimestampUtc",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_UserId_TimestampUtc",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AcademicGrades_ScholarProfileId_AcademicYear_Semester",
                table: "AcademicGrades");

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                table: "AuditLogs",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentSubmissions_ScholarId",
                table: "DocumentSubmissions",
                column: "ScholarId");

            migrationBuilder.CreateIndex(
                name: "IX_AcademicGrades_ScholarProfileId",
                table: "AcademicGrades",
                column: "ScholarProfileId");
        }
    }
}
