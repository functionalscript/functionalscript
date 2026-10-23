# Common effects

Operations that belong to no host in particular, so that a program using only
these runs on Node, in a browser page and in the SpiderMonkey shell alike.
[`module.f.mjs`](./module.f.mjs) declares them, [`types.ts`](./types.ts)
says which hosts implement which, and [`module.mjs`](./module.mjs) holds the
handlers the hosts share.

|Operation                         |Does                                                                |
|----------------------------------|--------------------------------------------------------------------|
|`write(stream, bytes)`            |writes bytes to `stdout` or `stderr`                                |
|`log(s)`, `error(s)`              |writes a line of text to `stdout` or `stderr`                       |
|`errorExit(s)`                    |writes a line to `stderr` and ends the program with exit code `1`   |
|`read(stream)`, `readLine`        |reads from `stdin`                                                  |
|`sandbox(f)`                      |runs `f`, reporting what it answered or threw and how long it took  |
|`catch_(f)`                       |runs `f`, answering what it threw as a `Result` error               |
|`import_(path)`                   |imports a module                                                    |
|`randomInt()`                     |a random integer                                                    |
|`all(...effects)`, `allOk`, `both`|runs effects side by side, answering every result                   |

`sandbox` and `catch_` are the only way a FunctionalScript program meets code
that may throw, such as a test body or a benchmark. A demo uses `sandbox` to
time a function in the reader's browser ([`fjs/types/bigint`](../../types/bigint/demo.f.mjs)).
