using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class Revision2CampusesGranteesMasterList : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CampusId",
                table: "ScholarshipReleases",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledDate",
                table: "ScholarshipReleases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "YearLevel",
                table: "ScholarshipReleases",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CampusId",
                table: "ScholarProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_CivilStatus",
                table: "ScholarProfiles",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Personal_FamilyMembers",
                table: "ScholarProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherEducation",
                table: "ScholarProfiles",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_FatherLiving",
                table: "ScholarProfiles",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Personal_FatherMonthlyIncome",
                table: "ScholarProfiles",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherName",
                table: "ScholarProfiles",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherOccupation",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_Is4PsBeneficiary",
                table: "ScholarProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_IsFirstGenerationStudent",
                table: "ScholarProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_IsIndigenousPeople",
                table: "ScholarProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_IsPwd",
                table: "ScholarProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_IsSoloParent",
                table: "ScholarProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_IsWorkingStudent",
                table: "ScholarProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MainSupportSource",
                table: "ScholarProfiles",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherEducation",
                table: "ScholarProfiles",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Personal_MotherLiving",
                table: "ScholarProfiles",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Personal_MotherMonthlyIncome",
                table: "ScholarProfiles",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherName",
                table: "ScholarProfiles",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherOccupation",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_Sex",
                table: "ScholarProfiles",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Personal_Siblings",
                table: "ScholarProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Personal_SiblingsStudying",
                table: "ScholarProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GrantTypeId",
                table: "OneTimeGrants",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Campuses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Campuses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GrantTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Sponsor = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    DefaultAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeactivatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GrantTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CampusPrograms",
                columns: table => new
                {
                    CampusId = table.Column<int>(type: "int", nullable: false),
                    ProgramId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampusPrograms", x => new { x.CampusId, x.ProgramId });
                    table.ForeignKey(
                        name: "FK_CampusPrograms_AcademicPrograms_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "AcademicPrograms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CampusPrograms_Campuses_CampusId",
                        column: x => x.CampusId,
                        principalTable: "Campuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GranteeProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    StudentId = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CampusId = table.Column<int>(type: "int", nullable: true),
                    ProgramId = table.Column<int>(type: "int", nullable: true),
                    YearLevel = table.Column<int>(type: "int", nullable: false),
                    ContactNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    BirthDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Personal_Sex = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Personal_CivilStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Personal_Is4PsBeneficiary = table.Column<bool>(type: "bit", nullable: false),
                    Personal_IsIndigenousPeople = table.Column<bool>(type: "bit", nullable: false),
                    Personal_IsPwd = table.Column<bool>(type: "bit", nullable: false),
                    Personal_IsSoloParent = table.Column<bool>(type: "bit", nullable: false),
                    Personal_IsFirstGenerationStudent = table.Column<bool>(type: "bit", nullable: false),
                    Personal_IsWorkingStudent = table.Column<bool>(type: "bit", nullable: false),
                    Personal_FatherName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Personal_FatherLiving = table.Column<bool>(type: "bit", nullable: true),
                    Personal_FatherEducation = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Personal_FatherOccupation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Personal_FatherMonthlyIncome = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    Personal_MotherName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Personal_MotherLiving = table.Column<bool>(type: "bit", nullable: true),
                    Personal_MotherEducation = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Personal_MotherOccupation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Personal_MotherMonthlyIncome = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    Personal_FamilyMembers = table.Column<int>(type: "int", nullable: true),
                    Personal_Siblings = table.Column<int>(type: "int", nullable: true),
                    Personal_SiblingsStudying = table.Column<int>(type: "int", nullable: true),
                    Personal_MainSupportSource = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GranteeProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GranteeProfiles_AcademicPrograms_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "AcademicPrograms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_GranteeProfiles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GranteeProfiles_Campuses_CampusId",
                        column: x => x.CampusId,
                        principalTable: "Campuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "EligibilityRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    StudentId = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MiddleName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CampusId = table.Column<int>(type: "int", nullable: true),
                    ScholarshipTypeId = table.Column<int>(type: "int", nullable: true),
                    GrantTypeId = table.Column<int>(type: "int", nullable: true),
                    GrantAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ClaimedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    ClaimedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedById = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EligibilityRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EligibilityRecords_AspNetUsers_ClaimedByUserId",
                        column: x => x.ClaimedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EligibilityRecords_Campuses_CampusId",
                        column: x => x.CampusId,
                        principalTable: "Campuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EligibilityRecords_GrantTypes_GrantTypeId",
                        column: x => x.GrantTypeId,
                        principalTable: "GrantTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EligibilityRecords_ScholarshipTypes_ScholarshipTypeId",
                        column: x => x.ScholarshipTypeId,
                        principalTable: "ScholarshipTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipReleases_CampusId",
                table: "ScholarshipReleases",
                column: "CampusId");

            migrationBuilder.CreateIndex(
                name: "IX_ScholarProfiles_CampusId",
                table: "ScholarProfiles",
                column: "CampusId");

            migrationBuilder.CreateIndex(
                name: "IX_OneTimeGrants_GrantTypeId",
                table: "OneTimeGrants",
                column: "GrantTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Campuses_Code",
                table: "Campuses",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampusPrograms_ProgramId",
                table: "CampusPrograms",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRecords_CampusId",
                table: "EligibilityRecords",
                column: "CampusId");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRecords_ClaimedByUserId",
                table: "EligibilityRecords",
                column: "ClaimedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRecords_GrantTypeId",
                table: "EligibilityRecords",
                column: "GrantTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRecords_Kind_StudentId_GrantTypeId",
                table: "EligibilityRecords",
                columns: new[] { "Kind", "StudentId", "GrantTypeId" },
                unique: true,
                filter: "[GrantTypeId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRecords_ScholarshipTypeId",
                table: "EligibilityRecords",
                column: "ScholarshipTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRecords_StudentId",
                table: "EligibilityRecords",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_GranteeProfiles_CampusId",
                table: "GranteeProfiles",
                column: "CampusId");

            migrationBuilder.CreateIndex(
                name: "IX_GranteeProfiles_ProgramId",
                table: "GranteeProfiles",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_GranteeProfiles_StudentId",
                table: "GranteeProfiles",
                column: "StudentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GranteeProfiles_UserId",
                table: "GranteeProfiles",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_OneTimeGrants_GrantTypes_GrantTypeId",
                table: "OneTimeGrants",
                column: "GrantTypeId",
                principalTable: "GrantTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ScholarProfiles_Campuses_CampusId",
                table: "ScholarProfiles",
                column: "CampusId",
                principalTable: "Campuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ScholarshipReleases_Campuses_CampusId",
                table: "ScholarshipReleases",
                column: "CampusId",
                principalTable: "Campuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OneTimeGrants_GrantTypes_GrantTypeId",
                table: "OneTimeGrants");

            migrationBuilder.DropForeignKey(
                name: "FK_ScholarProfiles_Campuses_CampusId",
                table: "ScholarProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_ScholarshipReleases_Campuses_CampusId",
                table: "ScholarshipReleases");

            migrationBuilder.DropTable(
                name: "CampusPrograms");

            migrationBuilder.DropTable(
                name: "EligibilityRecords");

            migrationBuilder.DropTable(
                name: "GranteeProfiles");

            migrationBuilder.DropTable(
                name: "GrantTypes");

            migrationBuilder.DropTable(
                name: "Campuses");

            migrationBuilder.DropIndex(
                name: "IX_ScholarshipReleases_CampusId",
                table: "ScholarshipReleases");

            migrationBuilder.DropIndex(
                name: "IX_ScholarProfiles_CampusId",
                table: "ScholarProfiles");

            migrationBuilder.DropIndex(
                name: "IX_OneTimeGrants_GrantTypeId",
                table: "OneTimeGrants");

            migrationBuilder.DropColumn(
                name: "CampusId",
                table: "ScholarshipReleases");

            migrationBuilder.DropColumn(
                name: "ScheduledDate",
                table: "ScholarshipReleases");

            migrationBuilder.DropColumn(
                name: "YearLevel",
                table: "ScholarshipReleases");

            migrationBuilder.DropColumn(
                name: "CampusId",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_CivilStatus",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FamilyMembers",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherEducation",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherLiving",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherMonthlyIncome",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherOccupation",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_Is4PsBeneficiary",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_IsFirstGenerationStudent",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_IsIndigenousPeople",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_IsPwd",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_IsSoloParent",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_IsWorkingStudent",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MainSupportSource",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherEducation",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherLiving",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherMonthlyIncome",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherOccupation",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_Sex",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_Siblings",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_SiblingsStudying",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "GrantTypeId",
                table: "OneTimeGrants");
        }
    }
}
