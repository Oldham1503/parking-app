using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;

namespace ParkingRegister.WinForms;

public static class XlsxExporter
{
    public static void Export(RegisterData data, string filePath)
    {
        using var archive = ZipFile.Open(filePath, ZipArchiveMode.Create);

        WriteEntry(archive, "[Content_Types].xml", ContentTypesXml());
        WriteEntry(archive, "_rels/.rels", PackageRelationshipsXml());
        WriteEntry(archive, "docProps/core.xml", CorePropertiesXml());
        WriteEntry(archive, "docProps/app.xml", AppPropertiesXml());
        WriteEntry(archive, "xl/workbook.xml", WorkbookXml());
        WriteEntry(archive, "xl/_rels/workbook.xml.rels", WorkbookRelationshipsXml());
        WriteEntry(archive, "xl/styles.xml", StylesXml());
        WriteEntry(archive, "xl/worksheets/sheet1.xml", SheetXml("Staff Parking History", StaffRows(data)));
        WriteEntry(archive, "xl/worksheets/sheet2.xml", SheetXml("Visitor History", VisitorRows(data)));
    }

    private static IEnumerable<string[]> StaffRows(RegisterData data)
    {
        yield return ["Bay", "Name", "Registration", "Time In", "Time Out", "Duration", "Status", "Created By", "Checked Out By", "Notes"];

        foreach (var session in data.StaffSessions.OrderByDescending(session => session.TimeIn))
        {
            yield return
            [
                session.BayNumber.ToString(CultureInfo.InvariantCulture),
                session.PersonName,
                session.CarRegistration,
                FormatDate(session.TimeIn),
                FormatDate(session.TimeOut),
                FormatDuration(session.TimeIn, session.TimeOut),
                session.Status,
                session.CreatedBy,
                session.CheckedOutBy ?? "",
                session.Notes
            ];
        }
    }

    private static IEnumerable<string[]> VisitorRows(RegisterData data)
    {
        yield return ["Visitor", "Company", "Visiting", "Registration", "Door Pass", "Bay", "Time In", "Time Out", "Duration", "Status", "Created By", "Signed Out By", "Notes"];

        foreach (var visitor in data.VisitorSessions.OrderByDescending(visitor => visitor.TimeIn))
        {
            yield return
            [
                visitor.VisitorName,
                visitor.CompanyName,
                visitor.Visiting,
                visitor.CarRegistration,
                visitor.DoorPassNumber,
                visitor.BayNumber?.ToString(CultureInfo.InvariantCulture) ?? "",
                FormatDate(visitor.TimeIn),
                FormatDate(visitor.TimeOut),
                FormatDuration(visitor.TimeIn, visitor.TimeOut),
                visitor.Status,
                visitor.CreatedBy,
                visitor.SignedOutBy ?? "",
                visitor.Notes
            ];
        }
    }

    private static string SheetXml(string sheetName, IEnumerable<string[]> rows)
    {
        var builder = new StringBuilder();

        using (var writer = XmlWriter.Create(builder, new XmlWriterSettings { OmitXmlDeclaration = true }))
        {
            writer.WriteStartDocument();
            writer.WriteStartElement("worksheet", "http://schemas.openxmlformats.org/spreadsheetml/2006/main");
            writer.WriteStartElement("sheetViews");
            writer.WriteStartElement("sheetView");
            writer.WriteAttributeString("workbookViewId", "0");
            writer.WriteEndElement();
            writer.WriteEndElement();
            writer.WriteStartElement("sheetData");

            var rowIndex = 1;
            foreach (var row in rows)
            {
                writer.WriteStartElement("row");
                writer.WriteAttributeString("r", rowIndex.ToString(CultureInfo.InvariantCulture));

                for (var columnIndex = 0; columnIndex < row.Length; columnIndex++)
                {
                    writer.WriteStartElement("c");
                    writer.WriteAttributeString("r", $"{ColumnName(columnIndex + 1)}{rowIndex}");
                    writer.WriteAttributeString("t", "inlineStr");
                    if (rowIndex == 1)
                    {
                        writer.WriteAttributeString("s", "1");
                    }

                    writer.WriteStartElement("is");
                    writer.WriteElementString("t", row[columnIndex]);
                    writer.WriteEndElement();
                    writer.WriteEndElement();
                }

                writer.WriteEndElement();
                rowIndex++;
            }

            writer.WriteEndElement();
            writer.WriteEndElement();
            writer.WriteEndDocument();
        }

        return builder.ToString();
    }

    private static string ColumnName(int columnNumber)
    {
        var dividend = columnNumber;
        var columnName = "";

        while (dividend > 0)
        {
            var modulo = (dividend - 1) % 26;
            columnName = Convert.ToChar('A' + modulo) + columnName;
            dividend = (dividend - modulo) / 26;
        }

        return columnName;
    }

    private static string FormatDate(DateTime? dateTime) =>
        dateTime.HasValue ? dateTime.Value.ToString("dd/MM/yyyy HH:mm", CultureInfo.GetCultureInfo("en-GB")) : "";

    private static string FormatDuration(DateTime start, DateTime? end)
    {
        var duration = (end ?? DateTime.Now) - start;
        if (duration < TimeSpan.Zero)
        {
            duration = TimeSpan.Zero;
        }

        return $"{(int)duration.TotalHours} hr {duration.Minutes} min";
    }

    private static void WriteEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content.TrimStart());
    }

    private static string ContentTypesXml() => """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
          <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
          <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
          <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
        </Types>
        """;

    private static string PackageRelationshipsXml() => """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
          <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
          <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
        </Relationships>
        """;

    private static string WorkbookXml() => """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets>
            <sheet name="Staff Parking History" sheetId="1" r:id="rId1"/>
            <sheet name="Visitor History" sheetId="2" r:id="rId2"/>
          </sheets>
        </workbook>
        """;

    private static string WorkbookRelationshipsXml() => """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
          <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
          <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        </Relationships>
        """;

    private static string StylesXml() => """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
          <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
          <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
          <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
        </styleSheet>
        """;

    private static string CorePropertiesXml() => $"""
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <dc:title>Parking Register History</dc:title>
          <dc:creator>C365Cloud Parking Register</dc:creator>
          <dcterms:created xsi:type="dcterms:W3CDTF">{DateTime.UtcNow:O}</dcterms:created>
        </cp:coreProperties>
        """;

    private static string AppPropertiesXml() => """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <Application>C365Cloud Parking Register</Application>
        </Properties>
        """;

}
