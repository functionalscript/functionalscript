# fjs — FunctionalScript CLI

`fjs` is the FunctionalScript command-line tool. It is invoked directly via Node:

```sh
node ./fjs/module.mjs <command> [args]
```

or via `npx` without a global install:

```sh
npx functionalscript <command> [args]
```

`npx` resolves the **package** name, not the bin name: `fjs` is an unrelated
package on npm, so `npx fjs …` would run somebody else's code.

or, once the package is installed globally:

```sh
fjs <command> [args]
```

## Commands

| Command | Description | Documentation |
|---------|-------------|---------------|
| `test`   | Run the FunctionalScript test suite | [emergent_testing](emergent_testing/README.md) |
| `compile`| Compile a FunctionalScript module to JavaScript or JSON | [djs](djs/README.md), [fsc](fsc/README.md) |
| `cas`    | Content-addressable storage operations (`add`, `get`, `list`) | [cas](cas/README.md) |
| `mcp`    | Run an MCP server over stdio exposing the CAS and Evo as tools | [mcp](mcp/README.md) |
| `ci`     | Generate the GitHub Actions CI workflow | [ci](ci/README.md) |
| `web`    | Serve a directory over HTTP | [web](web/README.md) |
| `run`    | Run a FunctionalScript module as a program | [below](#fjs-run--running-a-module-as-a-program) |
| `help`   | Print available commands | |

Each command also accepts a short alias (`fjs t` for `fjs test`, and so on).
`fjs help` prints them; this documentation uses the full names throughout.

## `fjs compile` — compiling a module

```sh
fjs compile <input> <output>
```

The output extension picks the format: `.json` emits a tree (shared values are
expanded), anything else emits a JavaScript module that preserves sharing by
naming reused values as `const`s. Imports are resolved and inlined in both
cases. See [djs/README.md](djs/README.md) for the accepted subset.

## `fjs ci` — generating the standard CI workflow

```sh
fjs ci
```

`fjs ci` runs the built-in CI generator from `fjs/ci/module.f.mjs`, writing
`.github/workflows/ci.yml`. It is the standard entry point for projects that want
FunctionalScript's default workflow. Projects with custom CI setup code should keep
using `fjs run <custom-ci-module>`, so their module can call `ci(setup)` with its own
extra runtime steps.

## `fjs web` — serving a directory

```
fjs web [root] [port]
```

Serves `root` (default `.`) over HTTP on `port` (default `8080`), mapping each
request path to a file under it — enough to open the pages this repository
generates in a browser, where a `file://` URL has no origin. It binds loopback,
so what it serves stays on the machine it runs on. Both arguments are
positional; `port` becomes `--port`, and `--host` becomes possible at all, once
[`fjs/cli`](cli/module.f.mjs) has named options.

```
fjs web            # serve the working directory on http://127.0.0.1:8080/
fjs web docs 3000  # serve ./docs on http://127.0.0.1:3000/
```

Details, and the list of what it deliberately does not do, are in
[web](web/README.md).

## `fjs run` — running a module as a program

```sh
fjs run <module> [args...]
```

`fjs run` dynamically imports `<module>` and calls its `main` export as a
`NodeProgram`:

```ts
(v.main as NodeProgram)({ ...options, args })
```

### Convention: `export const main`

A module intended to be run with `fjs run` must export a named `main` constant
of type `NodeProgram`:

```ts
import type { NodeProgram } from '../effects/node/types.ts'

export const main: NodeProgram = options => {
    // options.args — command-line arguments passed after the module path
    ...
}
```

This mirrors:

- `export const proof` — the convention for proof/test modules.
- `main` entry-point naming from C, C++, and Rust.
- `fjs/module.f.mjs` itself, which uses `export const main`.

### Passing arguments

Any arguments after `<module>` are forwarded to `main` via `options.args`:

```sh
fjs run ./my-tool.f.mjs foo bar   # options.args === ['foo', 'bar']
```


## Architecture

```
fjs/module.mjs         — Node.js entry point (runs main via the node runner)
fjs/module.f.mjs       — FunctionalScript command dispatcher (Commands list + dispatch)
fjs/cli/module.f.mjs   — generic dispatch primitive (Command/Commands types in fjs/cli/types.ts)
```
