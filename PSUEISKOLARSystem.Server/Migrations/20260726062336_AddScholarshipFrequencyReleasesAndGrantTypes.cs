using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddScholarshipFrequencyReleasesAndGrantTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "ScholarshipTypes",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            // EF defaults a new non-nullable string column to "" and does NOT run the C#
            // property initializer over existing rows, so every scholarship type already in
            // the database would come back with a frequency of "" — matching no known value
            // and silently dropping out of the release monitor. PerSemester is both the model
            // default and the truthful answer for the seeded types.
            migrationBuilder.AddColumn<string>(
                name: "Frequency",
                table: "ScholarshipTypes",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "PerSemester");

            migrationBuilder.AddColumn<int>(
                name: "ScholarshipTypeId",
                table: "OneTimeGrants",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ScholarshipReleases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScholarId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ScholarshipTypeId = table.Column<int>(type: "int", nullable: false),
                    AcademicYear = table.Column<string>(type: "nvarchar(9)", maxLength: 9, nullable: false),
                    Semester = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReleasedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReferenceNo = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecordedById = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScholarshipReleases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScholarshipReleases_AspNetUsers_RecordedById",
                        column: x => x.RecordedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ScholarshipReleases_AspNetUsers_ScholarId",
                        column: x => x.ScholarId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScholarshipReleases_ScholarshipTypes_ScholarshipTypeId",
                        column: x => x.ScholarshipTypeId,
                        principalTable: "ScholarshipTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OneTimeGrants_ScholarshipTypeId",
                table: "OneTimeGrants",
                column: "ScholarshipTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipReleases_RecordedById",
                table: "ScholarshipReleases",
                column: "RecordedById");

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipReleases_ScholarId_ScholarshipTypeId_AcademicYear_Semester",
                table: "ScholarshipReleases",
                columns: new[] { "ScholarId", "ScholarshipTypeId", "AcademicYear", "Semester" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipReleases_ScholarshipTypeId_AcademicYear_Semester",
                table: "ScholarshipReleases",
                columns: new[] { "ScholarshipTypeId", "AcademicYear", "Semester" });

            migrationBuilder.AddForeignKey(
                name: "FK_OneTimeGrants_ScholarshipTypes_ScholarshipTypeId",
                table: "OneTimeGrants",
                column: "ScholarshipTypeId",
                principalTable: "ScholarshipTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OneTimeGrants_ScholarshipTypes_ScholarshipTypeId",
                table: "OneTimeGrants");

            migrationBuilder.DropTable(
                name: "ScholarshipReleases");

            migrationBuilder.DropIndex(
                name: "IX_OneTimeGrants_ScholarshipTypeId",
                table: "OneTimeGrants");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "ScholarshipTypes");

            migrationBuilder.DropColumn(
                name: "Frequency",
                table: "ScholarshipTypes");

            migrationBuilder.DropColumn(
                name: "ScholarshipTypeId",
                table: "OneTimeGrants");
        }
    }
}
