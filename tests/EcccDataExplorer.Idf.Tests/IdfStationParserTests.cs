using Shouldly;

namespace EcccDataExplorer.Idf.Tests;

public class IdfStationParserTests
{
    private readonly IdfStationParser parser = new();

    [Fact]
    public void WhenFileIsCompositeStation_ShouldReadHeader()
    {
        var station = TestData.Parse(TestData.Charlottetown);

        station.ClimateId.ShouldBe("8300301");
        station.Name.ShouldBe("CHARLOTTETOWN A");
        station.Province.ShouldBe("PE");
        station.IsComposite.ShouldBeTrue();
        station.Latitude.ShouldBe(46.2833, 0.0001);
        station.Longitude.ShouldBe(-63.1167, 0.0001);
        station.ElevationMetres.ShouldBe(50);
        station.FirstYear.ShouldBe(1967);
        station.LastYear.ShouldBe(2016);
        station.YearsOfData.ShouldBe(31);
        station.Method.ShouldBe("Gumbel - Method of moments");
        station.ProcessingDate.ShouldBe(new DateOnly(2025, 12, 5));
        station.ReleaseVersion.ShouldBe("3.40");
    }

    [Fact]
    public void WhenFileIsNotComposite_ShouldFlagItAsSingleStation()
    {
        TestData.Parse(TestData.LakeCowichan).IsComposite.ShouldBeFalse();
    }

    [Fact]
    public void WhenFileIsParsed_ShouldReadNineDurationsAndSevenReturnPeriods()
    {
        var station = TestData.Parse(TestData.Charlottetown);

        station.DurationsMinutes.ShouldBe([5, 10, 15, 30, 60, 120, 360, 720, 1440]);
        station.ReturnPeriodsYears.ShouldBe([2, 5, 10, 25, 50, 100, 200]);
    }

    [Fact]
    public void WhenTableOneIsRead_ShouldReturnOneRowPerYearWithData()
    {
        var station = TestData.Parse(TestData.Charlottetown);

        station.AnnualMaxima.Count.ShouldBe(32);
        station.AnnualMaxima[0].Year.ShouldBe(1967);
        station.AnnualMaxima[0].DepthsMm.ShouldBe([7.1, 10.9, 12.2, 21.3, 32.0, 51.8, 76.7, 97.5, 100.8]);
        station.AnnualMaxima[^1].Year.ShouldBe(2016);
    }

    [Fact]
    public void WhenAnnualMaximaAreMissing_ShouldReturnNullForThoseDurations()
    {
        var station = TestData.Parse(TestData.Charlottetown);

        var year2007 = station.AnnualMaxima.Single(row => row.Year == 2007);

        year2007.DepthsMm.Take(6).ShouldAllBe(value => value == null);
        year2007.DepthsMm[6].ShouldBe(40.0);
    }

    [Fact]
    public void WhenTableOneStatisticsAreRead_ShouldReturnPerDurationSummary()
    {
        var summary = TestData.Parse(TestData.Charlottetown).AnnualMaximumSummary;

        summary.SampleSizes.ShouldBe([31, 31, 31, 31, 31, 31, 32, 32, 32]);
        summary.Mean[0].ShouldBe(5.5);
        summary.StandardDeviation[8].ShouldBe(20.5);
        summary.Skewness[0].ShouldBe(1.25);
        summary.Kurtosis[5].ShouldBe(4.53);
    }

    [Fact]
    public void WhenTableTwoIsRead_ShouldReturnDepthsRatesAndConfidenceByDurationThenPeriod()
    {
        var tables = TestData.Parse(TestData.Charlottetown).ReturnPeriods;

        tables.DepthsMm[0][0].ShouldBe(5.1);
        tables.DepthsMm[8][6].ShouldBe(139.3);
        tables.RatesMmPerHour[0][0].ShouldBe(60.8);
        tables.RatesMmPerHour[4][5].ShouldBe(40.5);
        tables.RateConfidenceMmPerHour[0][0].ShouldBe(10.2);
        tables.RateConfidenceMmPerHour[8][6].ShouldBe(1.3);
        tables.SampleYears.ShouldBe([31, 31, 31, 31, 31, 31, 32, 32, 32]);
    }

    [Fact]
    public void WhenTableThreeIsRead_ShouldReturnPowerLawFitPerReturnPeriod()
    {
        var fit = TestData.Parse(TestData.Charlottetown).Interpolation;

        fit.Coefficient[0].ShouldBe(17.4);
        fit.Exponent[0].ShouldBe(-0.551);
        fit.Exponent[6].ShouldBe(-0.580);
        fit.StandardError[1].ShouldBe(2.9);
        fit.MeanPercentError[0].ShouldBe(7.4);
        fit.MeanOfRates[6].ShouldBe(63.5);
        fit.StandardDeviationOfRates[6].ShouldBe(58.9);
    }

    [Fact]
    public void WhenDurationsWereNotAnalysed_ShouldReturnNullsAndZeroSampleYears()
    {
        var station = TestData.Parse(TestData.LakeCowichan);
        var tables = station.ReturnPeriods;

        tables.DepthsMm[0].ShouldAllBe(value => value == null);
        tables.RatesMmPerHour[3].ShouldAllBe(value => value == null);
        tables.RateConfidenceMmPerHour[0].ShouldAllBe(value => value == null);
        tables.SampleYears.Take(4).ShouldAllBe(years => years == 0);
        tables.DepthsMm[4][0].ShouldBe(11.6);
    }

    [Fact]
    public void WhenStatisticsOverflow_ShouldReturnNullsInPlaceOfStarsAndNaN()
    {
        var summary = TestData.Parse(TestData.SteFoyMatapedia).AnnualMaximumSummary;

        summary.Skewness.Count.ShouldBe(9);
        summary.Skewness.Take(4).ShouldAllBe(value => value == null);
        summary.Skewness[4].ShouldBe(1.41);
        summary.Kurtosis.Count.ShouldBe(9);
        summary.Kurtosis.Take(4).ShouldAllBe(value => value == null);
        summary.Kurtosis[4].ShouldBe(7.03);
        summary.Mean[0].ShouldBe(5.7);
    }

    [Fact]
    public void WhenFileHasWarningBlockInsideTableOne_ShouldNotReadItAsAnnualMaxima()
    {
        var station = TestData.Parse(TestData.Coronation);

        var years = station.AnnualMaxima.Select(row => row.Year).ToList();
        years.ShouldBe(years.Distinct().Order().ToList());
        station.AnnualMaxima.ShouldAllBe(row => row.DepthsMm.Count == 9);
        years[^1].ShouldBe(2024);
    }

    [Fact]
    public void WhenSectionIsMissing_ShouldThrowFormatExceptionNamingTheSection()
    {
        var text = TestData.ReadText(TestData.Charlottetown).Replace("Table 3 :", "Tabulation 3 :", StringComparison.Ordinal);

        var exception = Should.Throw<IdfFormatException>(() => parser.Parse(text, "broken.txt"));

        exception.Message.ShouldContain("Table 3");
        exception.SourceName.ShouldBe("broken.txt");
    }

    [Fact]
    public void WhenRowHasTooFewValues_ShouldThrowFormatExceptionNamingTheFile()
    {
        var text = TestData.ReadText(TestData.Charlottetown)
            .Replace("1967    7.1   10.9   12.2   21.3   32.0   51.8   76.7   97.5  100.8", "1967    7.1   10.9", StringComparison.Ordinal);

        var exception = Should.Throw<IdfFormatException>(() => parser.Parse(text, "short-row.txt"));

        exception.Message.ShouldStartWith("short-row.txt:");
        exception.Message.ShouldContain("1967");
    }

    [Fact]
    public void WhenTextIsNotAnIdfFile_ShouldThrowFormatException()
    {
        Should.Throw<IdfFormatException>(() => parser.Parse("hello", "hello.txt"));
    }

    [Fact]
    public void WhenSourceNameIsBlank_ShouldThrowArgumentException()
    {
        Should.Throw<ArgumentException>(() => parser.Parse("text", " "));
    }

    [Fact]
    public void WhenFileNameCarriesNoRelease_ShouldLeaveReleaseVersionNull()
    {
        var station = parser.Parse(TestData.ReadText(TestData.Charlottetown), "charlottetown.txt");

        station.ReleaseVersion.ShouldBeNull();
    }

    [Fact]
    public void WhenFileNameIsEccc_ShouldExposeTheFileStemWithoutExtension()
    {
        var station = TestData.Parse(TestData.Charlottetown);

        station.OfficialFileStem.ShouldBe("idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A");
    }

    [Fact]
    public void WhenFileNameIsNotEccc_ShouldLeaveTheFileStemNull()
    {
        var station = parser.Parse(TestData.ReadText(TestData.Charlottetown), "charlottetown.txt");

        station.OfficialFileStem.ShouldBeNull();
    }
}
