using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class Revision3GrantScheduleParentNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherFirstName",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherLastName",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherMiddleName",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherFirstName",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherLastName",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherMiddleName",
                table: "ScholarProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledDate",
                table: "GrantTypes",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherFirstName",
                table: "GranteeProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherLastName",
                table: "GranteeProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_FatherMiddleName",
                table: "GranteeProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherFirstName",
                table: "GranteeProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherLastName",
                table: "GranteeProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Personal_MotherMiddleName",
                table: "GranteeProfiles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            // Existing father names were typed as "LAST, FIRST MIDDLE" in one box: the part
            // before the comma is the last name; the rest goes to the first name, since first and
            // middle names cannot be told apart reliably. A name with no comma stays whole.
            migrationBuilder.Sql(@"
UPDATE [ScholarProfiles]
SET [Personal_FatherLastName]  = CASE WHEN CHARINDEX(',', [Personal_FatherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(LEFT([Personal_FatherName], CHARINDEX(',', [Personal_FatherName]) - 1))), '')
                          ELSE NULL END,
    [Personal_FatherFirstName] = CASE WHEN CHARINDEX(',', [Personal_FatherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(SUBSTRING([Personal_FatherName], CHARINDEX(',', [Personal_FatherName]) + 1, 150))), '')
                          ELSE LTRIM(RTRIM([Personal_FatherName])) END,
    [Personal_FatherOccupation] = UPPER([Personal_FatherOccupation])
WHERE [Personal_FatherName] IS NOT NULL OR [Personal_FatherOccupation] IS NOT NULL;");

            // Existing mother names were typed as "LAST, FIRST MIDDLE" in one box: the part
            // before the comma is the last name; the rest goes to the first name, since first and
            // middle names cannot be told apart reliably. A name with no comma stays whole.
            migrationBuilder.Sql(@"
UPDATE [ScholarProfiles]
SET [Personal_MotherLastName]  = CASE WHEN CHARINDEX(',', [Personal_MotherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(LEFT([Personal_MotherName], CHARINDEX(',', [Personal_MotherName]) - 1))), '')
                          ELSE NULL END,
    [Personal_MotherFirstName] = CASE WHEN CHARINDEX(',', [Personal_MotherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(SUBSTRING([Personal_MotherName], CHARINDEX(',', [Personal_MotherName]) + 1, 150))), '')
                          ELSE LTRIM(RTRIM([Personal_MotherName])) END,
    [Personal_MotherOccupation] = UPPER([Personal_MotherOccupation])
WHERE [Personal_MotherName] IS NOT NULL OR [Personal_MotherOccupation] IS NOT NULL;");

            // Existing father names were typed as "LAST, FIRST MIDDLE" in one box: the part
            // before the comma is the last name; the rest goes to the first name, since first and
            // middle names cannot be told apart reliably. A name with no comma stays whole.
            migrationBuilder.Sql(@"
UPDATE [GranteeProfiles]
SET [Personal_FatherLastName]  = CASE WHEN CHARINDEX(',', [Personal_FatherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(LEFT([Personal_FatherName], CHARINDEX(',', [Personal_FatherName]) - 1))), '')
                          ELSE NULL END,
    [Personal_FatherFirstName] = CASE WHEN CHARINDEX(',', [Personal_FatherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(SUBSTRING([Personal_FatherName], CHARINDEX(',', [Personal_FatherName]) + 1, 150))), '')
                          ELSE LTRIM(RTRIM([Personal_FatherName])) END,
    [Personal_FatherOccupation] = UPPER([Personal_FatherOccupation])
WHERE [Personal_FatherName] IS NOT NULL OR [Personal_FatherOccupation] IS NOT NULL;");

            // Existing mother names were typed as "LAST, FIRST MIDDLE" in one box: the part
            // before the comma is the last name; the rest goes to the first name, since first and
            // middle names cannot be told apart reliably. A name with no comma stays whole.
            migrationBuilder.Sql(@"
UPDATE [GranteeProfiles]
SET [Personal_MotherLastName]  = CASE WHEN CHARINDEX(',', [Personal_MotherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(LEFT([Personal_MotherName], CHARINDEX(',', [Personal_MotherName]) - 1))), '')
                          ELSE NULL END,
    [Personal_MotherFirstName] = CASE WHEN CHARINDEX(',', [Personal_MotherName]) > 0
                          THEN NULLIF(LTRIM(RTRIM(SUBSTRING([Personal_MotherName], CHARINDEX(',', [Personal_MotherName]) + 1, 150))), '')
                          ELSE LTRIM(RTRIM([Personal_MotherName])) END,
    [Personal_MotherOccupation] = UPPER([Personal_MotherOccupation])
WHERE [Personal_MotherName] IS NOT NULL OR [Personal_MotherOccupation] IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Personal_FatherFirstName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherLastName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherMiddleName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherFirstName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherLastName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherMiddleName",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "ScheduledDate",
                table: "GrantTypes");

            migrationBuilder.DropColumn(
                name: "Personal_FatherFirstName",
                table: "GranteeProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherLastName",
                table: "GranteeProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_FatherMiddleName",
                table: "GranteeProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherFirstName",
                table: "GranteeProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherLastName",
                table: "GranteeProfiles");

            migrationBuilder.DropColumn(
                name: "Personal_MotherMiddleName",
                table: "GranteeProfiles");
        }
    }
}
