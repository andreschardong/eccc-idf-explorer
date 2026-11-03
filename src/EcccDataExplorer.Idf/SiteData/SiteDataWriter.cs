using System.Text.Json;

namespace EcccDataExplorer.Idf.SiteData;

/// <inheritdoc />
public sealed class SiteDataWriter : ISiteDataWriter
{
    public async Task<DatasetInfo> WriteAsync(
        IReadOnlyCollection<IdfStation> stations,
        string outputDirectory,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(stations);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputDirectory);

        var ordered = stations.OrderBy(station => station.ClimateId, StringComparer.Ordinal).ToList();
        var duplicate = ordered.GroupBy(station => station.ClimateId).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new InvalidOperationException($"Climate ID {duplicate.Key} appears more than once.");
        }

        var info = SiteDataMapper.ToDatasetInfo(ordered);

        var stationsDirectory = Path.Combine(outputDirectory, "stations");
        Directory.CreateDirectory(stationsDirectory);
        foreach (var stale in Directory.EnumerateFiles(stationsDirectory, "*.json"))
        {
            File.Delete(stale);
        }

        foreach (var station in ordered)
        {
            ct.ThrowIfCancellationRequested();
            var detail = SiteDataMapper.ToDetail(station);
            await WriteJsonAsync(
                Path.Combine(stationsDirectory, $"{station.ClimateId}.json"),
                detail,
                SiteDataJsonContext.Default.StationDetail,
                ct);
        }

        IReadOnlyList<StationSummary> index = [.. ordered.Select(SiteDataMapper.ToSummary)];
        await WriteJsonAsync(Path.Combine(outputDirectory, "stations.json"), index, SiteDataJsonContext.Default.IReadOnlyListStationSummary, ct);
        await WriteJsonAsync(Path.Combine(outputDirectory, "dataset.json"), info, SiteDataJsonContext.Default.DatasetInfo, ct);

        return info;
    }

    private static async Task WriteJsonAsync<T>(
        string path,
        T value,
        System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> typeInfo,
        CancellationToken ct)
    {
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, value, typeInfo, ct);
    }
}
