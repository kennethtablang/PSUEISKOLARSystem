using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class Revision8CampusGrantTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CampusId",
                table: "GrantTypes",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GrantTypes_CampusId",
                table: "GrantTypes",
                column: "CampusId");

            migrationBuilder.AddForeignKey(
                name: "FK_GrantTypes_Campuses_CampusId",
                table: "GrantTypes",
                column: "CampusId",
                principalTable: "Campuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GrantTypes_Campuses_CampusId",
                table: "GrantTypes");

            migrationBuilder.DropIndex(
                name: "IX_GrantTypes_CampusId",
                table: "GrantTypes");

            migrationBuilder.DropColumn(
                name: "CampusId",
                table: "GrantTypes");
        }
    }
}
