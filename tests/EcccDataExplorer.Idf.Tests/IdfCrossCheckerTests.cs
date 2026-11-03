using System.Globalization;
using System.Text;
using EcccDataExplorer.Idf.Verification;
using Shouldly;

namespace EcccDataExplorer.Idf.Tests;

public class IdfCrossCheckerTests
{
    private readonly IdfCrossChecker checker = new();

    [Fact]
    public void WhenTablesMatchTheStationFiles_ShouldReportClean()
    {
        var stations = Stations();

        var report = checker.Compare(stations, Tables(stations));

        report.IsClean.ShouldBeTrue(string.Join(Environment.NewLine, report.Problems));
        report.StationsChecked.ShouldBe(2);
        report.ValuesChecked.ShouldBeGreaterThan(2 * 63 * 3);
    }

    [Fact]
    public void WhenFlatTableHasTwoDecimals_ShouldAcceptRoundingDifferencesUpToHalfATenth()
    {
        var stations = Stations();
        var tables = Tables(stations) with
        {
            // 5.1 in the station file; the flat table prints 5.14.
            ReturnPeriodAmounts = Tables(stations).ReturnPeriodAmounts!.Replace("   5.10", "   5.14", StringComparison.Ordinal),
        };

        checker.Compare(stations, tables).IsClean.ShouldBeTrue();
    }

    [Fact]
    public void WhenOneValueDiffersMoreThanRounding_ShouldNameTheCell()
    {
        var stations = Stations();
        var tables = Tables(stations) with
        {
            ReturnPeriodAmounts = Tables(stations).ReturnPeriodAmounts!.Replace("   5.10", "   9.90", StringComparison.Ordinal),
        };

        var report = checker.Compare(stations, tables);

        report.IsClean.ShouldBeFalse();
        report.Problems.ShouldContain(problem => problem.Contains("amounts 8300301 5 min 2 yr", StringComparison.Ordinal));
    }

    [Fact]
    public void WhenMissingValueIsPresentInOnlyOneSource_ShouldReportIt()
    {
        var stations = Stations();
        var tables = Tables(stations) with
        {
            ReturnPeriodRates = Tables(stations).ReturnPeriodRates!.Replace("  60.80", " -99.90", StringComparison.Ordinal),
        };

        checker.Compare(stations, tables).Problems.ShouldContain(problem => problem.StartsWith("rates 8300301", StringComparison.Ordinal));
    }

    [Fact]
    public void WhenStationIsMissingFromATable_ShouldReportIt()
    {
        var stations = Stations();

        var report = checker.Compare(stations, Tables([stations[0]]));

        report.Problems.ShouldContain(problem => problem.Contains("1012055", StringComparison.Ordinal) && problem.Contains("missing from the table", StringComparison.Ordinal));
    }

    [Fact]
    public void WhenTheTableHasAStationWithoutAFile_ShouldReportIt()
    {
        var stations = Stations();

        var report = checker.Compare([stations[0]], Tables(stations));

        report.Problems.ShouldContain(problem => problem.Contains("no station file was read", StringComparison.Ordinal));
    }

    [Fact]
    public void WhenALogNameIsCutOffAtFortyCharacters_ShouldAcceptIt()
    {
        var stations = Stations();
        var longName = "ESKASONI FIRST NATION AUTOMATIC WEATHER STATION";
        stations[0] = stations[0] with { Name = longName };

        var report = checker.Compare(stations, Tables(stations));

        report.IsClean.ShouldBeTrue(string.Join(Environment.NewLine, report.Problems));
    }

    [Fact]
    public void WhenTheLogDisagreesOnTheYearRange_ShouldReportIt()
    {
        var stations = Stations();
        var tables = Tables(stations) with
        {
            StationLog = Tables(stations).StationLog!.Replace("      1967,", "      1966,", StringComparison.Ordinal),
        };

        checker.Compare(stations, tables).Problems.ShouldContain(problem => problem.Contains("first year", StringComparison.Ordinal));
    }

    [Fact]
    public void WhenATableIsAbsent_ShouldSayWhichOne()
    {
        var stations = Stations();
        var tables = Tables(stations) with { ReturnPeriodConfidence = null };

        checker.Compare(stations, tables).Problems.ShouldContain("confidence: table not found in the download.");
    }

    private static List<IdfStation> Stations() =>
        [TestData.Parse(TestData.Charlottetown), TestData.Parse(TestData.LakeCowichan)];

    /// <summary>Renders stations the way ECCC's flat tables do: comma separated, two decimals, -99.90 for missing.</summary>
    private static AggregateTables Tables(IReadOnlyList<IdfStation> stations) =>
        new(
            FlatGrid(stations, station => station.ReturnPeriods.DepthsMm),
            FlatGrid(stations, station => station.ReturnPeriods.RatesMmPerHour),
            FlatGrid(stations, station => station.ReturnPeriods.RateConfidenceMmPerHour),
            Log(stations));

    private static string FlatGrid(
        IReadOnlyList<IdfStation> stations,
        Func<IdfStation, IReadOnlyList<IReadOnlyList<double?>>> select)
    {
        var reference = stations[0];
        var builder = new StringBuilder("         ID");
        foreach (var duration in reference.DurationsMinutes)
        {
            foreach (var period in reference.ReturnPeriodsYears)
            {
                var unit = duration % 60 == 0 ? $"{duration / 60}h" : $"{duration}m";
                builder.Append(CultureInfo.InvariantCulture, $",{unit}:{period}");
            }
        }

        builder.AppendLine();
        foreach (var station in stations)
        {
            builder.Append(CultureInfo.InvariantCulture, $"{station.ClimateId,11}");
            foreach (var row in select(station))
            {
                foreach (var value in row)
                {
                    builder.Append(',').Append((value ?? -99.9).ToString("F2", CultureInfo.InvariantCulture).PadLeft(8));
                }
            }

            builder.AppendLine();
        }

        return builder.ToString();
    }

    private static string Log(IReadOnlyList<IdfStation> stations)
    {
        var builder = new StringBuilder(" Index,        ID,        Lat,        Lon,    Elv-Alt,    Yr1-An1,YrEnd-AnFin,    Yrs-Ans,Name-Nom                                ,Prov ,Fit-Courbe");
        builder.AppendLine();
        var index = 1;
        foreach (var station in stations)
        {
            var name = station.Name.Length > 40 ? station.Name[..40] : station.Name;
            builder.Append(CultureInfo.InvariantCulture, $"{index++,-6},{station.ClimateId,11},{station.Latitude,11:F2},{station.Longitude,11:F2},{station.ElevationMetres,11:F0},{station.FirstYear,11},{station.LastYear,11},{station.YearsOfData,11},{name,-40},{station.Province,-5},Lin");
            builder.AppendLine();
        }

        return builder.ToString();
    }
}
