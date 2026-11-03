namespace EcccDataExplorer.Idf;

/// <summary>Reads station files out of an ECCC IDF download.</summary>
public interface IIdfArchiveReader
{
    /// <summary>
    /// Streams every station found at <paramref name="path"/>: the full ECCC bundle
    /// (<c>idf_v3-40_*.zip</c>, whose province zips are opened in turn), a single province zip,
    /// a single station <c>.txt</c>, or a folder holding any of these. The aggregate tables that
    /// ship in the "Additional" zip are not station files and are skipped.
    /// </summary>
    /// <exception cref="FileNotFoundException">Nothing exists at <paramref name="path"/>.</exception>
    /// <exception cref="IdfFormatException">A station file does not follow the ECCC layout.</exception>
    IAsyncEnumerable<IdfStation> ReadStationsAsync(string path, CancellationToken ct = default);

    /// <summary>
    /// Reads the flat all-station tables ECCC ships in the "Additional" zip. They hold the same
    /// numbers as the station files at two decimals, which makes them an independent check.
    /// Tables that are absent come back as null.
    /// </summary>
    /// <exception cref="FileNotFoundException">Nothing exists at <paramref name="path"/>.</exception>
    Task<AggregateTables> ReadAggregateTablesAsync(string path, CancellationToken ct = default);
}

/// <summary>Raw text of the flat all-station tables from the ECCC "Additional" zip.</summary>
public sealed record AggregateTables(
    string? ReturnPeriodAmounts,
    string? ReturnPeriodRates,
    string? ReturnPeriodConfidence,
    string? StationLog);
