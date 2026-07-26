using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddAvatarSlotsRequirementOrderSchedulingAndMuting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SlotLimit",
                table: "ScholarshipTypes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "DocumentRequirements",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "GroupName",
                table: "DocumentRequirements",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AvatarPath",
                table: "AspNetUsers",
                type: "nvarchar(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MutedNotificationCategories",
                table: "AspNetUsers",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishAt",
                table: "Announcements",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                table: "Announcements",
                type: "datetime2",
                nullable: true);

            // Every announcement that predates scheduling went out the moment it was created,
            // so stamp it as published — otherwise the publisher service would treat them as
            // pending and re-notify everyone.
            migrationBuilder.Sql("UPDATE [Announcements] SET [PublishedAt] = [CreatedAt] WHERE [PublishedAt] IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SlotLimit",
                table: "ScholarshipTypes");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "DocumentRequirements");

            migrationBuilder.DropColumn(
                name: "GroupName",
                table: "DocumentRequirements");

            migrationBuilder.DropColumn(
                name: "AvatarPath",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "MutedNotificationCategories",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PublishAt",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                table: "Announcements");
        }
    }
}
