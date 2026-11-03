using EcccDataExplorer.Cli;
using EcccDataExplorer.Idf;
using EcccDataExplorer.Idf.SiteData;
using EcccDataExplorer.Idf.Verification;

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cts.Cancel();
};

var runner = new CommandRunner(
    new IdfArchiveReader(new IdfStationParser()),
    new IdfCrossChecker(),
    new SiteDataWriter(),
    Console.Out,
    Console.Error);

try
{
    return await runner.RunAsync(args, cts.Token);
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("Cancelled.");
    return 130;
}
catch (Exception ex) when (ex is IdfFormatException or FileNotFoundException or InvalidOperationException)
{
    Console.Error.WriteLine($"Error: {ex.Message}");
    return 1;
}
