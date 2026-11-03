using System.IO.Compression;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;

namespace EcccDataExplorer.Idf;

/// <inheritdoc />
public sealed partial class IdfArchiveReader(IIdfStationParser parser) : IIdfArchiveReader
{
    // Station files: idf_v3-40_2025_12_5_<climate district>_<province>_<climate id>_<NAME>.txt
    [GeneratedRegex(@"^idf_v\d+-\d+_\d{4}_\d{1,2}_\d{1,2}_\d{3}_[A-Z]{2}_[0-9A-Z]{7}_.+\.txt$", RegexOptions.IgnoreCase)]
    private static partial Regex StationFileRegex();

    // Aggregates: idf_v3-40_2025_12_5_return_period_amounts.txt, ..._log_included.txt, ...
    [GeneratedRegex(@"^idf_v\d+-\d+_\d{4}_\d{1,2}_\d{1,2}_(?<kind>return_period_amounts|return_period_rates|return_period_conf_interval|log_included)\.txt$", RegexOptions.IgnoreCase)]
    private static partial Regex AggregateFileRegex();

    public async IAsyncEnumerable<IdfStation> ReadStationsAsync(
        string path,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        await foreach (var file in EnumerateTextFilesAsync(path, IsStationFile, ct))
        {
            yield return parser.Parse(file.Text, file.Name);
        }
    }

    public async Task<AggregateTables> ReadAggregateTablesAsync(string path, CancellationToken ct = default)
    {
        var found = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        await foreach (var file in EnumerateTextFilesAsync(path, name => AggregateFileRegex().IsMatch(name), ct))
        {
            found[AggregateFileRegex().Match(file.Name).Groups["kind"].Value] = file.Text;
        }

        return new AggregateTables(
            found.GetValueOrDefault("return_period_amounts"),
            found.GetValueOrDefault("return_period_rates"),
            found.GetValueOrDefault("return_period_conf_interval"),
            found.GetValueOrDefault("log_included"));
    }

    private static bool IsStationFile(string name) => StationFileRegex().IsMatch(name);

    private static async IAsyncEnumerable<TextFile> EnumerateTextFilesAsync(
        string path,
        Func<string, bool> include,
        [EnumeratorCancellation] CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);

        if (Directory.Exists(path))
        {
            var files = Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories)
                .Order(StringComparer.Ordinal);
            foreach (var file in files)
            {
                await foreach (var textFile in ReadFileAsync(file, include, ct))
                {
                    yield return textFile;
                }
            }
        }
        else if (File.Exists(path))
        {
            await foreach (var textFile in ReadFileAsync(path, include, ct))
            {
                yield return textFile;
            }
        }
        else
        {
            throw new FileNotFoundException("No ECCC IDF download found at the given path.", path);
        }
    }

    private static async IAsyncEnumerable<TextFile> ReadFileAsync(
        string file,
        Func<string, bool> include,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var name = Path.GetFileName(file);
        if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            await using var stream = File.OpenRead(file);
            await foreach (var textFile in ReadZipAsync(stream, include, ct))
            {
                yield return textFile;
            }
        }
        else if (include(name))
        {
            await using var stream = File.OpenRead(file);
            yield return new TextFile(name, await ReadTextAsync(stream, ct));
        }
    }

    private static async IAsyncEnumerable<TextFile> ReadZipAsync(
        Stream stream,
        Func<string, bool> include,
        [EnumeratorCancellation] CancellationToken ct)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        foreach (var entry in archive.Entries.OrderBy(entry => entry.FullName, StringComparer.Ordinal))
        {
            ct.ThrowIfCancellationRequested();
            var name = entry.Name;

            if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            {
                // A nested zip entry is not seekable, so buffer it (largest province zip: ~150 MB).
                using var buffer = new MemoryStream();
                await using (var entryStream = await entry.OpenAsync(ct))
                {
                    await entryStream.CopyToAsync(buffer, ct);
                }

                buffer.Position = 0;
                await foreach (var textFile in ReadZipAsync(buffer, include, ct))
                {
                    yield return textFile;
                }
            }
            else if (include(name))
            {
                await using var entryStream = await entry.OpenAsync(ct);
                yield return new TextFile(name, await ReadTextAsync(entryStream, ct));
            }
        }
    }

    private static async Task<string> ReadTextAsync(Stream stream, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, Encoding.Latin1);
        return await reader.ReadToEndAsync(ct);
    }

    private readonly record struct TextFile(string Name, string Text);
}
