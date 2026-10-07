using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class Revision6GranteeUpgrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConvertedFromGranteeAt",
                table: "ScholarProfiles",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DetailsReviewPending",
                table: "ScholarProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConvertedFromGranteeAt",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "DetailsReviewPending",
                table: "ScholarProfiles");
        }
    }
}
