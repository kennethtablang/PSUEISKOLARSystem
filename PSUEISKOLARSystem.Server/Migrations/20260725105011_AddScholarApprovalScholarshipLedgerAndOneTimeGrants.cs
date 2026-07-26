using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddScholarApprovalScholarshipLedgerAndOneTimeGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovalDecidedAt",
                table: "AspNetUsers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovalDecidedById",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovalNote",
                table: "AspNetUsers",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            // Every account that already exists was created by an administrator, so it is
            // already verified. Only new self-registrations start as Pending.
            migrationBuilder.AddColumn<string>(
                name: "ApprovalStatus",
                table: "AspNetUsers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.CreateTable(
                name: "OneTimeGrants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScholarId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Purpose = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    AwardedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReleaseStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReleasedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReferenceNo = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecordedById = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneTimeGrants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OneTimeGrants_AspNetUsers_RecordedById",
                        column: x => x.RecordedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OneTimeGrants_AspNetUsers_ScholarId",
                        column: x => x.ScholarId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScholarshipAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScholarId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ScholarshipTypeId = table.Column<int>(type: "int", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedById = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndReason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    EndedById = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScholarshipAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScholarshipAssignments_AspNetUsers_AssignedById",
                        column: x => x.AssignedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ScholarshipAssignments_AspNetUsers_ScholarId",
                        column: x => x.ScholarId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScholarshipAssignments_ScholarshipTypes_ScholarshipTypeId",
                        column: x => x.ScholarshipTypeId,
                        principalTable: "ScholarshipTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OneTimeGrants_RecordedById",
                table: "OneTimeGrants",
                column: "RecordedById");

            migrationBuilder.CreateIndex(
                name: "IX_OneTimeGrants_ScholarId_AwardedOn",
                table: "OneTimeGrants",
                columns: new[] { "ScholarId", "AwardedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipAssignments_AssignedById",
                table: "ScholarshipAssignments",
                column: "AssignedById");

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipAssignments_ScholarId",
                table: "ScholarshipAssignments",
                column: "ScholarId",
                unique: true,
                filter: "[EndedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipAssignments_ScholarId_AssignedAt",
                table: "ScholarshipAssignments",
                columns: new[] { "ScholarId", "AssignedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipAssignments_ScholarshipTypeId",
                table: "ScholarshipAssignments",
                column: "ScholarshipTypeId");

            // Seed the ledger from the scholarship each existing scholar already holds, so the
            // one-scholarship-per-student rule and the verification report have a baseline.
            // ScholarProfiles.UserId is unique, so this cannot violate the single-active index.
            migrationBuilder.Sql("""
                INSERT INTO [ScholarshipAssignments] ([ScholarId], [ScholarshipTypeId], [AssignedAt])
                SELECT sp.[UserId], sp.[ScholarshipTypeId], sp.[EnrolledAt]
                FROM [ScholarProfiles] sp
                WHERE sp.[ScholarshipTypeId] IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OneTimeGrants");

            migrationBuilder.DropTable(
                name: "ScholarshipAssignments");

            migrationBuilder.DropColumn(
                name: "ApprovalDecidedAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ApprovalDecidedById",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ApprovalNote",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ApprovalStatus",
                table: "AspNetUsers");
        }
    }
}
