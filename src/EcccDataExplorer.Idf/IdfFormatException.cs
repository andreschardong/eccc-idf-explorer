namespace EcccDataExplorer.Idf;

/// <summary>Thrown when an ECCC IDF file does not have the layout the parser expects.</summary>
public sealed class IdfFormatException : Exception
{
    public IdfFormatException()
    {
    }

    public IdfFormatException(string message)
        : base(message)
    {
    }

    public IdfFormatException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public IdfFormatException(string sourceName, string message)
        : base($"{sourceName}: {message}")
    {
        SourceName = sourceName;
    }

    /// <summary>Name of the file that failed to parse, when known.</summary>
    public string? SourceName { get; }
}
