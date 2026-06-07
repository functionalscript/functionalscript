# fjs — FunctionalScript CLI

`fjs` is the FunctionalScript command-line tool. It is invoked directly via Node:

```sh
node ./fs/fjs/module.ts <command> [args]
```

or via `npx` without a global install:

```sh
npx fjs <command> [args]
```

or, once the package is installed globally:

```sh
fjs <command> [args]
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `test`   | `t`   | Run the FunctionalScript test suite |
| `compile`| `c`   | Compile a FunctionalScript module to JavaScript |
| `cas`    | `s`   | Content-addressable storage operations |
| `run`    | `r`   | Run a FunctionalScript module as a program |
| `help`   | `h`, `?` | Print available commands |

## `fjs run` — running a module as a program

```sh
fjs run <module> [args...]
fjs r   <module> [args...]
```

`fjs r` dynamically imports `<module>` and calls its `main` export as a
`NodeProgram`:

```ts
(v.main as NodeProgram)({ ...options, args })
```

### Convention: `export const main`

A module intended to be run with `fjs r` must export a named `main` constant
of type `NodeProgram`:

```ts
import type { NodeProgram } from '../effects/node/module.f.ts'

export const main: NodeProgram = options => {
    // options.args — command-line arguments passed after the module path
    ...
}
```

This mirrors:

- `export const proof` — the convention for proof/test modules.
- `main` entry-point naming from C, C++, and Rust.
- `fs/fjs/module.f.ts` itself, which uses `export const main`.

### Passing arguments

Any arguments after `<module>` are forwarded to `main` via `options.args`:

```sh
fjs r ./my-tool.f.ts foo bar   # options.args === ['foo', 'bar']
```


## Architecture

```
fs/fjs/module.ts      — Node.js entry point (runs main via the node runner)
fs/fjs/module.f.ts    — FunctionalScript command dispatcher (Commands list + dispatch)
fs/cli/module.f.ts    — generic Command/Commands/dispatch primitives
```
