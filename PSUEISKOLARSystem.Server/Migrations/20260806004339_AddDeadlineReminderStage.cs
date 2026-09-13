using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PSUEISKOLARSystem.Server.Migrations
{
    /// <summary>
    /// Turns the deadline reminder flag into a stage, so a deadline can escalate as its date
    /// closes in and report itself as missed once the date has passed. See
    /// <c>DeadlineReminderStage</c>.
    /// </summary>
    public partial class AddDeadlineReminderStage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReminderStage",
                table: "SubmissionDeadlines",
                type: "int",
                nullable: false,
                defaultValue: 0);

            /* Deadlines that already had their one reminder start at Approaching (1), not at
               None — otherwise the first sweep after this deploys re-sends the early warning
               to everyone who was reminded under the old scheme. They still escalate normally
               from there. Deadlines that were never reminded stay at 0 and, if their date has
               since passed, will send the missed notice they never got. */
            migrationBuilder.Sql(
                "UPDATE SubmissionDeadlines SET ReminderStage = 1 WHERE RemindersSentAt IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReminderStage",
                table: "SubmissionDeadlines");
        }
    }
}
