namespace EcccDataExplorer.Idf;

/// <summary>
/// One station of the ECCC Intensity-Duration-Frequency (IDF) dataset, as published in a
/// station text file. Missing values (<c>-99.9</c> in the source) are <see langword="null"/>.
/// </summary>
public sealed record IdfStation
{
    /// <summary>Climate identifier, e.g. <c>8300301</c> or <c>830P001</c>.</summary>
    public required string ClimateId { get; init; }

    public required string Name { get; init; }

    /// <summary>Two-letter province or territory code.</summary>
    public required string Province { get; init; }

    /// <summary>True when ECCC joined records from more than one climate station.</summary>
    public required bool IsComposite { get; init; }

    /// <summary>Decimal degrees, north positive. The source gives whole minutes.</summary>
    public required double Latitude { get; init; }

    /// <summary>Decimal degrees, east positive. The source gives whole minutes.</summary>
    public required double Longitude { get; init; }

    public double? ElevationMetres { get; init; }

    public required int FirstYear { get; init; }

    public required int LastYear { get; init; }

    /// <summary>Number of years with data, as stated in the file header.</summary>
    public required int YearsOfData { get; init; }

    /// <summary>Fitting method line, e.g. "Gumbel - Method of moments".</summary>
    public required string Method { get; init; }

    /// <summary>Date the release was processed (the date printed on the file).</summary>
    public required DateOnly ProcessingDate { get; init; }

    /// <summary>Release number taken from the file name (<c>idf_v3-40_...</c> gives "3.40"), when present.</summary>
    public string? ReleaseVersion { get; init; }

    /// <summary>
    /// The station file's name without its extension, for example
    /// <c>idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A</c>. ECCC names the station's PDF and PNG plots
    /// from it by adding <c>_qq</c>, <c>_r</c> or <c>_t</c> and an extension. Null when the file name is not ECCC's.
    /// </summary>
    public string? OfficialFileStem { get; init; }

    /// <summary>Rainfall durations in minutes, in column order (5, 10, 15, 30, 60, ...).</summary>
    public required IReadOnlyList<int> DurationsMinutes { get; init; }

    /// <summary>Return periods in years, in column order (2, 5, 10, ...).</summary>
    public required IReadOnlyList<int> ReturnPeriodsYears { get; init; }

    /// <summary>Table 1: one row per year with data, each holding one value per duration.</summary>
    public required IReadOnlyList<AnnualMaximumRow> AnnualMaxima { get; init; }

    public required AnnualMaximumSummary AnnualMaximumSummary { get; init; }

    /// <summary>Tables 2a and 2b: return-period quantiles, indexed [duration][return period].</summary>
    public required ReturnPeriodTables ReturnPeriods { get; init; }

    /// <summary>Table 3: the fit R = A * T^B, one entry per return period.</summary>
    public required InterpolationFit Interpolation { get; init; }
}

/// <summary>Annual maximum rainfall depths for one year, one value per duration.</summary>
/// <param name="Year">Calendar year of the observations.</param>
/// <param name="DepthsMm">Depth in millimetres per duration; null when not observed.</param>
public sealed record AnnualMaximumRow(int Year, IReadOnlyList<double?> DepthsMm);

/// <summary>Table 1 footer: sample statistics of the annual maxima, one value per duration.</summary>
public sealed record AnnualMaximumSummary
{
    public required IReadOnlyList<int?> SampleSizes { get; init; }

    public required IReadOnlyList<double?> Mean { get; init; }

    public required IReadOnlyList<double?> StandardDeviation { get; init; }

    /// <summary>Null where the source printed overflow stars or NaN.</summary>
    public required IReadOnlyList<double?> Skewness { get; init; }

    /// <summary>Null where the source printed overflow stars or NaN.</summary>
    public required IReadOnlyList<double?> Kurtosis { get; init; }
}

/// <summary>Return-period rainfall for every duration. Matrices are [duration][return period].</summary>
public sealed record ReturnPeriodTables
{
    /// <summary>Table 2a: rainfall depth in millimetres.</summary>
    public required IReadOnlyList<IReadOnlyList<double?>> DepthsMm { get; init; }

    /// <summary>Table 2b: rainfall rate (intensity) in millimetres per hour.</summary>
    public required IReadOnlyList<IReadOnlyList<double?>> RatesMmPerHour { get; init; }

    /// <summary>Table 2b: half-width of the 95 % confidence interval, in millimetres per hour.</summary>
    public required IReadOnlyList<IReadOnlyList<double?>> RateConfidenceMmPerHour { get; init; }

    /// <summary>Years of data behind each duration; zero when the duration was not analysed.</summary>
    public required IReadOnlyList<int> SampleYears { get; init; }
}

/// <summary>Table 3: power-law interpolation R = A * T^B, with R in mm/h and T in hours.</summary>
public sealed record InterpolationFit
{
    public required IReadOnlyList<double?> MeanOfRates { get; init; }

    public required IReadOnlyList<double?> StandardDeviationOfRates { get; init; }

    public required IReadOnlyList<double?> StandardError { get; init; }

    /// <summary>The coefficient A.</summary>
    public required IReadOnlyList<double?> Coefficient { get; init; }

    /// <summary>The exponent B (negative: intensity falls as duration grows).</summary>
    public required IReadOnlyList<double?> Exponent { get; init; }

    public required IReadOnlyList<double?> MeanPercentError { get; init; }
}
