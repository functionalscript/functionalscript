# Common effects

Operations that belong to no host in particular: they are declared once here,
and each host implements the ones it can. That does not make every program
built from them portable, so the table says which runner answers which: the
Node runner, a demo on a site page
([`website/demo-runtime.mjs`](../../website/demo-runtime.mjs)), and the
SpiderMonkey shell ([`spidermonkey`](../spidermonkey/module.mjs)). A program
that writes to `stdout` does not run in a page.
[`module.f.mjs`](./module.f.mjs) declares them, [`types.ts`](./types.ts)
says which hosts implement which, and [`module.mjs`](./module.mjs) holds the
handlers the hosts share.

|Operation                         |Does                                                                |Answered by                |
|----------------------------------|--------------------------------------------------------------------|---------------------------|
|`write(stream, bytes)`            |writes bytes to `stdout` or `stderr`                                |Node, SpiderMonkey         |
|`log(s)`, `error(s)`              |writes a line of text to `stdout` or `stderr`                       |Node, SpiderMonkey         |
|`errorExit(s)`                    |writes a line to `stderr` and ends the program with exit code `1`   |Node, SpiderMonkey         |
|`read(stream)`, `readLine`        |reads from `stdin`                                                  |Node                       |
|`sandbox(f)`                      |runs `f`, reporting what it answered or threw and how long it took  |Node, page, SpiderMonkey   |
|`catch_(f)`                       |runs `f`, answering what it threw as a `Result` error               |Node, page, SpiderMonkey   |
|`import_(path)`                   |imports a module                                                    |Node, SpiderMonkey         |
|`randomInt()`                     |a random integer                                                    |Node, page                 |
|`all(...effects)`, `allOk`, `both`|runs effects side by side, answering every result                   |Node, SpiderMonkey         |

`sandbox` and `catch_` are the only way a FunctionalScript program meets code
that may throw, such as a test body or a benchmark. A demo uses `sandbox` to
time a function in the reader's browser ([`fjs/types/bigint`](../../types/bigint/demo.f.mjs)).
