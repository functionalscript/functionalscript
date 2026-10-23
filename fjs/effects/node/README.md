# Node effects

The operations a program performs on Node.js, and the `NodeProgram` type a
command-line program is. [`module.f.mjs`](./module.f.mjs) declares the
operations and their helpers, [`types.ts`](./types.ts) their types, and
[`module.mjs`](./module.mjs) is the runner that performs them against Node's
own APIs.

```js
import { exitStep, readUtf8File } from './module.f.mjs'
import { log } from '../common/module.f.mjs'
import { mapStep, step } from '../module.f.mjs'

/** Prints how many lines a file has. @type {import('./types.ts').NodeProgram} */
export const main = ({ args }) => {
    const count = mapStep(readUtf8File(args[0]), text => text.split('\n').length)
    const printed = step(count, n => log(`${n} lines`))
    return exitStep(printed)
}
```

`fjs run lines.f.mjs README.md` runs it. `exitStep` is the exit-code policy at
the end of the chain: `0` on success, and on failure the error printed to
`stderr` and `1`.

## The operations

|Group           |Operations                                                                      |
|----------------|--------------------------------------------------------------------------------|
|files           |`readFile`, `readUtf8File`, `readWhole`, `writeFile`, `writeUtf8File`, `writeFiles`, `writeBytes`, `writeChunks`, `mkdir`, `readdir`, `rm`, `rmdir`, `rename`, `access`, `stat`, `open`, `fstat`, `pread`, `close`, `createExclusive`, `writeExclusive`|
|network         |`fetch`, `createServer`, `listen`, `forever`                                    |
|processes       |`exec`, `spawn`, `childWait`                                                    |
|other           |`inflate`, `now`, `resolveFileModule`, `test`                                   |
|from `common`   |`write`, `log`, `error`, `errorExit`, `read`, `readLine`, `sandbox`, `catch_`, `import_`, `all`, `allOk`, `both`, re-exported here|

Every operation answers an `IoResult<T>`: the value, an `IoError` (the host's
failure, with its OS `code` such as `'ENOENT'`), or `NotImplemented`.
`isNotFound` and `isDirectory` test an error, so a program can forgive the one
it expects: `catchStep(readFile(path), orElse(isNotFound, null))`.

## Running

|Runner                                   |Use it for                                                       |
|-----------------------------------------|-----------------------------------------------------------------|
|`run(main)` in [`module.mjs`](./module.mjs)|a `bin` script: performs the program, then exits with its code  |
|`runEffect(main)` in [`module.mjs`](./module.mjs)|the same, resolving to the exit code without exiting        |
|[`virtual`](./virtual/README.md)         |proofs: a synchronous, in-memory file system and console         |
|[`memory`](./memory/types.ts)            |the asynchronous interpreter for [`../memory`](../memory/README.md)'s operations|

A program does not import the runner; the `fjs` CLI and the tests do.
