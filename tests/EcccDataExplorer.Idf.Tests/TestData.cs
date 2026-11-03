using System.Text;

namespace EcccDataExplorer.Idf.Tests;

/// <summary>Real ECCC v3.40 station files, copied byte-for-byte from the public release.</summary>
internal static class TestData
{
    public const string Charlottetown = "idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A.txt";

    /// <summary>Short durations not analysed: Table 2a/2b hold -99.9 and zero years.</summary>
    public const string LakeCowichan = "idf_v3-40_2025_12_5_101_BC_1012055_LAKE_COWICHAN.txt";

    /// <summary>Skewness and kurtosis print overflow stars and -NaN.</summary>
    public const string SteFoyMatapedia = "idf_v3-40_2025_12_5_701_QC_7017B65_STE_FOY_MATAPEDIA.txt";

    /// <summary>Carries the "annual maximum greater than 100-yr amount" warning block inside Table 1.</summary>
    public const string Coronation = "idf_v3-40_2025_12_5_301_AB_3011887_CORONATION_CLIMATE.txt";

    public static string FixturesDirectory { get; } = Path.Combine(AppContext.BaseDirectory, "Fixtures");

    public static string FixturePath(string fileName) => Path.Combine(FixturesDirectory, fileName);

    public static string ReadText(string fileName) => File.ReadAllText(FixturePath(fileName), Encoding.Latin1);

    public static byte[] ReadBytes(string fileName) => File.ReadAllBytes(FixturePath(fileName));

    public static IdfStation Parse(string fileName) => new IdfStationParser().Parse(ReadText(fileName), fileName);
}
