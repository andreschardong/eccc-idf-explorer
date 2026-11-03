using EcccDataExplorer.Idf;
using EcccDataExplorer.Idf.SiteData;
using EcccDataExplorer.Idf.Verification;

namespace EcccDataExplorer.Cli;

/// <summary>Dispatches the <c>eccc-idf</c> sub-commands and prints their results.</summary>
public sealed class CommandRunner(
    IIdfArchiveReader reader,
    IIdfCrossChecker crossChecker,
    ISiteDataWriter writer,
    TextWriter output,
    TextWriter error)
{
    private const int ProblemsShown = 25;

    private const string Usage = """
        eccc-idf - read the ECCC rainfall IDF release (v3.x) and publish it as static JSON.

        Usage:
          eccc-idf build-site-data <input> <output-dir> [--skip-verify]
          eccc-idf verify <input>
          eccc-idf extract-official-files <input> <output-dir>

        <input> is the ECCC download: the full bundle zip (idf_v3-40_2025-12-5.zip), one province
        zip, or a folder holding either. The full bundle is needed for the cross-check, because the
        flat all-station tables live in its "Additional" zip.

        build-site-data  parses every station, cross-checks it against ECCC's flat tables, then writes
                         dataset.json, stations.json and stations/{id}.json into <output-dir>.
        verify           parses and cross-checks only; writes nothing.
        --skip-verify    build without the cross-check (use only for a partial download).
        extract-official-files
                         unpacks every file of the release, unchanged, into
                         <output-dir>/v{release}/stations/{climateId}/ (text, PDF and PNG per station)
                         and <output-dir>/v{release}/release/ (notes, change log, flat tables),
                         ready to host on any static file host.
        """;

    public async Task<int> RunAsync(string[] args, CancellationToken ct = default)
    {
        if (args is [] or ["-h" or "--help" or "help"])
        {
            await output.WriteLineAsync(Usage);
            return args.Length == 0 ? 2 : 0;
        }

        var skipVerify = args.Contains("--skip-verify", StringComparer.Ordinal);
        var positional = args.Where(arg => !arg.StartsWith("--", StringComparison.Ordinal)).ToArray();

        switch (positional)
        {
            case ["build-site-data", var input, var outputDirectory]:
                return await BuildAsync(input, outputDirectory, skipVerify, ct);
            case ["verify", var input]:
                return await VerifyAsync(input, ct);
            case ["extract-official-files", var input, var outputDirectory]:
                return await ExtractAsync(input, outputDirectory, ct);
            default:
                await error.WriteLineAsync("Unrecognised arguments.");
                await error.WriteLineAsync(Usage);
                return 2;
        }
    }

    private async Task<int> ExtractAsync(string input, string outputDirectory, CancellationToken ct)
    {
        var result = await reader.ExtractOfficialFilesAsync(input, outputDirectory, ct);
        await output.WriteLineAsync($"Unpacked release {result.Release}: {result.StationFiles:N0} files for {result.Stations} stations and {result.ReleaseFiles} release-level files ({result.Bytes / 1_000_000.0:N1} MB) into {Path.GetFullPath(outputDirectory)}");
        return 0;
    }

    private async Task<int> VerifyAsync(string input, CancellationToken ct)
    {
        var stations = await ReadStationsAsync(input, ct);
        return await CrossCheckAsync(input, stations, ct) ? 0 : 1;
    }

    private async Task<int> BuildAsync(string input, string outputDirectory, bool skipVerify, CancellationToken ct)
    {
        var stations = await ReadStationsAsync(input, ct);

        if (!skipVerify && !await CrossCheckAsync(input, stations, ct))
        {
            await error.WriteLineAsync("Cross-check failed; nothing was written. Fix the parser or pass --skip-verify.");
            return 1;
        }

        var info = await writer.WriteAsync(stations, outputDirectory, ct);
        await output.WriteLineAsync($"Wrote {info.StationCount} stations (release {info.Release}, processed {info.ProcessingDate:yyyy-MM-dd}, latest year {info.LatestYear}) to {Path.GetFullPath(outputDirectory)}");
        return 0;
    }

    private async Task<List<IdfStation>> ReadStationsAsync(string input, CancellationToken ct)
    {
        var stations = new List<IdfStation>();
        await foreach (var station in reader.ReadStationsAsync(input, ct))
        {
            stations.Add(station);
        }

        await output.WriteLineAsync($"Parsed {stations.Count} station files.");
        return stations;
    }

    private async Task<bool> CrossCheckAsync(string input, List<IdfStation> stations, CancellationToken ct)
    {
        var tables = await reader.ReadAggregateTablesAsync(input, ct);
        var report = crossChecker.Compare(stations, tables);

        if (report.IsClean)
        {
            await output.WriteLineAsync($"Cross-check clean: {report.StationsChecked} stations, {report.ValuesChecked:N0} values agree with ECCC's flat tables.");
            return true;
        }

        await error.WriteLineAsync($"Cross-check found {report.Problems.Count} problem(s):");
        foreach (var problem in report.Problems.Take(ProblemsShown))
        {
            await error.WriteLineAsync($"  {problem}");
        }

        if (report.Problems.Count > ProblemsShown)
        {
            await error.WriteLineAsync($"  ... and {report.Problems.Count - ProblemsShown} more.");
        }

        return false;
    }
}
