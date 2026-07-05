using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddLifecycleConsentPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LifecycleStatus",
                table: "ScholarProfiles",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ConsentAcceptedAt",
                table: "AspNetUsers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConsentVersion",
                table: "AspNetUsers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EmailAnnouncements",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "EmailDeadlines",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "EmailDocumentStatus",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LifecycleStatus",
                table: "ScholarProfiles");

            migrationBuilder.DropColumn(
                name: "ConsentAcceptedAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ConsentVersion",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EmailAnnouncements",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EmailDeadlines",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EmailDocumentStatus",
                table: "AspNetUsers");
        }
    }
}
