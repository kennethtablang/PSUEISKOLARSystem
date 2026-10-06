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

        /// <summary>A titled block of rows — one scholarship type in a categorised report.</summary>
        public record Group(string Heading, IReadOnlyList<Cell[]> Rows);

        /// <summary>
        /// A report split into sections, each with its own heading and table, so a master list
        /// covering several scholarships never mixes their scholars together.
        /// </summary>
        public static byte[] BuildGrouped(string title, string subtitle, IReadOnlyList<Column> columns, IReadOnlyList<Group> groups)
        {
            var total = groups.Sum(g => g.Rows.Count);
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4.Landscape());
                    page.Margin(28);
                    page.DefaultTextStyle(t => t.FontSize(8).FontColor(Ink));

                    page.Header().Element(h => Header(h, title, subtitle, total));
                    page.Content().PaddingTop(10).Column(col =>
                    {
                        if (groups.Count == 0)
                        {
                            col.Item().Element(c => Table(c, columns, []));
                            return;
                        }

                        for (int i = 0; i < groups.Count; i++)
                        {
                            var group = groups[i];
                            col.Item().PaddingTop(i == 0 ? 0 : 14).Row(row =>
                            {
                                row.RelativeItem().Text(group.Heading).FontSize(11).SemiBold().FontColor(PsuBlue);
                                row.ConstantItem(120).AlignRight().Text(
                                    $"{group.Rows.Count:N0} scholar{(group.Rows.Count == 1 ? "" : "s")}").FontSize(8).FontColor(Muted);
                            });
                            col.Item().PaddingTop(4).Element(c => Table(c, columns, group.Rows));
                        }
                    });
                    page.Footer().Element(Footer);
                });
            });

            return document.GeneratePdf();
        }

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

        /// <summary>
        /// The auto-generated summary: highlight sentences, then one small table per section.
        /// Portrait, because the tables are narrow and the report is meant to be read through.
        /// </summary>
        public static byte[] BuildSummary(SummaryReport.Result report)
        {
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(32);
                    page.DefaultTextStyle(t => t.FontSize(9).FontColor(Ink));

                    page.Header().Element(h => SummaryHeader(h, report.Title, report.Scope));
                    page.Content().PaddingTop(12).Column(col =>
                    {
                        col.Item().Background(HeaderRow).Padding(10).Column(box =>
                        {
                            box.Item().Text("Highlights").FontSize(11).SemiBold().FontColor(PsuBlue);
                            foreach (var line in report.Highlights)
                                box.Item().PaddingTop(4).Row(row =>
                                {
                                    row.ConstantItem(10).Text("•").FontColor(PsuBlue);
                                    row.RelativeItem().Text(line).FontSize(9);
                                });
                        });

                        foreach (var section in report.Sections)
                        {
                            col.Item().PaddingTop(14).ShowEntire().Column(block =>
                            {
                                block.Item().Text(section.Heading).FontSize(11).SemiBold().FontColor(PsuBlue);
                                block.Item().PaddingTop(4).Element(c => SummaryTable(c, section));
                                if (section.Note is not null)
                                    block.Item().PaddingTop(3).Text(section.Note).FontSize(8).Italic().FontColor(Muted);
                            });
                        }
                    });
                    page.Footer().Element(Footer);
                });
            });

            return document.GeneratePdf();
        }

        private static void SummaryHeader(IContainer container, string title, string scope)
        {
            container.Column(column =>
            {
                column.Item().Row(row =>
                {
                    row.RelativeItem().Column(left =>
                    {
                        left.Item().Text("Pangasinan State University").FontSize(8).FontColor(Muted).LetterSpacing(0.08f);
                        left.Item().PaddingTop(2).Text(title).FontSize(16).SemiBold().FontColor(PsuBlue);
                        left.Item().Text($"Scope: {scope}").FontSize(8).FontColor(Muted);
                    });
                    row.ConstantItem(150).AlignRight().Column(right =>
                    {
                        right.Item().AlignRight().Text("PSU e-Iskolar").FontSize(9).SemiBold().FontColor(PsuBlue);
                        right.Item().AlignRight().Text($"Generated {DateTime.UtcNow.AddHours(8):MMM d, yyyy h:mm tt} (PHT)")
                            .FontSize(7).FontColor(Muted);
                    });
                });
                column.Item().PaddingTop(6).LineHorizontal(1).LineColor(PsuBlue);
            });
        }

        private static void SummaryTable(IContainer container, SummaryReport.Section section)
        {
            if (section.Rows.Count == 0)
            {
                container.Padding(6).Text("Nothing to report yet.").FontSize(8.5f).Italic().FontColor(Muted);
                return;
            }

            container.Table(table =>
            {
                table.ColumnsDefinition(d =>
                {
                    foreach (var w in section.Widths) d.RelativeColumn(w);
                });
                table.Header(header =>
                {
                    for (int c = 0; c < section.Headers.Length; c++)
                    {
                        var cell = header.Cell().Background(HeaderRow).Padding(4);
                        (c == 0 ? cell : cell.AlignRight()).Text(section.Headers[c]).SemiBold().FontSize(8).FontColor(PsuBlue);
                    }
                });
                for (int i = 0; i < section.Rows.Count; i++)
                {
                    var bg = i % 2 == 1 ? ZebraRow : "#ffffff";
                    var row = section.Rows[i];
                    for (int c = 0; c < section.Headers.Length; c++)
                    {
                        var cell = table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(4);
                        (c == 0 ? cell : cell.AlignRight()).Text(c < row.Length ? row[c] : "").FontSize(8.5f);
                    }
                }
            });
        }

        private static void Header(IContainer container, string title, string subtitle, int rowCount)
        {
            container.Column(column =>
            {
                column.Item().Row(row =>
                {
                    row.RelativeItem().Column(left =>
                    {
                        left.Item().Text("Pangasinan State University")
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
            "Rejected" or "Incomplete" => Red,
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
