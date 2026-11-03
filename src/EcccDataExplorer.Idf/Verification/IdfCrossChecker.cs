using System.Globalization;
using System.Text.RegularExpressions;

namespace EcccDataExplorer.Idf.Verification;

/// <inheritdoc />
public sealed partial class IdfCrossChecker : IIdfCrossChecker
{
    private const double MissingMarker = -99.9;

    // Station files print one decimal and the flat tables two, so a correctly read value can differ by 0.05.
    private const double RoundingTolerance = 0.0501;

    // The log gives coordinates to two decimals; the station files give whole minutes (0.0167 degrees).
    private const double CoordinateTolerance = 0.02;

    private const int LogNameWidth = 40;

    public CrossCheckReport Compare(IReadOnlyCollection<IdfStation> stations, AggregateTables tables)
    {
        ArgumentNullException.ThrowIfNull(stations);
        ArgumentNullException.ThrowIfNull(tables);

        var problems = new List<string>();
        var byId = stations.ToDictionary(station => station.ClimateId, StringComparer.Ordinal);
        var values = 0;
        HashSet<string>? reference = null;

        void CheckGrid(string? text, string label, Func<IdfStation, IReadOnlyList<IReadOnlyList<double?>>> select)
        {
            if (text is null)
            {
                problems.Add($"{label}: table not found in the download.");
                return;
            }

            var table = ReadTable(text);
            reference ??= [.. table.Rows.Keys];
            CompareStationSets(label, byId.Keys, table.Rows.Keys, problems);

            if (table.Header[0] != "ID")
            {
                throw new IdfFormatException($"The {label} table should start with the ID column.");
            }

            var columns = table.Header.Skip(1).Select(ParseColumn).ToList();
            foreach (var (id, cells) in table.Rows)
            {
                if (!byId.TryGetValue(id, out var station))
                {
                    continue;
                }

                var grid = select(station);
                for (var c = 0; c < columns.Count; c++)
                {
                    var column = columns[c];
                    var d = station.DurationsMinutes.ToList().IndexOf(column.Minutes);
                    var p = station.ReturnPeriodsYears.ToList().IndexOf(column.Years);
                    if (d < 0 || p < 0)
                    {
                        problems.Add($"{label} {id}: no {column.Minutes} min / {column.Years} yr cell in the station file.");
                        continue;
                    }

                    values++;
                    var expected = ToNullable(cells[c + 1]);
                    var actual = grid[d][p];
                    if (!Agree(expected, actual))
                    {
                        problems.Add($"{label} {id} {column.Minutes} min {column.Years} yr: station file {Show(actual)}, table {Show(expected)}.");
                    }
                }
            }
        }

        CheckGrid(tables.ReturnPeriodAmounts, "amounts", station => station.ReturnPeriods.DepthsMm);
        CheckGrid(tables.ReturnPeriodRates, "rates", station => station.ReturnPeriods.RatesMmPerHour);
        CheckGrid(tables.ReturnPeriodConfidence, "confidence", station => station.ReturnPeriods.RateConfidenceMmPerHour);

        if (tables.StationLog is { } log)
        {
            values += CheckLog(log, byId, problems);
        }
        else
        {
            problems.Add("log: table not found in the download.");
        }

        var checkedStations = reference is null ? 0 : reference.Count(byId.ContainsKey);
        return new CrossCheckReport(checkedStations, values, problems);
    }

    private static int CheckLog(string text, Dictionary<string, IdfStation> byId, List<string> problems)
    {
        var table = ReadTable(text);
        CompareStationSets("log", byId.Keys, table.Rows.Keys, problems);

        var index = table.Header
            .Select((name, position) => (name, position))
            .ToDictionary(pair => pair.name, pair => pair.position, StringComparer.Ordinal);
        var checkedValues = 0;

        foreach (var (id, cells) in table.Rows)
        {
            if (!byId.TryGetValue(id, out var station))
            {
                continue;
            }

            string Cell(string column) => cells[index[column]];

            void Expect(string what, bool agrees, string station_, string log_)
            {
                checkedValues++;
                if (!agrees)
                {
                    problems.Add($"log {id} {what}: station file {station_}, log {log_}.");
                }
            }

            Expect("name", NamesAgree(station.Name, Cell("Name-Nom")), station.Name, Cell("Name-Nom"));
            Expect("province", station.Province == Cell("Prov"), station.Province, Cell("Prov"));
            Expect("first year", station.FirstYear == ToInt(Cell("Yr1-An1")), station.FirstYear.ToString(CultureInfo.InvariantCulture), Cell("Yr1-An1"));
            Expect("last year", station.LastYear == ToInt(Cell("YrEnd-AnFin")), station.LastYear.ToString(CultureInfo.InvariantCulture), Cell("YrEnd-AnFin"));
            Expect("years of data", station.YearsOfData == ToInt(Cell("Yrs-Ans")), station.YearsOfData.ToString(CultureInfo.InvariantCulture), Cell("Yrs-Ans"));
            Expect("latitude", Math.Abs(station.Latitude - ToDouble(Cell("Lat"))) <= CoordinateTolerance, station.Latitude.ToString(CultureInfo.InvariantCulture), Cell("Lat"));
            Expect("longitude", Math.Abs(station.Longitude - ToDouble(Cell("Lon"))) <= CoordinateTolerance, station.Longitude.ToString(CultureInfo.InvariantCulture), Cell("Lon"));
            Expect("elevation", station.ElevationMetres is { } elevation && Math.Abs(elevation - ToDouble(Cell("Elv-Alt"))) < 0.5, station.ElevationMetres?.ToString(CultureInfo.InvariantCulture) ?? "none", Cell("Elv-Alt"));
        }

        return checkedValues;
    }

    private static void CompareStationSets(
        string label,
        IEnumerable<string> parsed,
        IEnumerable<string> table,
        List<string> problems)
    {
        var parsedSet = new HashSet<string>(parsed, StringComparer.Ordinal);
        var tableSet = new HashSet<string>(table, StringComparer.Ordinal);

        foreach (var id in parsedSet.Except(tableSet).Order(StringComparer.Ordinal))
        {
            problems.Add($"{label} {id}: parsed from a station file but missing from the table.");
        }

        foreach (var id in tableSet.Except(parsedSet).Order(StringComparer.Ordinal))
        {
            problems.Add($"{label} {id}: in the table but no station file was read.");
        }
    }

    // The log's name column is 40 characters wide and cuts longer names off.
    private static bool NamesAgree(string stationName, string logName)
    {
        var cutOff = stationName.Length > LogNameWidth ? stationName[..LogNameWidth].TrimEnd() : stationName;
        return string.Equals(cutOff, logName, StringComparison.OrdinalIgnoreCase);
    }

    private static bool Agree(double? expected, double? actual) =>
        expected is null || actual is null
            ? expected is null && actual is null
            : Math.Abs(expected.Value - actual.Value) <= RoundingTolerance;

    private static string Show(double? value) => value is { } v ? v.ToString("0.##", CultureInfo.InvariantCulture) : "missing";

    private static double? ToNullable(string cell)
    {
        var value = ToDouble(cell);
        return Math.Abs(value - MissingMarker) < 0.05 ? null : value;
    }

    private static double ToDouble(string cell) => double.Parse(cell, NumberStyles.Float, CultureInfo.InvariantCulture);

    private static int ToInt(string cell) => int.Parse(cell, NumberStyles.Integer, CultureInfo.InvariantCulture);

    private static Column ParseColumn(string name)
    {
        var match = ColumnRegex().Match(name);
        if (!match.Success)
        {
            throw new IdfFormatException($"Unrecognised column '{name}' in an ECCC aggregate table.");
        }

        var amount = int.Parse(match.Groups["amount"].Value, CultureInfo.InvariantCulture);
        return new Column(
            match.Groups["unit"].Value == "h" ? amount * 60 : amount,
            int.Parse(match.Groups["years"].Value, CultureInfo.InvariantCulture));
    }

    private static Table ReadTable(string text)
    {
        var lines = text.ReplaceLineEndings("\n").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (lines.Length == 0)
        {
            throw new IdfFormatException("An ECCC aggregate table is empty.");
        }

        var header = lines[0].Split(',').Select(cell => cell.Trim()).ToArray();
        var idColumn = Array.IndexOf(header, "ID");
        if (idColumn < 0)
        {
            throw new IdfFormatException("An ECCC aggregate table has no ID column.");
        }

        var rows = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var line in lines.Skip(1))
        {
            var cells = line.Split(',').Select(cell => cell.Trim()).ToArray();
            if (cells.Length != header.Length)
            {
                throw new IdfFormatException($"Aggregate table row has {cells.Length} cells, expected {header.Length}: {line[..Math.Min(line.Length, 40)]}");
            }

            rows[cells[idColumn]] = cells;
        }

        return new Table(header, rows);
    }

    [GeneratedRegex(@"^(?<amount>\d+)(?<unit>m|h):(?<years>\d+)$")]
    private static partial Regex ColumnRegex();

    private readonly record struct Column(int Minutes, int Years);

    private sealed record Table(string[] Header, Dictionary<string, string[]> Rows);
}
