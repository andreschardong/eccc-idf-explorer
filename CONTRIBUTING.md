# Contributing

Issues and pull requests are welcome. This is a small project, so the process is light.

## Set up

You need the [.NET 10 SDK](https://dotnet.microsoft.com/download) and Node.js 22.12 or later.

```sh
dotnet test --solution ECCCDataExplorer.slnx     # parser, exporter, CLI
cd site && npm ci && npm test && npm run typecheck
```

`npm run dev` serves the site at <http://localhost:5173> with hot reload.

## Before you open a pull request

- **.NET changes** keep the existing style: file-scoped namespaces, primary constructors, collection
  expressions, `Async` suffix with a `CancellationToken` on async methods, no stored procedures,
  and tests named `When<Condition>_Should<Outcome>` using xUnit v3, NSubstitute and Shouldly.
  The build treats warnings as errors.
- **Site changes** are TypeScript with `strict` on. Put pure logic in its own module with a
  `*.test.ts` beside it; keep DOM code thin. All text goes through the `h()` and `s()` helpers in
  `site/src/dom.ts`, never `innerHTML`.
- **Parser changes** need a real fixture. Copy the offending station file from the ECCC download
  into `tests/EcccDataExplorer.Idf.Tests/Fixtures/` byte for byte (they are Latin-1) and add a test.
- **Data changes** are made by regenerating, not by editing JSON: `node scripts/update-data.mjs`.

## Reporting a data problem

If a number on the site differs from ECCC's file, include the climate ID, the duration and return
period, and both values. If the numbers agree with ECCC's file, the issue is with ECCC's data and
is best raised with ECCC's Engineering Climate Services unit.
