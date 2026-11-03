namespace EcccDataExplorer.Idf.SiteData;

/// <summary>Writes the static JSON files the web site reads.</summary>
public interface ISiteDataWriter
{
    /// <summary>
    /// Writes <c>dataset.json</c>, <c>stations.json</c> and one <c>stations/{id}.json</c> per station into
    /// <paramref name="outputDirectory"/>. Existing <c>stations/*.json</c> files are replaced so the folder
    /// never keeps a station that left the release. Output is ordered by climate ID and carries no
    /// timestamps, so re-running on the same release yields identical bytes.
    /// </summary>
    /// <exception cref="InvalidOperationException">The stations mix releases or contain duplicate climate IDs.</exception>
    Task<DatasetInfo> WriteAsync(
        IReadOnlyCollection<IdfStation> stations,
        string outputDirectory,
        CancellationToken ct = default);
}
