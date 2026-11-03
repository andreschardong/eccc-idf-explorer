using System.Text;
using Shouldly;

namespace EcccDataExplorer.Idf.Tests;

public class IdfArchiveReaderTests
{
    private readonly IdfArchiveReader reader = new(new IdfStationParser());

    [Fact]
    public async Task WhenPathIsFolderOfStationFiles_ShouldReadEachStation()
    {
        using var temp = new TempDirectory();
        File.Copy(TestData.FixturePath(TestData.Charlottetown), temp.Combine(TestData.Charlottetown));
        File.Copy(TestData.FixturePath(TestData.LakeCowichan), temp.Combine(TestData.LakeCowichan));

        var stations = await ReadAllAsync(temp.Path);

        stations.Select(station => station.ClimateId).ShouldBe(["1012055", "8300301"], ignoreOrder: true);
    }

    [Fact]
    public async Task WhenPathIsNestedBundle_ShouldReadStationsFromProvinceZips()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);

        var stations = await ReadAllAsync(bundle);

        stations.Select(station => station.ClimateId).ShouldBe(["1012055", "8300301"], ignoreOrder: true);
    }

    [Fact]
    public async Task WhenBundleHoldsAggregateTables_ShouldNotTreatThemAsStations()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);

        var stations = await ReadAllAsync(bundle);

        stations.Count.ShouldBe(2);
    }

    [Fact]
    public async Task WhenBundleHoldsAggregateTables_ShouldReturnTheFourTablesWeCheckAgainst()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);

        var tables = await reader.ReadAggregateTablesAsync(bundle, TestContext.Current.CancellationToken);

        tables.ReturnPeriodAmounts.ShouldBe("amounts");
        tables.ReturnPeriodRates.ShouldBe("rates");
        tables.ReturnPeriodConfidence.ShouldBe("confidence");
        tables.StationLog.ShouldBe("log");
    }

    [Fact]
    public async Task WhenBundleLacksAggregateTables_ShouldReturnNulls()
    {
        using var temp = new TempDirectory();
        File.Copy(TestData.FixturePath(TestData.Charlottetown), temp.Combine(TestData.Charlottetown));

        var tables = await reader.ReadAggregateTablesAsync(temp.Path, TestContext.Current.CancellationToken);

        tables.ShouldBe(new AggregateTables(null, null, null, null));
    }

    [Fact]
    public async Task WhenPathDoesNotExist_ShouldThrowFileNotFound()
    {
        await Should.ThrowAsync<FileNotFoundException>(() => ReadAllAsync("does-not-exist.zip"));
    }

    [Fact]
    public async Task WhenStationFileIsInvalid_ShouldThrowFormatExceptionNamingTheFile()
    {
        using var temp = new TempDirectory();
        var brokenName = "idf_v3-40_2025_12_5_830_PE_8300301_BROKEN.txt";
        await File.WriteAllTextAsync(temp.Combine(brokenName), "not an IDF file", Encoding.Latin1, TestContext.Current.CancellationToken);

        var exception = await Should.ThrowAsync<IdfFormatException>(() => ReadAllAsync(temp.Path));

        exception.SourceName.ShouldBe(brokenName);
    }

    [Fact]
    public async Task WhenReadingIsCancelled_ShouldStopWithOperationCancelled()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Should.ThrowAsync<OperationCanceledException>(async () =>
        {
            await foreach (var station in reader.ReadStationsAsync(bundle, cts.Token))
            {
                station.ShouldNotBeNull();
            }
        });
    }

    private async Task<List<IdfStation>> ReadAllAsync(string path)
    {
        var stations = new List<IdfStation>();
        await foreach (var station in reader.ReadStationsAsync(path, TestContext.Current.CancellationToken))
        {
            stations.Add(station);
        }

        return stations;
    }

    /// <summary>Builds the same shape as the ECCC download: bundle zip, province zip, "Additional" zip.</summary>
    private static string WriteBundle(TempDirectory temp)
    {
        var province = TempDirectory.Zip(
            ($"PE/{TestData.Charlottetown}", TestData.ReadBytes(TestData.Charlottetown)),
            ($"PE/{TestData.LakeCowichan}", TestData.ReadBytes(TestData.LakeCowichan)),
            ("PE/idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A.pdf", [1, 2, 3]));

        var additional = TempDirectory.Zip(
            ("idf_v3-40_2025_12_5_return_period_amounts.txt", Encoding.Latin1.GetBytes("amounts")),
            ("idf_v3-40_2025_12_5_return_period_rates.txt", Encoding.Latin1.GetBytes("rates")),
            ("idf_v3-40_2025_12_5_return_period_conf_interval.txt", Encoding.Latin1.GetBytes("confidence")),
            ("idf_v3-40_2025_12_5_log_included.txt", Encoding.Latin1.GetBytes("log")),
            ("idf_v3-40_2025_12_5_trends.txt", Encoding.Latin1.GetBytes("trends")),
            ("idfm0019.txt", Encoding.Latin1.GetBytes("legacy")));

        var bundle = TempDirectory.Zip(
            ("idf_v3-40_2025-12-5/IDF_Files_Fichiers/PE.zip", province),
            ("idf_v3-40_2025-12-5/IDF_Files_Fichiers/IDF_Additional_Additionnel_v3-40.zip", additional),
            ("idf_v3-40_2025-12-5/whats_new_IDF_v3-40.pdf", [4, 5, 6]));

        var path = temp.Combine("idf_v3-40_2025-12-5.zip");
        File.WriteAllBytes(path, bundle);
        return path;
    }
}
