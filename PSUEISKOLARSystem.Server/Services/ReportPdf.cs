using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Print-ready PDF versions of the Excel exports (SRS: "e.g. PDF/Excel"), sharing one
    /// header/footer so a scholars report and a submissions report look like the same office
    /// produced them. Landscape A4, because both tables are wide.
    /// </summary>
    public static class ReportPdf
    {
        private const string PsuBlue = "#002570";
        private const string Ink = "#1f2937";
        private const string Muted = "#6b7280";
        private const string HeaderRow = "#eef2ff";
        private const string ZebraRow = "#f8fafc";
        private const string Green = "#065f46";
        private const string Red = "#991b1b";
        private const string Amber = "#92400e";

        public record Column(string Header, float Width);

        /// <summary>A single cell: its text plus the colour it should print in.</summary>
        public record Cell(string Text, string? Color = null, bool Bold = false);

        public static byte[] Build(string title, string subtitle, IReadOnlyList<Column> columns, IReadOnlyList<Cell[]> rows)
        {
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4.Landscape());
                    page.Margin(28);
                    page.DefaultTextStyle(t => t.FontSize(8).FontColor(Ink));

                    page.Header().Element(h => Header(h, title, subtitle, rows.Count));
                    page.Content().PaddingTop(10).Element(c => Table(c, columns, rows));
                    page.Footer().Element(Footer);
                });
            });

            return document.GeneratePdf();
        }

        private static void Header(IContainer container, string title, string subtitle, int rowCount)
        {
            container.Column(column =>
            {
                column.Item().Row(row =>
                {
                    row.RelativeItem().Column(left =>
                    {
                        left.Item().Text("Pangasinan State University — Lingayen Campus")
                            .FontSize(8).FontColor(Muted).LetterSpacing(0.08f);
                        left.Item().PaddingTop(2).Text(title)
                            .FontSize(16).SemiBold().FontColor(PsuBlue);
                        left.Item().Text(subtitle).FontSize(8).FontColor(Muted);
                    });

                    row.ConstantItem(150).AlignRight().Column(right =>
                    {
                        right.Item().AlignRight().Text("PSU e-Iskolar").FontSize(9).SemiBold().FontColor(PsuBlue);
                        right.Item().AlignRight().Text($"Generated {DateTime.UtcNow:MMM d, yyyy HH:mm} UTC")
                            .FontSize(7).FontColor(Muted);
                        right.Item().AlignRight().Text($"{rowCount:N0} record{(rowCount == 1 ? "" : "s")}")
                            .FontSize(7).FontColor(Muted);
                    });
                });

                column.Item().PaddingTop(6).LineHorizontal(1).LineColor(PsuBlue);
            });
        }

        private static void Table(IContainer container, IReadOnlyList<Column> columns, IReadOnlyList<Cell[]> rows)
        {
            if (rows.Count == 0)
            {
                container.PaddingTop(60).AlignCenter()
                    .Text("No records matched the selected filters.").FontSize(10).FontColor(Muted);
                return;
            }

            container.Table(table =>
            {
                table.ColumnsDefinition(definition =>
                {
                    foreach (var column in columns)
                        definition.RelativeColumn(column.Width);
                });

                table.Header(header =>
                {
                    foreach (var column in columns)
                        header.Cell().Background(HeaderRow).Padding(4)
                            .Text(column.Header).SemiBold().FontSize(8).FontColor(PsuBlue);
                });

                for (int i = 0; i < rows.Count; i++)
                {
                    var cells = rows[i];
                    // Zebra striping keeps a 12-column landscape table readable across a page.
                    string background = i % 2 == 1 ? ZebraRow : "#ffffff";

                    for (int c = 0; c < columns.Count; c++)
                    {
                        var cell = c < cells.Length ? cells[c] : new Cell("");
                        var text = table.Cell().Background(background)
                            .BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(4)
                            .Text(cell.Text).FontSize(7.5f);

                        if (cell.Color is not null) text = text.FontColor(cell.Color);
                        if (cell.Bold) text.SemiBold();
                    }
                }
            });
        }

        private static void Footer(IContainer container)
        {
            container.PaddingTop(6).BorderTop(0.5f).BorderColor("#e5e7eb").PaddingTop(4).Row(row =>
            {
                row.RelativeItem().Text("Confidential — contains personal data covered by RA 10173.")
                    .FontSize(7).FontColor(Muted);
                row.ConstantItem(90).AlignRight().Text(text =>
                {
                    text.DefaultTextStyle(t => t.FontSize(7).FontColor(Muted));
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        }

        public static string StatusColor(string status) => status switch
        {
            "Verified"   => Green,
            "Incomplete" => Red,
            _            => Amber,
        };

        public static string ComplianceColor(bool? meets) => meets switch
        {
            true  => Green,
            false => Red,
            null  => Muted,
        };
    }
}
