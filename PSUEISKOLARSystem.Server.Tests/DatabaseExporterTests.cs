using System.IO.Compression;
using System.Text;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// Covers the one-click data export. The exporter walks the EF model by reflection, so a
// model change can only break it at run time — these tests are the safety net for that.
public class DatabaseExporterTests
{
    private static async Task<ZipArchive> ExportAsync(Action<Data.ApplicationDbContext> seed)
    {
        using var db = TestDb.New();
        seed(db);
        await db.SaveChangesAsync();

        var bytes = await new DatabaseExporter(db).CreateArchiveAsync("tester@psu.edu.ph");
        return new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
    }

    private static string ReadEntry(ZipArchive zip, string name)
    {
        using var reader = new StreamReader(zip.GetEntry(name)!.Open(), Encoding.UTF8);
        return reader.ReadToEnd();
    }

    [Fact]
    public async Task The_archive_holds_a_csv_per_table_plus_a_readme()
    {
        using var zip = await ExportAsync(db => db.AddType(1, "CHED Scholarship"));

        Assert.NotNull(zip.GetEntry("README.txt"));
        Assert.NotNull(zip.GetEntry("ScholarshipTypes.csv"));
        Assert.NotNull(zip.GetEntry("AspNetUsers.csv"));
        Assert.NotNull(zip.GetEntry("ScholarProfiles.csv"));
    }

    [Fact]
    public async Task Rows_are_written_under_a_header_row()
    {
        using var zip = await ExportAsync(db => db.AddType(7, "DOST-SEI Scholarship"));

        var lines = ReadEntry(zip, "ScholarshipTypes.csv")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Contains("Name", lines[0]);
        Assert.Contains("SlotLimit", lines[0]);
        Assert.Contains("DOST-SEI Scholarship", lines[1]);
    }

    [Fact]
    public async Task Password_hashes_and_security_stamps_never_leave_the_server()
    {
        using var zip = await ExportAsync(db =>
        {
            var user = db.AddScholar("s1");
            user.PasswordHash = "SUPER-SECRET-HASH";
            user.SecurityStamp = "SUPER-SECRET-STAMP";
        });

        var csv = ReadEntry(zip, "AspNetUsers.csv");

        Assert.DoesNotContain("PasswordHash", csv);
        Assert.DoesNotContain("SUPER-SECRET-HASH", csv);
        Assert.DoesNotContain("SUPER-SECRET-STAMP", csv);
        // The rest of the account is still there.
        Assert.Contains("s1@t", csv);
    }

    [Fact]
    public async Task Values_containing_commas_quotes_or_newlines_are_escaped()
    {
        using var zip = await ExportAsync(db =>
            db.AddType(1, "Type").Description = "Comma, \"quoted\", and\nnewline");

        var csv = ReadEntry(zip, "ScholarshipTypes.csv");

        // Escaped as a single quoted field with doubled inner quotes.
        Assert.Contains("\"Comma, \"\"quoted\"\", and\nnewline\"", csv);
        // Header + a row that spans two physical lines because of the embedded newline.
        Assert.Equal(3, csv.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length);
    }

    [Fact]
    public async Task The_readme_records_who_asked_and_lists_row_counts()
    {
        using var zip = await ExportAsync(db =>
        {
            db.AddType(1, "A");
            db.AddType(2, "B");
        });

        var readme = ReadEntry(zip, "README.txt");

        Assert.Contains("tester@psu.edu.ph", readme);
        Assert.Contains("ScholarshipTypes", readme);
        Assert.Contains("2 row(s)", readme);
        // The exclusion is documented, not silent.
        Assert.Contains("Password hashes", readme);
    }

    [Fact]
    public async Task An_empty_table_still_gets_a_csv_with_its_header()
    {
        using var zip = await ExportAsync(_ => { });

        var csv = ReadEntry(zip, "OneTimeGrants.csv");

        Assert.Contains("Amount", csv);
        Assert.Single(csv.Split('\n', StringSplitOptions.RemoveEmptyEntries));
    }

    [Fact]
    public async Task Enums_dates_and_bools_are_rendered_readably()
    {
        using var zip = await ExportAsync(db =>
        {
            db.AddScholar("s1");
            db.AddRequirement(1, "COR");
            db.AddSubmission("s1", 1, DocumentStatus.Verified);
        });

        var csv = ReadEntry(zip, "DocumentSubmissions.csv");

        Assert.Contains("Verified", csv);          // enum by name, not ordinal
        Assert.Matches(@"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", csv); // sortable timestamps
    }
}
