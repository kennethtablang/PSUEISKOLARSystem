using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <inheritdoc />
    public partial class Revision5CampusScoping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CampusId",
                table: "ScholarshipTypes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CampusId",
                table: "AspNetUsers",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScholarshipTypes_CampusId",
                table: "ScholarshipTypes",
                column: "CampusId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_CampusId",
                table: "AspNetUsers",
                column: "CampusId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Campuses_CampusId",
                table: "AspNetUsers",
                column: "CampusId",
                principalTable: "Campuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ScholarshipTypes_Campuses_CampusId",
                table: "ScholarshipTypes",
                column: "CampusId",
                principalTable: "Campuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Campuses_CampusId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_ScholarshipTypes_Campuses_CampusId",
                table: "ScholarshipTypes");

            migrationBuilder.DropIndex(
                name: "IX_ScholarshipTypes_CampusId",
                table: "ScholarshipTypes");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_CampusId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "CampusId",
                table: "ScholarshipTypes");

            migrationBuilder.DropColumn(
                name: "CampusId",
                table: "AspNetUsers");
        }
    }
}
