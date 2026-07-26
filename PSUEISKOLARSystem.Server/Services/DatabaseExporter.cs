using System.Collections;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Writes a point-in-time snapshot of every mapped table to a ZIP of CSV files.
    /// <para>
    /// Deliberately portable rather than a native <c>BACKUP DATABASE</c>: that writes to the
    /// SQL Server host's own disk (unavailable on a managed instance, and not something the
    /// browser can download), whereas this streams straight to whoever clicked the button and
    /// opens in Excel. Restoring is an import job, not a one-click affair — see the README
    /// written into the archive.
    /// </para>
    /// </summary>
    public class DatabaseExporter(ApplicationDbContext db)
    {
        // Never leave the server: exporting these would turn a convenience download into a
        // credential leak. Everything else about the account is included.
        private static readonly HashSet<string> ExcludedColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "Value",
        };

        private static readonly MethodInfo SetMethod = typeof(DbContext)
            .GetMethods()
            .First(m => m.Name == nameof(DbContext.Set) && m.IsGenericMethod && m.GetParameters().Length == 0);

        private static readonly MethodInfo NoTrackingMethod = typeof(EntityFrameworkQueryableExtensions)
            .GetMethods()
            .First(m => m.Name == nameof(EntityFrameworkQueryableExtensions.AsNoTracking) && m.GetParameters().Length == 1);

        private static readonly MethodInfo ToListAsyncMethod = typeof(EntityFrameworkQueryableExtensions)
            .GetMethods()
            .First(m => m.Name == nameof(EntityFrameworkQueryableExtensions.ToListAsync) && m.GetParameters().Length == 2);

        public async Task<byte[]> CreateArchiveAsync(string requestedBy, CancellationToken ct = default)
        {
            using var buffer = new MemoryStream();

            using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
            {
                var manifest = new StringBuilder();
                manifest.AppendLine($"PSU e-Iskolar data export");
                manifest.AppendLine($"Taken:       {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
                manifest.AppendLine($"Requested by: {requestedBy}");
                manifest.AppendLine();
                manifest.AppendLine("One CSV per table, UTF-8 with a header row. Password hashes and");
                manifest.AppendLine("security stamps are excluded on purpose, so restoring from this archive");
                manifest.AppendLine("requires users to reset their passwords. For a byte-for-byte restore,");
                manifest.AppendLine("take a native SQL Server backup as described in DEPLOYMENT.md.");
                manifest.AppendLine();
                manifest.AppendLine("Tables");
                manifest.AppendLine("------");

                foreach (var entityType in db.Model.GetEntityTypes().OrderBy(e => e.GetTableName()))
                {
                    ct.ThrowIfCancellationRequested();

                    var tableName = entityType.GetTableName();
                    if (tableName is null || entityType.IsOwned()) continue;

                    var columns = entityType.GetProperties()
                        .Select(p => p.PropertyInfo)
                        .Where(p => p is not null && !ExcludedColumns.Contains(p.Name))
                        .Select(p => p!)
                        .ToList();
                    if (columns.Count == 0) continue;

                    var rows = await LoadRowsAsync(entityType.ClrType, ct);

                    var entry = zip.CreateEntry($"{tableName}.csv", CompressionLevel.Optimal);
                    await using (var writer = new StreamWriter(entry.Open(), new UTF8Encoding(true)))
                    {
                        await writer.WriteLineAsync(string.Join(',', columns.Select(c => Csv(c.Name))));
                        foreach (var row in rows)
                            await writer.WriteLineAsync(string.Join(',', columns.Select(c => Csv(Render(c.GetValue(row))))));
                    }

                    manifest.AppendLine($"{tableName,-40} {rows.Count,8} row(s)");
                }

                var readme = zip.CreateEntry("README.txt", CompressionLevel.Optimal);
                await using (var writer = new StreamWriter(readme.Open(), new UTF8Encoding(true)))
                    await writer.WriteAsync(manifest.ToString());
            }

            return buffer.ToArray();
        }

        // db.Set<T>().AsNoTracking().ToListAsync(ct), reached by reflection because the entity
        // type is only known at run time.
        private async Task<List<object>> LoadRowsAsync(Type clrType, CancellationToken ct)
        {
            var set = SetMethod.MakeGenericMethod(clrType).Invoke(db, null)!;
            var noTracking = NoTrackingMethod.MakeGenericMethod(clrType).Invoke(null, [set])!;

            var task = (Task)ToListAsyncMethod.MakeGenericMethod(clrType).Invoke(null, [noTracking, ct])!;
            await task;

            var rows = (IEnumerable)task.GetType().GetProperty("Result")!.GetValue(task)!;
            return rows.Cast<object>().ToList();
        }

        private static string? Render(object? value) => value switch
        {
            null => null,
            DateTime dt => dt.ToString("yyyy-MM-dd HH:mm:ss"),
            DateTimeOffset dto => dto.ToString("yyyy-MM-dd HH:mm:ss zzz"),
            bool b => b ? "TRUE" : "FALSE",
            byte[] bytes => $"<{bytes.Length} bytes>",
            IFormattable f => f.ToString(null, System.Globalization.CultureInfo.InvariantCulture),
            _ => value.ToString(),
        };

        private static string Csv(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            // Quote when the value could break the row, and double any embedded quotes.
            return value.IndexOfAny([',', '"', '\n', '\r']) >= 0
                ? $"\"{value.Replace("\"", "\"\"")}\""
                : value;
        }
    }
}
