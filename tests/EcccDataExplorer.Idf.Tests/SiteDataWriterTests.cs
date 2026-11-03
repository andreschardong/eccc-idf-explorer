using System.Text.Json;
using EcccDataExplorer.Idf.SiteData;
using Shouldly;

namespace EcccDataExplorer.Idf.Tests;

public class SiteDataWriterTests
{
    private readonly SiteDataWriter writer = new();

    [Fact]
    public async Task WhenStationsAreWritten_ShouldCreateDatasetIndexAndOneFilePerStation()
    {
        using var temp = new TempDirectory();
        var stations = Stations();

        var info = await writer.WriteAsync(stations, temp.Path, TestContext.Current.CancellationToken);

        File.Exists(temp.Combine("dataset.json")).ShouldBeTrue();
        File.Exists(temp.Combine("stations.json")).ShouldBeTrue();
        File.Exists(temp.Combine("stations", "8300301.json")).ShouldBeTrue();
        File.Exists(temp.Combine("stations", "1012055.json")).ShouldBeTrue();
        info.Release.ShouldBe("3.40");
        info.StationCount.ShouldBe(2);
        info.LatestYear.ShouldBe(2016);
        info.ProcessingDate.ShouldBe(new DateOnly(2025, 12, 5));
    }

    [Fact]
    public async Task WhenIndexIsWritten_ShouldListStationsByClimateIdWithHundredYearDepths()
    {
        using var temp = new TempDirectory();

        await writer.WriteAsync(Stations(), temp.Path, TestContext.Current.CancellationToken);

        using var index = JsonDocument.Parse(await File.ReadAllTextAsync(temp.Combine("stations.json"), TestContext.Current.CancellationToken));
        var rows = index.RootElement.EnumerateArray().ToList();
        rows.Select(row => row.GetProperty("id").GetString()).ShouldBe(["1012055", "8300301"]);

        var charlottetown = rows[1];
        charlottetown.GetProperty("name").GetString().ShouldBe("CHARLOTTETOWN A");
        charlottetown.GetProperty("province").GetString().ShouldBe("PE");
        charlottetown.GetProperty("years").GetInt32().ShouldBe(31);
        charlottetown.GetProperty("depth100Yr1h").GetDouble().ShouldBe(40.5);
        charlottetown.GetProperty("depth100Yr24h").GetDouble().ShouldBe(128.1);
    }

    [Fact]
    public async Task WhenStationIsWritten_ShouldKeepMissingValuesAsNull()
    {
        using var temp = new TempDirectory();

        await writer.WriteAsync(Stations(), temp.Path, TestContext.Current.CancellationToken);

        using var detail = JsonDocument.Parse(await File.ReadAllTextAsync(temp.Combine("stations", "1012055.json"), TestContext.Current.CancellationToken));
        var root = detail.RootElement;
        root.GetProperty("depths")[0][0].ValueKind.ShouldBe(JsonValueKind.Null);
        root.GetProperty("depths")[4][0].GetDouble().ShouldBe(11.6);
        root.GetProperty("sampleYears")[0].GetInt32().ShouldBe(0);
        root.GetProperty("durations").GetArrayLength().ShouldBe(9);
        root.GetProperty("returnPeriods").GetArrayLength().ShouldBe(7);
        root.GetProperty("annualMaxYears").GetArrayLength().ShouldBe(root.GetProperty("annualMaxDepths").GetArrayLength());
    }

    [Fact]
    public async Task WhenWrittenTwice_ShouldProduceIdenticalBytes()
    {
        using var first = new TempDirectory();
        using var second = new TempDirectory();

        await writer.WriteAsync(Stations(), first.Path, TestContext.Current.CancellationToken);
        await writer.WriteAsync([.. Enumerable.Reverse(Stations())], second.Path, TestContext.Current.CancellationToken);

        foreach (var relative in new[] { "dataset.json", "stations.json", Path.Combine("stations", "8300301.json") })
        {
            File.ReadAllBytes(first.Combine(relative)).ShouldBe(File.ReadAllBytes(second.Combine(relative)));
        }
    }

    [Fact]
    public async Task WhenStaleStationFileExists_ShouldRemoveIt()
    {
        using var temp = new TempDirectory();
        Directory.CreateDirectory(temp.Combine("stations"));
        var stale = temp.Combine("stations", "9999999.json");
        await File.WriteAllTextAsync(stale, "{}", TestContext.Current.CancellationToken);

        await writer.WriteAsync(Stations(), temp.Path, TestContext.Current.CancellationToken);

        File.Exists(stale).ShouldBeFalse();
    }

    [Fact]
    public async Task WhenStationsMixReleases_ShouldThrowInvalidOperation()
    {
        using var temp = new TempDirectory();
        var older = TestData.Parse(TestData.Charlottetown) with { ReleaseVersion = "3.30" };

        await Should.ThrowAsync<InvalidOperationException>(() =>
            writer.WriteAsync([older, TestData.Parse(TestData.LakeCowichan)], temp.Path, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task WhenClimateIdIsDuplicated_ShouldThrowInvalidOperation()
    {
        using var temp = new TempDirectory();
        var station = TestData.Parse(TestData.Charlottetown);

        var exception = await Should.ThrowAsync<InvalidOperationException>(() =>
            writer.WriteAsync([station, station], temp.Path, TestContext.Current.CancellationToken));

        exception.Message.ShouldContain("8300301");
    }

    private static List<IdfStation> Stations() =>
        [TestData.Parse(TestData.Charlottetown), TestData.Parse(TestData.LakeCowichan)];
}
