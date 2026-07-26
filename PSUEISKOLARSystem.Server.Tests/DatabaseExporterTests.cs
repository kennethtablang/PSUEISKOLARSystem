using System.IO.Compression;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// Covers the one-click data export. The exporter walks the EF model by reflection, so a
// model change can only break it at run time — these tests are the safety net for that.
public class DatabaseExporterTests
{
    // Entries are named after the mapped table. Resolving that through the model rather than
    // hard-coding it keeps the assertions honest across providers (the in-memory provider
    // reports the entity name where SQL Server reports the real table name).
    private static string Csv<T>(ApplicationDbContext db) =>
        $"{db.Model.FindEntityType(typeof(T))!.GetTableName()}.csv";

    private static async Task<ZipArchive> ExportAsync(ApplicationDbContext db)
    {
        await db.SaveChangesAsync();
        var bytes = await new DatabaseExporter(db).CreateArchiveAsync("tester@psu.edu.ph");
        return new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
    }

    private static string Read(ZipArchive zip, string entryName)
    {
        var entry = zip.GetEntry(entryName);
        Assert.NotNull(entry);
        using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static string[] Lines(string csv) => csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

    [Fact]
    public async Task The_archive_holds_a_csv_per_table_plus_a_readme()
    {
        using var db = TestDb.New();
        db.AddType(1, "CHED Scholarship");
        using var zip = await ExportAsync(db);

        Assert.NotNull(zip.GetEntry("README.txt"));
        Assert.NotNull(zip.GetEntry(Csv<ScholarshipType>(db)));
        Assert.NotNull(zip.GetEntry(Csv<ApplicationUser>(db)));
        Assert.NotNull(zip.GetEntry(Csv<ScholarProfile>(db)));
        Assert.NotNull(zip.GetEntry(Csv<DocumentSubmission>(db)));
    }

    [Fact]
    public async Task Rows_are_written_under_a_header_row()
    {
        using var db = TestDb.New();
        db.AddType(7, "DOST-SEI Scholarship");
        using var zip = await ExportAsync(db);

        var lines = Lines(Read(zip, Csv<ScholarshipType>(db)));

        Assert.Contains("Name", lines[0]);
        Assert.Contains("SlotLimit", lines[0]);
        Assert.Contains("DOST-SEI Scholarship", lines[1]);
    }

    [Fact]
    public async Task Password_hashes_and_security_stamps_never_leave_the_server()
    {
        using var db = TestDb.New();
        var user = db.AddScholar("s1");
        user.PasswordHash = "SUPER-SECRET-HASH";
        user.SecurityStamp = "SUPER-SECRET-STAMP";
        using var zip = await ExportAsync(db);

        var csv = Read(zip, Csv<ApplicationUser>(db));

        Assert.DoesNotContain("PasswordHash", csv);
        Assert.DoesNotContain("SUPER-SECRET-HASH", csv);
        Assert.DoesNotContain("SUPER-SECRET-STAMP", csv);
        Assert.Contains("s1@t", csv);   // the rest of the account is still there
    }

    [Fact]
    public async Task Values_containing_commas_quotes_or_newlines_are_escaped()
    {
        using var db = TestDb.New();
        db.AddType(1, "Type").Description = "Comma, \"quoted\", and\nnewline";
        using var zip = await ExportAsync(db);

        var csv = Read(zip, Csv<ScholarshipType>(db));

        // One quoted field, with the inner quotes doubled per RFC 4180.
        Assert.Contains("\"Comma, \"\"quoted\"\", and\nnewline\"", csv);
        // Header + a row that spans two physical lines because of the embedded newline.
        Assert.Equal(3, Lines(csv).Length);
    }

    [Fact]
    public async Task The_readme_records_who_asked_and_lists_row_counts()
    {
        using var db = TestDb.New();
        db.AddType(1, "A");
        db.AddType(2, "B");
        using var zip = await ExportAsync(db);

        var readme = Read(zip, "README.txt");

        Assert.Contains("tester@psu.edu.ph", readme);
        Assert.Contains("2 row(s)", readme);
        Assert.Contains("Password hashes", readme);   // the exclusion is documented, not silent
    }

    [Fact]
    public async Task An_empty_table_still_gets_a_csv_with_its_header()
    {
        using var db = TestDb.New();
        using var zip = await ExportAsync(db);

        var csv = Read(zip, Csv<OneTimeGrant>(db));

        Assert.Contains("Amount", csv);
        Assert.Single(Lines(csv));
    }

    [Fact]
    public async Task Enums_and_dates_are_rendered_readably()
    {
        using var db = TestDb.New();
        db.AddScholar("s1");
        db.AddRequirement(1, "COR");
        db.AddSubmission("s1", 1, DocumentStatus.Verified);
        using var zip = await ExportAsync(db);

        var csv = Read(zip, Csv<DocumentSubmission>(db));

        Assert.Contains("Verified", csv);                             // enum by name, not ordinal
        Assert.Matches(@"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", csv);  // sortable timestamps
    }
}
