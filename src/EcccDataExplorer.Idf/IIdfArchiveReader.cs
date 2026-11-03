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

    /// <summary>
    /// Unpacks every file of the release, byte for byte, into a layout fit for static hosting:
    /// <c>v{release}/stations/{climateId}/{original file name}</c> for each station's text, PDF and PNG
    /// files, and <c>v{release}/release/{original file name}</c> for the release notes, change log and
    /// flat tables. Nested zips are opened; nothing is renamed or re-encoded.
    /// </summary>
    /// <param name="path">The ECCC download: the bundle zip, a province zip, or a folder holding them.</param>
    /// <param name="outputDirectory">Created if missing. Existing files with the same names are replaced.</param>
    /// <exception cref="FileNotFoundException">Nothing exists at <paramref name="path"/>.</exception>
    /// <exception cref="IdfFormatException">No station file was found, so the release cannot be named.</exception>
    Task<OfficialFilesResult> ExtractOfficialFilesAsync(string path, string outputDirectory, CancellationToken ct = default);
}

/// <summary>Raw text of the flat all-station tables from the ECCC "Additional" zip.</summary>
public sealed record AggregateTables(
    string? ReturnPeriodAmounts,
    string? ReturnPeriodRates,
    string? ReturnPeriodConfidence,
    string? StationLog);

/// <summary>What <see cref="IIdfArchiveReader.ExtractOfficialFilesAsync"/> wrote.</summary>
/// <param name="Release">Release number, e.g. "3.40".</param>
/// <param name="Stations">Distinct stations that have files.</param>
/// <param name="StationFiles">Files under <c>stations/</c>.</param>
/// <param name="ReleaseFiles">Files under <c>release/</c>.</param>
/// <param name="Bytes">Total size written.</param>
public sealed record OfficialFilesResult(string Release, int Stations, int StationFiles, int ReleaseFiles, long Bytes);
