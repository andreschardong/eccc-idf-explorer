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

    // Every file that belongs to one station: the .txt plus the PDF and PNG plots (_qq, _r, _t as well as the main graph).
    [GeneratedRegex(@"^idf_v(?<major>\d+)-(?<minor>\d+)_\d{4}_\d{1,2}_\d{1,2}_\d{3}_[A-Z]{2}_(?<id>[0-9A-Z]{7})_.+\.(txt|pdf|png)$", RegexOptions.IgnoreCase)]
    private static partial Regex StationAssetRegex();

    // Aggregates: idf_v3-40_2025_12_5_return_period_amounts.txt, ..._log_included.txt, ...
    [GeneratedRegex(@"^idf_v\d+-\d+_\d{4}_\d{1,2}_\d{1,2}_(?<kind>return_period_amounts|return_period_rates|return_period_conf_interval|log_included)\.txt$", RegexOptions.IgnoreCase)]
    private static partial Regex AggregateFileRegex();

    public async IAsyncEnumerable<IdfStation> ReadStationsAsync(
        string path,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        await foreach (var file in EnumerateFilesAsync(path, IsStationFile, ct))
        {
            yield return parser.Parse(Encoding.Latin1.GetString(file.Content), file.Name);
        }
    }

    public async Task<AggregateTables> ReadAggregateTablesAsync(string path, CancellationToken ct = default)
    {
        var found = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        await foreach (var file in EnumerateFilesAsync(path, name => AggregateFileRegex().IsMatch(name), ct))
        {
            found[AggregateFileRegex().Match(file.Name).Groups["kind"].Value] = Encoding.Latin1.GetString(file.Content);
        }

        return new AggregateTables(
            found.GetValueOrDefault("return_period_amounts"),
            found.GetValueOrDefault("return_period_rates"),
            found.GetValueOrDefault("return_period_conf_interval"),
            found.GetValueOrDefault("log_included"));
    }

    public async Task<OfficialFilesResult> ExtractOfficialFilesAsync(
        string path,
        string outputDirectory,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(outputDirectory);

        string? release = null;
        var stations = new HashSet<string>(StringComparer.Ordinal);
        var stationFiles = 0;
        long bytes = 0;

        // Release-level files (notes, change log, flat tables) can arrive before the first station file
        // names the release, so they wait here; together they are only a few megabytes.
        var releaseLevel = new List<ArchiveFile>();

        await foreach (var file in EnumerateFilesAsync(path, _ => true, ct))
        {
            var match = StationAssetRegex().Match(file.Name);
            if (!match.Success)
            {
                releaseLevel.Add(file);
                continue;
            }

            release ??= $"{match.Groups["major"].Value}.{match.Groups["minor"].Value}";
            var id = match.Groups["id"].Value;
            stations.Add(id);
            stationFiles++;
            bytes += await WriteAsync(Path.Combine(outputDirectory, $"v{release}", "stations", id), file, ct);
        }

        if (release is null)
        {
            throw new IdfFormatException("No ECCC station file was found, so the release cannot be named.");
        }

        foreach (var file in releaseLevel)
        {
            bytes += await WriteAsync(Path.Combine(outputDirectory, $"v{release}", "release"), file, ct);
        }

        return new OfficialFilesResult(release, stations.Count, stationFiles, releaseLevel.Count, bytes);
    }

    private static bool IsStationFile(string name) => StationFileRegex().IsMatch(name);

    private static async Task<long> WriteAsync(string directory, ArchiveFile file, CancellationToken ct)
    {
        Directory.CreateDirectory(directory);
        await File.WriteAllBytesAsync(Path.Combine(directory, file.Name), file.Content, ct);
        return file.Content.LongLength;
    }

    private static async IAsyncEnumerable<ArchiveFile> EnumerateFilesAsync(
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
                await foreach (var archiveFile in ReadFileAsync(file, include, ct))
                {
                    yield return archiveFile;
                }
            }
        }
        else if (File.Exists(path))
        {
            await foreach (var archiveFile in ReadFileAsync(path, include, ct))
            {
                yield return archiveFile;
            }
        }
        else
        {
            throw new FileNotFoundException("No ECCC IDF download found at the given path.", path);
        }
    }

    private static async IAsyncEnumerable<ArchiveFile> ReadFileAsync(
        string file,
        Func<string, bool> include,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var name = Path.GetFileName(file);
        if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            await using var stream = File.OpenRead(file);
            await foreach (var archiveFile in ReadZipAsync(stream, include, ct))
            {
                yield return archiveFile;
            }
        }
        else if (include(name))
        {
            yield return new ArchiveFile(name, await File.ReadAllBytesAsync(file, ct));
        }
    }

    private static async IAsyncEnumerable<ArchiveFile> ReadZipAsync(
        Stream stream,
        Func<string, bool> include,
        [EnumeratorCancellation] CancellationToken ct)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        foreach (var entry in archive.Entries.OrderBy(entry => entry.FullName, StringComparer.Ordinal))
        {
            ct.ThrowIfCancellationRequested();
            var name = entry.Name;
            if (name.Length == 0)
            {
                continue; // a folder entry
            }

            if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            {
                // A nested zip entry is not seekable, so buffer it (largest province zip: ~150 MB).
                using var buffer = new MemoryStream();
                await using (var entryStream = await entry.OpenAsync(ct))
                {
                    await entryStream.CopyToAsync(buffer, ct);
                }

                buffer.Position = 0;
                await foreach (var archiveFile in ReadZipAsync(buffer, include, ct))
                {
                    yield return archiveFile;
                }
            }
            else if (include(name))
            {
                using var content = new MemoryStream();
                await using (var entryStream = await entry.OpenAsync(ct))
                {
                    await entryStream.CopyToAsync(content, ct);
                }

                yield return new ArchiveFile(name, content.ToArray());
            }
        }
    }

    private readonly record struct ArchiveFile(string Name, byte[] Content);
}
