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

    [Fact]
    public async Task WhenBundleIsExtracted_ShouldWriteStationFilesUnderClimateIdFolders()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);
        var output = temp.Combine("out");

        await reader.ExtractOfficialFilesAsync(bundle, output, TestContext.Current.CancellationToken);

        File.Exists(Path.Combine(output, "v3.40", "stations", "8300301", TestData.Charlottetown)).ShouldBeTrue();
        File.Exists(Path.Combine(output, "v3.40", "stations", "8300301", "idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A.pdf")).ShouldBeTrue();
        File.Exists(Path.Combine(output, "v3.40", "stations", "1012055", TestData.LakeCowichan)).ShouldBeTrue();
    }

    [Fact]
    public async Task WhenBundleIsExtracted_ShouldKeepEveryFileByteForByte()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);
        var output = temp.Combine("out");

        await reader.ExtractOfficialFilesAsync(bundle, output, TestContext.Current.CancellationToken);

        var text = await File.ReadAllBytesAsync(Path.Combine(output, "v3.40", "stations", "8300301", TestData.Charlottetown), TestContext.Current.CancellationToken);
        text.ShouldBe(TestData.ReadBytes(TestData.Charlottetown));
        var pdf = await File.ReadAllBytesAsync(Path.Combine(output, "v3.40", "stations", "8300301", "idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A.pdf"), TestContext.Current.CancellationToken);
        pdf.ShouldBe([1, 2, 3]);
    }

    [Fact]
    public async Task WhenBundleIsExtracted_ShouldPutReleaseLevelFilesUnderRelease()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);
        var output = temp.Combine("out");

        await reader.ExtractOfficialFilesAsync(bundle, output, TestContext.Current.CancellationToken);

        var release = Path.Combine(output, "v3.40", "release");
        File.Exists(Path.Combine(release, "whats_new_IDF_v3-40.pdf")).ShouldBeTrue();
        File.Exists(Path.Combine(release, "idf_v3-40_2025_12_5_return_period_amounts.txt")).ShouldBeTrue();
        File.Exists(Path.Combine(release, "idfm0019.txt")).ShouldBeTrue();
    }

    [Fact]
    public async Task WhenBundleIsExtracted_ShouldReportWhatWasWritten()
    {
        using var temp = new TempDirectory();
        var bundle = WriteBundle(temp);

        var result = await reader.ExtractOfficialFilesAsync(bundle, temp.Combine("out"), TestContext.Current.CancellationToken);

        result.Release.ShouldBe("3.40");
        result.Stations.ShouldBe(2);
        result.StationFiles.ShouldBe(3);
        result.ReleaseFiles.ShouldBe(7);
        result.Bytes.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task WhenNoStationFileExists_ShouldThrowFormatExceptionWhenExtracting()
    {
        using var temp = new TempDirectory();
        await File.WriteAllTextAsync(temp.Combine("notes.txt"), "not a station", TestContext.Current.CancellationToken);

        await Should.ThrowAsync<IdfFormatException>(() =>
            reader.ExtractOfficialFilesAsync(temp.Path, temp.Combine("out"), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task WhenExtractingPathDoesNotExist_ShouldThrowFileNotFound()
    {
        using var temp = new TempDirectory();

        await Should.ThrowAsync<FileNotFoundException>(() =>
            reader.ExtractOfficialFilesAsync("does-not-exist.zip", temp.Combine("out"), TestContext.Current.CancellationToken));
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
