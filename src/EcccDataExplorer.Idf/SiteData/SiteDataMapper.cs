namespace EcccDataExplorer.Idf.SiteData;

internal static class SiteDataMapper
{
    private const string SourceUrl = "https://collaboration.cmc.ec.gc.ca/cmc/climate/Engineer_Climate/IDF/";
    private const string LicenceName = "Open Government Licence - Canada";
    private const string LicenceUrl = "https://open.canada.ca/en/open-government-licence-canada";

    public static StationSummary ToSummary(IdfStation station) =>
        new(
            station.ClimateId,
            station.Name,
            station.Province,
            station.Latitude,
            station.Longitude,
            station.ElevationMetres,
            station.FirstYear,
            station.LastYear,
            station.YearsOfData,
            station.IsComposite,
            DepthAt(station, durationMinutes: 60, returnPeriodYears: 100),
            DepthAt(station, durationMinutes: 1440, returnPeriodYears: 100));

    public static StationDetail ToDetail(IdfStation station) =>
        new(
            station.ClimateId,
            station.Name,
            station.Province,
            station.IsComposite,
            station.Latitude,
            station.Longitude,
            station.ElevationMetres,
            station.FirstYear,
            station.LastYear,
            station.YearsOfData,
            station.DurationsMinutes,
            station.ReturnPeriodsYears,
            station.ReturnPeriods.DepthsMm,
            station.ReturnPeriods.RatesMmPerHour,
            station.ReturnPeriods.RateConfidenceMmPerHour,
            station.ReturnPeriods.SampleYears,
            [.. station.AnnualMaxima.Select(row => row.Year)],
            [.. station.AnnualMaxima.Select(row => row.DepthsMm)],
            new AnnualSummary(
                station.AnnualMaximumSummary.SampleSizes,
                station.AnnualMaximumSummary.Mean,
                station.AnnualMaximumSummary.StandardDeviation,
                station.AnnualMaximumSummary.Skewness,
                station.AnnualMaximumSummary.Kurtosis),
            new PowerLawFit(
                station.Interpolation.Coefficient,
                station.Interpolation.Exponent,
                station.Interpolation.StandardError,
                station.Interpolation.MeanPercentError));

    public static DatasetInfo ToDatasetInfo(IReadOnlyCollection<IdfStation> stations)
    {
        var releases = stations.Select(station => station.ReleaseVersion).Distinct().ToList();
        var dates = stations.Select(station => station.ProcessingDate).Distinct().ToList();
        var methods = stations.Select(station => station.Method).Distinct().ToList();

        if (releases is not [{ } release] || dates is not [var date] || methods is not [var method])
        {
            throw new InvalidOperationException(
                "The stations come from more than one release, processing date or method; export one release at a time.");
        }

        return new DatasetInfo(
            release,
            date,
            stations.Max(station => station.LastYear),
            stations.Count,
            method,
            SourceUrl,
            LicenceName,
            LicenceUrl);
    }

    private static double? DepthAt(IdfStation station, int durationMinutes, int returnPeriodYears)
    {
        var duration = station.DurationsMinutes.ToList().IndexOf(durationMinutes);
        var period = station.ReturnPeriodsYears.ToList().IndexOf(returnPeriodYears);
        return duration < 0 || period < 0 ? null : station.ReturnPeriods.DepthsMm[duration][period];
    }
}
