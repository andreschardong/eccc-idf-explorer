namespace EcccDataExplorer.Idf;

/// <summary>Parses the text of one ECCC IDF station file.</summary>
public interface IIdfStationParser
{
    /// <summary>Parses the full text of a station file (Latin-1 decoded).</summary>
    /// <param name="text">File contents.</param>
    /// <param name="sourceName">File name, used in error messages.</param>
    /// <exception cref="IdfFormatException">The text does not follow the ECCC layout.</exception>
    IdfStation Parse(string text, string sourceName);
}
