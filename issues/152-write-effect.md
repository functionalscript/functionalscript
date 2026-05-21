# 152. `Write` Effect and TTY-Aware Console

Replace `Io`-based TTY-aware console output (`fs/text/sgr/module.f.ts`) with an Effect-based design. SGR stripping is handled at the application level using `isTTY` constants carried in `NodeProgramOptions`.

## New types

### `WriteConsoles`

Named output streams (extensible to `number` fd in the future):

```ts
export type WriteConsoles = 'stdout' | 'stderr'
```

### `Write` effect

Raw byte write to a named stream. The effect is encoding-agnostic — callers supply a `Vec`:

```ts
export type Write = readonly['write', (stream: WriteConsoles, data: Vec) => void]
export const write: Func<Write> = do_('write')
```

Added to `NodeOp`.

### `NodeProgramOptions.std`

Carries the TTY constants for each output stream (known at process startup, never change):

```ts
export type NodeProgramOptions = {
    readonly args: readonly string[]
    readonly env: Env
    readonly std: { readonly [k in WriteConsoles]: { readonly isTTY: boolean } }
}
```

## SGR-aware wrapper (`fs/text/sgr/module.f.ts`)

`csiWrite` is the TTY-aware helper. It strips ANSI SGR sequences when the target stream is not a TTY, then encodes to UTF-8 and delegates to the `write` effect:

```ts
export const csiWrite =
    (o: NodeProgramOptions) => (stream: WriteConsoles) => (s: string): Effect<Write, void> => {
        const line = o.std[stream].isTTY ? s : s.replace(/\x1b\[[0-9;]*m/g, '')
        return write(stream, toVec(encodeUtf8(line + '\n')))
    }
```

`stdio` and `stderr` helpers become:

```ts
export const stdio  = (o: NodeProgramOptions): CsiConsole => csiWrite(o)('stdout')
export const stderr = (o: NodeProgramOptions): CsiConsole => csiWrite(o)('stderr')
```

where `CsiConsole = (s: string) => Effect<Write, void>`.

## Runner implementations

### `fromIo` (Node.js)

Maps stream name to fd and delegates to `fs.writeSync`. No TTY logic — that lives in `csiWrite`:

```ts
write: (stream, data) => {
    const fd = stream === 'stdout' ? 1 : 2
    io.fs.writeSync(fd, fromVec(data))
}
```

`ioRun` constructs the `std` field from the real process:

```ts
const options: NodeProgramOptions = {
    args: argv.slice(2),
    env,
    std: {
        stdout: { isTTY: process.stdout.isTTY },
        stderr: { isTTY: process.stderr.isTTY },
    },
}
```

### Virtual runner

Defaults `isTTY: false` (strips SGR in tests). Captured output appended to state for assertions.

## Dependencies

- [i153](./153-write-queue.md) — the `write` handler in `fromIo` must use the write queue to guarantee atomic, ordered delivery; implement i153 first.

## Migration

- `fs/dev/tf/module.f.ts`: replace `stdio(io)`/`stderr(io)` with `csiWrite(options)('stdout')`/`csiWrite(options)('stderr')` — blocked on [i148](./148-test-framework-effects.md) (test framework must become an Effect program first)
- Close [i150](./150-tty.md) as superseded — the `IsTty` effect is no longer needed since `isTTY` is a startup constant carried in `NodeProgramOptions`

## Future: retire `Console` effects

Once `tf/module.f.ts` (and any other caller) is fully converted to use `write`, the `Log` and `Error` effects (`Console` union) can be retired. `write('stdout', ...)` and `write('stderr', ...)` subsume them, with the added benefit of raw-byte delivery and TTY-aware SGR stripping at the application level.
