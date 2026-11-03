using System.Globalization;
using System.Text.RegularExpressions;

namespace EcccDataExplorer.Idf;

/// <summary>
/// Parses ECCC IDF v3.x station files. The files are fixed-width text with four tables;
/// the parser reads each table by its labels rather than by column offsets, so it tolerates
/// the overflow stars and <c>NaN</c> cells that ECCC prints for a handful of statistics.
/// </summary>
public sealed partial class IdfStationParser : IIdfStationParser
{
    private const double MissingMarker = -99.9;
    private const double MissingTolerance = 0.05;

    // Table 1 statistics are printed in 7-character fields; a run of stars stands for one or
    // more fields whose number did not fit, so L stars means ceil(L / 7) missing values.
    private const int StatisticFieldWidth = 7;

    public IdfStation Parse(string text, string sourceName)
    {
        ArgumentNullException.ThrowIfNull(text);
        ArgumentException.ThrowIfNullOrWhiteSpace(sourceName);

        var lines = text.ReplaceLineEndings("\n").Split('\n');

        var table1 = FindTable(lines, "Table 1", sourceName);
        var table2a = FindTable(lines, "Table 2a", sourceName);
        var table2b = FindTable(lines, "Table 2b", sourceName);
        var table3 = FindTable(lines, "Table 3", sourceName);

        var header = ParseHeader(lines[..table1], sourceName);
        var (durations, annualMaxima, summary) = ParseAnnualMaxima(lines[table1..table2a], sourceName);
        var (periods, depths, sampleYears) = ParseDepths(lines[table2a..table2b], durations, sourceName);
        var (rates, confidence) = ParseRates(lines[table2b..table3], durations, periods.Count, sourceName);
        var fit = ParseInterpolation(lines[table3..], periods.Count, sourceName);

        return new IdfStation
        {
            ClimateId = header.ClimateId,
            Name = header.Name,
            Province = header.Province,
            IsComposite = header.IsComposite,
            Latitude = header.Latitude,
            Longitude = header.Longitude,
            ElevationMetres = header.ElevationMetres,
            FirstYear = header.FirstYear,
            LastYear = header.LastYear,
            YearsOfData = header.YearsOfData,
            Method = header.Method,
            ProcessingDate = header.ProcessingDate,
            ReleaseVersion = ReleaseFromFileName(sourceName),
            DurationsMinutes = durations,
            ReturnPeriodsYears = periods,
            AnnualMaxima = annualMaxima,
            AnnualMaximumSummary = summary,
            ReturnPeriods = new ReturnPeriodTables
            {
                DepthsMm = depths,
                RatesMmPerHour = rates,
                RateConfidenceMmPerHour = confidence,
                SampleYears = sampleYears,
            },
            Interpolation = fit,
        };
    }

    private static int FindTable(string[] lines, string title, string sourceName)
    {
        var index = Array.FindIndex(lines, line => line.StartsWith(title, StringComparison.Ordinal));
        return index >= 0
            ? index
            : throw new IdfFormatException(sourceName, $"'{title}' section not found.");
    }

    private static Header ParseHeader(string[] lines, string sourceName)
    {
        var stationIndex = Array.FindIndex(lines, line => StationLineRegex().IsMatch(line));
        if (stationIndex < 0)
        {
            throw new IdfFormatException(sourceName, "Station line (name, province, climate ID) not found.");
        }

        var station = StationLineRegex().Match(lines[stationIndex]);
        var isComposite = lines.Skip(stationIndex + 1)
            .Any(line => line.Trim().Equals("(composite)", StringComparison.OrdinalIgnoreCase));

        var position = Required(lines, PositionRegex(), "Latitude/Longitude line", sourceName);
        var latitude = ToDecimalDegrees(position, "lat", "latm", "ns", 'S');
        var longitude = ToDecimalDegrees(position, "lon", "lonm", "ew", 'W');
        double? elevation = position.Groups["elev"].Success
            ? ParseDouble(position.Groups["elev"].Value)
            : null;

        var years = Required(lines, YearsRegex(), "Years line", sourceName);

        var dateIndex = Array.FindIndex(lines, line => DateRegex().IsMatch(line));
        if (dateIndex < 0)
        {
            throw new IdfFormatException(sourceName, "Processing date line not found.");
        }

        var date = DateRegex().Match(lines[dateIndex]);
        var processingDate = new DateOnly(
            int.Parse(date.Groups["y"].Value, CultureInfo.InvariantCulture),
            int.Parse(date.Groups["m"].Value, CultureInfo.InvariantCulture),
            int.Parse(date.Groups["d"].Value, CultureInfo.InvariantCulture));

        var methodLine = lines[..dateIndex].LastOrDefault(line => !string.IsNullOrWhiteSpace(line))
            ?? throw new IdfFormatException(sourceName, "Method line not found.");
        var method = methodLine.Split('/')[0].Trim();

        return new Header(
            station.Groups["id"].Value,
            station.Groups["name"].Value.Trim(),
            station.Groups["prov"].Value,
            isComposite,
            Math.Round(latitude, 4),
            Math.Round(longitude, 4),
            elevation,
            int.Parse(years.Groups["first"].Value, CultureInfo.InvariantCulture),
            int.Parse(years.Groups["last"].Value, CultureInfo.InvariantCulture),
            int.Parse(years.Groups["count"].Value, CultureInfo.InvariantCulture),
            method,
            processingDate);
    }

    private static (List<int> Durations, List<AnnualMaximumRow> Rows, AnnualMaximumSummary Summary) ParseAnnualMaxima(
        string[] section,
        string sourceName)
    {
        var headerIndex = Array.FindIndex(section, line => TableOneHeaderRegex().IsMatch(line));
        if (headerIndex < 0)
        {
            throw new IdfFormatException(sourceName, "Table 1 column header not found.");
        }

        // Year rows end at the dashed separator; what follows holds the statistics and, in many files,
        // a "Warning: annual maximum amount greater than 100-yr return period amount" block whose
        // lines also begin with a year and must not be read as data.
        var separatorIndex = Array.FindIndex(section, headerIndex, line => SeparatorRegex().IsMatch(line));
        if (separatorIndex < 0)
        {
            throw new IdfFormatException(sourceName, "Table 1 separator line (-----) not found.");
        }

        var durations = DurationRegex().Matches(section[headerIndex]).Select(ToMinutes).ToList();
        var statistics = section[separatorIndex..];

        var rows = new List<AnnualMaximumRow>();
        foreach (var line in section[(headerIndex + 1)..separatorIndex])
        {
            var match = YearRowRegex().Match(line);
            if (!match.Success)
            {
                continue;
            }

            var values = ReadValues(match.Groups["rest"].Value);
            Require(values.Count == durations.Count, sourceName, $"Table 1 row for {match.Groups["year"].Value} has {values.Count} values, expected {durations.Count}.");
            rows.Add(new AnnualMaximumRow(int.Parse(match.Groups["year"].Value, CultureInfo.InvariantCulture), values));
        }

        var summary = new AnnualMaximumSummary
        {
            SampleSizes = ReadStatistic(statistics, "# Yrs.", durations.Count, sourceName)
                .Select(value => value is { } count ? (int?)(int)count : null)
                .ToList(),
            Mean = ReadStatistic(statistics, "Mean", durations.Count, sourceName),
            StandardDeviation = ReadStatistic(statistics, "Std. Dev.", durations.Count, sourceName),
            Skewness = ReadStatistic(statistics, "Skew.", durations.Count, sourceName),
            Kurtosis = ReadStatistic(statistics, "Kurtosis", durations.Count, sourceName),
        };

        return (durations, rows, summary);
    }

    private static (List<int> Periods, List<IReadOnlyList<double?>> Depths, List<int> SampleYears) ParseDepths(
        string[] section,
        List<int> durations,
        string sourceName)
    {
        var periods = ReadReturnPeriods(section, sourceName);
        var byDuration = new Dictionary<int, (IReadOnlyList<double?> Values, int Years)>();

        foreach (var line in section)
        {
            var match = DurationRowRegex().Match(line);
            if (!match.Success)
            {
                continue;
            }

            var values = ReadValues(match.Groups["rest"].Value);
            Require(values.Count == periods.Count + 1, sourceName, $"Table 2a row '{match.Groups["label"].Value.Trim()}' has {values.Count} values, expected {periods.Count + 1}.");
            byDuration[ToMinutes(match)] = (values[..periods.Count], (int)(values[^1] ?? 0));
        }

        var depths = new List<IReadOnlyList<double?>>();
        var sampleYears = new List<int>();
        foreach (var duration in durations)
        {
            if (!byDuration.TryGetValue(duration, out var row))
            {
                throw new IdfFormatException(sourceName, $"Table 2a has no row for {duration} minutes.");
            }

            depths.Add(row.Values);
            sampleYears.Add(row.Years);
        }

        return (periods, depths, sampleYears);
    }

    private static (List<IReadOnlyList<double?>> Rates, List<IReadOnlyList<double?>> Confidence) ParseRates(
        string[] section,
        List<int> durations,
        int periodCount,
        string sourceName)
    {
        var rates = new Dictionary<int, IReadOnlyList<double?>>();
        var confidence = new Dictionary<int, IReadOnlyList<double?>>();
        int? current = null;

        foreach (var line in section)
        {
            var match = DurationRowRegex().Match(line);
            if (match.Success)
            {
                var values = ReadValues(match.Groups["rest"].Value);
                Require(values.Count == periodCount + 1, sourceName, $"Table 2b row '{match.Groups["label"].Value.Trim()}' has {values.Count} values, expected {periodCount + 1}.");
                current = ToMinutes(match);
                rates[current.Value] = values[..periodCount];
            }
            else if (line.Contains("+/-", StringComparison.Ordinal) && current is { } duration)
            {
                var values = ReadValues(line.Replace("+/-", " ", StringComparison.Ordinal));
                Require(values.Count == periodCount + 1, sourceName, $"Table 2b confidence row for {duration} minutes has {values.Count} values, expected {periodCount + 1}.");
                confidence[duration] = values[..periodCount];
            }
        }

        var orderedRates = new List<IReadOnlyList<double?>>();
        var orderedConfidence = new List<IReadOnlyList<double?>>();
        foreach (var duration in durations)
        {
            orderedRates.Add(rates.TryGetValue(duration, out var rate)
                ? rate
                : throw new IdfFormatException(sourceName, $"Table 2b has no row for {duration} minutes."));
            orderedConfidence.Add(confidence.TryGetValue(duration, out var interval)
                ? interval
                : throw new IdfFormatException(sourceName, $"Table 2b has no confidence row for {duration} minutes."));
        }

        return (orderedRates, orderedConfidence);
    }

    private static InterpolationFit ParseInterpolation(string[] section, int periodCount, string sourceName) =>
        new()
        {
            MeanOfRates = ReadStatistic(section, "Mean of RR", periodCount, sourceName),
            StandardDeviationOfRates = ReadStatistic(section, "Std. Dev.", periodCount, sourceName),
            StandardError = ReadStatistic(section, "Std. Error", periodCount, sourceName),
            Coefficient = ReadStatistic(section, "Coefficient (A)", periodCount, sourceName),
            Exponent = ReadStatistic(section, "Exponent", periodCount, sourceName),
            MeanPercentError = ReadStatistic(section, "Mean % Error", periodCount, sourceName),
        };

    private static List<int> ReadReturnPeriods(string[] section, string sourceName)
    {
        var header = section.FirstOrDefault(line => line.Contains("Duration/Dur", StringComparison.Ordinal))
            ?? throw new IdfFormatException(sourceName, "Return-period header not found.");
        var periods = IntegerRegex().Matches(header)
            .Select(match => int.Parse(match.Value, CultureInfo.InvariantCulture))
            .ToList();
        Require(periods.Count > 0, sourceName, "Return-period header lists no periods.");
        return periods;
    }

    private static List<double?> ReadStatistic(string[] section, string label, int expected, string sourceName)
    {
        var line = section.FirstOrDefault(candidate => candidate.TrimStart().StartsWith(label, StringComparison.Ordinal))
            ?? throw new IdfFormatException(sourceName, $"Row '{label}' not found.");
        var remainder = line.TrimStart()[label.Length..];
        var values = ReadValues(remainder);
        Require(values.Count == expected, sourceName, $"Row '{label}' has {values.Count} values, expected {expected}.");
        return values;
    }

    private static List<double?> ReadValues(string text)
    {
        var values = new List<double?>();
        foreach (Match token in ValueRegex().Matches(text))
        {
            var raw = token.Value;
            if (raw[0] == '*')
            {
                var fields = (raw.Length + StatisticFieldWidth - 1) / StatisticFieldWidth;
                values.AddRange(Enumerable.Repeat<double?>(null, fields));
            }
            else if (raw.EndsWith("NaN", StringComparison.OrdinalIgnoreCase))
            {
                values.Add(null);
            }
            else
            {
                var number = ParseDouble(raw);
                values.Add(Math.Abs(number - MissingMarker) < MissingTolerance ? null : number);
            }
        }

        return values;
    }

    private static double ToDecimalDegrees(Match match, string degrees, string minutes, string hemisphere, char negative)
    {
        var value = int.Parse(match.Groups[degrees].Value, CultureInfo.InvariantCulture)
            + (int.Parse(match.Groups[minutes].Value, CultureInfo.InvariantCulture) / 60.0);
        return match.Groups[hemisphere].Value[0] == negative ? -value : value;
    }

    private static int ToMinutes(Match match)
    {
        var amount = int.Parse(match.Groups["amount"].Value, CultureInfo.InvariantCulture);
        return match.Groups["unit"].Value == "h" ? amount * 60 : amount;
    }

    private static string? ReleaseFromFileName(string sourceName) =>
        ReleaseRegex().Match(sourceName) is { Success: true } match
            ? $"{match.Groups["major"].Value}.{match.Groups["minor"].Value}"
            : null;

    private static double ParseDouble(string text) => double.Parse(text, NumberStyles.Float, CultureInfo.InvariantCulture);

    private static Match Required(string[] lines, Regex pattern, string what, string sourceName)
    {
        foreach (var line in lines)
        {
            var match = pattern.Match(line);
            if (match.Success)
            {
                return match;
            }
        }

        throw new IdfFormatException(sourceName, $"{what} not found.");
    }

    private static void Require(bool condition, string sourceName, string message)
    {
        if (!condition)
        {
            throw new IdfFormatException(sourceName, message);
        }
    }

    private sealed record Header(
        string ClimateId,
        string Name,
        string Province,
        bool IsComposite,
        double Latitude,
        double Longitude,
        double? ElevationMetres,
        int FirstYear,
        int LastYear,
        int YearsOfData,
        string Method,
        DateOnly ProcessingDate);

    [GeneratedRegex(@"^\s*(?<name>\S.*?)\s{2,}(?<prov>[A-Z]{2})\s+(?<id>[0-9A-Z]{7})\s*$")]
    private static partial Regex StationLineRegex();

    [GeneratedRegex(@"Latitude:\s*(?<lat>\d+)\s+(?<latm>\d+)'\s*(?<ns>[NS])\s+Longitude:\s*(?<lon>\d+)\s+(?<lonm>\d+)'\s*(?<ew>[EW])(?:\s+Elevation/Altitude:\s*(?<elev>-?\d+(?:\.\d+)?)\s*m)?")]
    private static partial Regex PositionRegex();

    [GeneratedRegex(@"Years/Ann\S*\s*:\s*(?<first>\d{4})\s*-\s*(?<last>\d{4})\s+#\s*Years/Ann\S*\s*:\s*(?<count>\d+)")]
    private static partial Regex YearsRegex();

    [GeneratedRegex(@"^\s*(?<y>\d{4})/(?<m>\d{1,2})/(?<d>\d{1,2})\s*$")]
    private static partial Regex DateRegex();

    [GeneratedRegex(@"^\s*Year\s+\d+\s*(min|h)\b")]
    private static partial Regex TableOneHeaderRegex();

    [GeneratedRegex(@"^\s*-{10,}\s*$")]
    private static partial Regex SeparatorRegex();

    [GeneratedRegex(@"(?<amount>\d+)\s*(?<unit>min|h)\b")]
    private static partial Regex DurationRegex();

    [GeneratedRegex(@"^\s*(?<year>\d{4})\s+(?<rest>.+)$")]
    private static partial Regex YearRowRegex();

    [GeneratedRegex(@"^\s*(?<label>(?<amount>\d+)\s*(?<unit>min|h))\s+(?<rest>.+)$")]
    private static partial Regex DurationRowRegex();

    [GeneratedRegex(@"idf_v(?<major>\d+)-(?<minor>\d+)_")]
    private static partial Regex ReleaseRegex();

    [GeneratedRegex(@"\d+")]
    private static partial Regex IntegerRegex();

    [GeneratedRegex(@"\*+|[+-]?NaN|-?\d+(?:\.\d+)?")]
    private static partial Regex ValueRegex();
}
