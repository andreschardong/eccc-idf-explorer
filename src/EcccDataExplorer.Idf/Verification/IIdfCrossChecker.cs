namespace EcccDataExplorer.Idf.Verification;

/// <summary>Compares parsed station files with ECCC's own flat all-station tables.</summary>
public interface IIdfCrossChecker
{
    /// <summary>
    /// Checks that the station set, the return-period depths and rates, the confidence limits and the
    /// station metadata in <paramref name="stations"/> agree with <paramref name="tables"/>.
    /// The station files print one decimal and the flat tables two, so values may differ by at most 0.05.
    /// </summary>
    CrossCheckReport Compare(IReadOnlyCollection<IdfStation> stations, AggregateTables tables);
}

/// <param name="StationsChecked">Stations present in both sources.</param>
/// <param name="ValuesChecked">Individual numbers compared.</param>
/// <param name="Problems">One line per disagreement; empty when the sources agree.</param>
public sealed record CrossCheckReport(int StationsChecked, int ValuesChecked, IReadOnlyList<string> Problems)
{
    public bool IsClean => Problems.Count == 0;
}
