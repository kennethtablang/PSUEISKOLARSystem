using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddRequirementMappingTargetingAndStatusHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TargetProgramId",
                table: "Announcements",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TargetScholarshipTypeId",
                table: "Announcements",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DocumentStatusHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubmissionId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ChangedById = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentStatusHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentStatusHistories_AspNetUsers_ChangedById",
                        column: x => x.ChangedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocumentStatusHistories_DocumentSubmissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "DocumentSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScholarshipTypeRequirements",
                columns: table => new
                {
                    ScholarshipTypeId = table.Column<int>(type: "int", nullable: false),
                    RequirementId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScholarshipTypeRequirements", x => new { x.ScholarshipTypeId, x.RequirementId });
                    table.ForeignKey(
                        name: "FK_ScholarshipTypeRequirements_DocumentRequirements_RequirementId",
                        column: x => x.RequirementId,
                        principalTable: "DocumentRequirements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScholarshipTypeRequirements_ScholarshipTypes_ScholarshipTypeId",
                        column: x => x.ScholarshipTypeId,
                        principalTable: "ScholarshipTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_TargetProgramId",
                table: "Announcements",
                column: "TargetProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_TargetScholarshipTypeId",
                table: "Announcements",
                column: "TargetScholarshipTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentStatusHistories_ChangedById",
                table: "DocumentStatusHistories",
                column: "ChangedById");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentStatusHistories_SubmissionId",
                table: "DocumentStatusHistories",
                column: "SubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipTypeRequirements_RequirementId",
                table: "ScholarshipTypeRequirements",
                column: "RequirementId");

            migrationBuilder.AddForeignKey(
                name: "FK_Announcements_AcademicPrograms_TargetProgramId",
                table: "Announcements",
                column: "TargetProgramId",
                principalTable: "AcademicPrograms",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Announcements_ScholarshipTypes_TargetScholarshipTypeId",
                table: "Announcements",
                column: "TargetScholarshipTypeId",
                principalTable: "ScholarshipTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Announcements_AcademicPrograms_TargetProgramId",
                table: "Announcements");

            migrationBuilder.DropForeignKey(
                name: "FK_Announcements_ScholarshipTypes_TargetScholarshipTypeId",
                table: "Announcements");

            migrationBuilder.DropTable(
                name: "DocumentStatusHistories");

            migrationBuilder.DropTable(
                name: "ScholarshipTypeRequirements");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_TargetProgramId",
                table: "Announcements");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_TargetScholarshipTypeId",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "TargetProgramId",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "TargetScholarshipTypeId",
                table: "Announcements");
        }
    }
}
