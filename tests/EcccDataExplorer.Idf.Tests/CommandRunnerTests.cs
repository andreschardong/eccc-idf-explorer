using EcccDataExplorer.Cli;
using EcccDataExplorer.Idf.SiteData;
using EcccDataExplorer.Idf.Verification;
using NSubstitute;
using Shouldly;

namespace EcccDataExplorer.Idf.Tests;

public sealed class CommandRunnerTests : IDisposable
{
    private readonly IIdfArchiveReader reader = Substitute.For<IIdfArchiveReader>();
    private readonly IIdfCrossChecker checker = Substitute.For<IIdfCrossChecker>();
    private readonly ISiteDataWriter writer = Substitute.For<ISiteDataWriter>();
    private readonly StringWriter output = new();
    private readonly StringWriter error = new();
    private readonly CommandRunner runner;

    public CommandRunnerTests()
    {
        reader.ReadStationsAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(_ => ToAsync(TestData.Parse(TestData.Charlottetown)));
        reader.ReadAggregateTablesAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new AggregateTables("a", "r", "c", "l"));
        checker.Compare(Arg.Any<IReadOnlyCollection<IdfStation>>(), Arg.Any<AggregateTables>())
            .Returns(new CrossCheckReport(1, 63, []));
        writer.WriteAsync(Arg.Any<IReadOnlyCollection<IdfStation>>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new DatasetInfo("3.40", new DateOnly(2025, 12, 5), 2016, 1, "Gumbel", "src", "OGL", "url"));

        reader.ExtractOfficialFilesAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new OfficialFilesResult("3.40", 751, 6759, 7, 693_000_000));

        runner = new CommandRunner(reader, checker, writer, output, error);
    }

    public void Dispose()
    {
        output.Dispose();
        error.Dispose();
    }

    [Fact]
    public async Task WhenNoArgumentsAreGiven_ShouldPrintUsageAndReturnTwo()
    {
        var code = await runner.RunAsync([], TestContext.Current.CancellationToken);

        code.ShouldBe(2);
        output.ToString().ShouldContain("Usage:");
    }

    [Fact]
    public async Task WhenHelpIsRequested_ShouldPrintUsageAndReturnZero()
    {
        var code = await runner.RunAsync(["--help"], TestContext.Current.CancellationToken);

        code.ShouldBe(0);
        output.ToString().ShouldContain("build-site-data");
    }

    [Fact]
    public async Task WhenCommandIsUnknown_ShouldReturnTwoAndSayWhy()
    {
        var code = await runner.RunAsync(["frobnicate"], TestContext.Current.CancellationToken);

        code.ShouldBe(2);
        error.ToString().ShouldContain("Unrecognised arguments");
    }

    [Fact]
    public async Task WhenVerifyAgrees_ShouldReturnZeroAndWriteNothing()
    {
        var code = await runner.RunAsync(["verify", "bundle.zip"], TestContext.Current.CancellationToken);

        code.ShouldBe(0);
        output.ToString().ShouldContain("Cross-check clean");
        await writer.DidNotReceiveWithAnyArgs().WriteAsync(default!, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task WhenVerifyFindsProblems_ShouldListThemAndReturnOne()
    {
        checker.Compare(Arg.Any<IReadOnlyCollection<IdfStation>>(), Arg.Any<AggregateTables>())
            .Returns(new CrossCheckReport(1, 63, ["amounts 8300301 5 min 2 yr: station file 5.1, table 9.9."]));

        var code = await runner.RunAsync(["verify", "bundle.zip"], TestContext.Current.CancellationToken);

        code.ShouldBe(1);
        error.ToString().ShouldContain("amounts 8300301 5 min 2 yr");
    }

    [Fact]
    public async Task WhenBuildSucceeds_ShouldWriteSiteDataAndReturnZero()
    {
        var code = await runner.RunAsync(["build-site-data", "bundle.zip", "out"], TestContext.Current.CancellationToken);

        code.ShouldBe(0);
        await writer.Received(1).WriteAsync(Arg.Any<IReadOnlyCollection<IdfStation>>(), "out", Arg.Any<CancellationToken>());
        output.ToString().ShouldContain("release 3.40");
    }

    [Fact]
    public async Task WhenBuildCrossCheckFails_ShouldWriteNothingAndReturnOne()
    {
        checker.Compare(Arg.Any<IReadOnlyCollection<IdfStation>>(), Arg.Any<AggregateTables>())
            .Returns(new CrossCheckReport(1, 63, ["problem"]));

        var code = await runner.RunAsync(["build-site-data", "bundle.zip", "out"], TestContext.Current.CancellationToken);

        code.ShouldBe(1);
        await writer.DidNotReceiveWithAnyArgs().WriteAsync(default!, default!, TestContext.Current.CancellationToken);
        error.ToString().ShouldContain("nothing was written");
    }

    [Fact]
    public async Task WhenSkipVerifyIsGiven_ShouldBuildWithoutCrossChecking()
    {
        var code = await runner.RunAsync(["build-site-data", "province.zip", "out", "--skip-verify"], TestContext.Current.CancellationToken);

        code.ShouldBe(0);
        checker.DidNotReceiveWithAnyArgs().Compare(default!, default!);
        await writer.Received(1).WriteAsync(Arg.Any<IReadOnlyCollection<IdfStation>>(), "out", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WhenExtractIsRequested_ShouldUnpackTheReleaseAndReportCounts()
    {
        var code = await runner.RunAsync(["extract-official-files", "bundle.zip", "out"], TestContext.Current.CancellationToken);

        code.ShouldBe(0);
        await reader.Received(1).ExtractOfficialFilesAsync("bundle.zip", "out", Arg.Any<CancellationToken>());
        output.ToString().ShouldContain("Unpacked release 3.40");
        output.ToString().ShouldContain("751 stations");
        await writer.DidNotReceiveWithAnyArgs().WriteAsync(default!, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task WhenMoreThanTwentyFiveProblemsExist_ShouldTruncateTheList()
    {
        var problems = Enumerable.Range(1, 40).Select(n => $"problem {n}").ToList();
        checker.Compare(Arg.Any<IReadOnlyCollection<IdfStation>>(), Arg.Any<AggregateTables>())
            .Returns(new CrossCheckReport(1, 63, problems));

        await runner.RunAsync(["verify", "bundle.zip"], TestContext.Current.CancellationToken);

        error.ToString().ShouldContain("and 15 more");
        error.ToString().ShouldNotContain("problem 26");
    }

    private static async IAsyncEnumerable<IdfStation> ToAsync(params IdfStation[] stations)
    {
        foreach (var station in stations)
        {
            yield return station;
        }

        await Task.CompletedTask;
    }
}
