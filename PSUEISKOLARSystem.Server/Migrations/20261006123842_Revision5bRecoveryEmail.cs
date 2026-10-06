using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class Revision5bRecoveryEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecoveryEmail",
                table: "AspNetUsers",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecoveryEmail",
                table: "AspNetUsers");
        }
    }
}
