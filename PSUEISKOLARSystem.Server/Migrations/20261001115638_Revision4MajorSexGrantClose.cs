using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class Revision4MajorSexGrantClose : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AccountsClosedAt",
                table: "GrantTypes",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Sex",
                table: "EligibilityRecords",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Major",
                table: "AcademicPrograms",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            // Types the office already closed by hand count as closed, so the automatic close
            // after the release day leaves them alone if they are reactivated.
            migrationBuilder.Sql("UPDATE GrantTypes SET AccountsClosedAt = DeactivatedAt WHERE IsActive = 0 AND DeactivatedAt IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountsClosedAt",
                table: "GrantTypes");

            migrationBuilder.DropColumn(
                name: "Sex",
                table: "EligibilityRecords");

            migrationBuilder.DropColumn(
                name: "Major",
                table: "AcademicPrograms");
        }
    }
}
