using System.Text.Json.Serialization;

namespace EcccDataExplorer.Idf.SiteData;

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = false)]
[JsonSerializable(typeof(IReadOnlyList<StationSummary>))]
[JsonSerializable(typeof(StationDetail))]
[JsonSerializable(typeof(DatasetInfo))]
public sealed partial class SiteDataJsonContext : JsonSerializerContext;
