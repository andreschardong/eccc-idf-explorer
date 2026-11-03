namespace EcccDataExplorer.Idf.SiteData;

/// <summary>One row of <c>stations.json</c>: just enough to draw and filter the map.</summary>
/// <param name="Depth100Yr1h">100-year, 1-hour rainfall depth in mm; null when not analysed.</param>
/// <param name="Depth100Yr24h">100-year, 24-hour rainfall depth in mm; null when not analysed.</param>
public sealed record StationSummary(
    string Id,
    string Name,
    string Province,
    double Lat,
    double Lon,
    double? Elevation,
    int FirstYear,
    int LastYear,
    int Years,
    bool Composite,
    double? Depth100Yr1h,
    double? Depth100Yr24h);

/// <summary>Contents of <c>stations/{id}.json</c>. Matrices are [duration][return period].</summary>
/// <param name="AnnualMaxYears">Years with data, ascending; indexes the rows of <paramref name="AnnualMaxDepths"/>.</param>
/// <param name="AnnualMaxDepths">Annual maximum depth in mm, [year][duration]; null where not observed.</param>
public sealed record StationDetail(
    string Id,
    string Name,
    string Province,
    bool Composite,
    double Lat,
    double Lon,
    double? Elevation,
    int FirstYear,
    int LastYear,
    int Years,
    IReadOnlyList<int> Durations,
    IReadOnlyList<int> ReturnPeriods,
    IReadOnlyList<IReadOnlyList<double?>> Depths,
    IReadOnlyList<IReadOnlyList<double?>> Rates,
    IReadOnlyList<IReadOnlyList<double?>> Confidence,
    IReadOnlyList<int> SampleYears,
    IReadOnlyList<int> AnnualMaxYears,
    IReadOnlyList<IReadOnlyList<double?>> AnnualMaxDepths,
    AnnualSummary AnnualSummary,
    PowerLawFit Fit,
    string? OfficialFileStem = null);

public sealed record AnnualSummary(
    IReadOnlyList<int?> SampleSizes,
    IReadOnlyList<double?> Mean,
    IReadOnlyList<double?> StandardDeviation,
    IReadOnlyList<double?> Skewness,
    IReadOnlyList<double?> Kurtosis);

/// <summary>R = A * T^B per return period, R in mm/h and T in hours.</summary>
public sealed record PowerLawFit(
    IReadOnlyList<double?> Coefficient,
    IReadOnlyList<double?> Exponent,
    IReadOnlyList<double?> StandardError,
    IReadOnlyList<double?> MeanPercentError);

/// <summary>Contents of <c>dataset.json</c>: provenance shown in the site footer.</summary>
public sealed record DatasetInfo(
    string Release,
    DateOnly ProcessingDate,
    int LatestYear,
    int StationCount,
    string Method,
    string Source,
    string Licence,
    string LicenceUrl);
