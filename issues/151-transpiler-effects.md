# 151. Convert DJS Transpiler to Effects

The DJS transpiler (`fs/djs/transpiler/module.f.ts`) currently depends on the legacy `Fs` interface from `fs/io/module.f.ts` and uses `readFileSync` — the only `Fs` operation it needs. Its test (`fs/djs/transpiler/test.f.ts`) builds a virtual filesystem via `createVirtualIo` from `fs/io/virtual/module.f.ts` solely to extract `.fs` from it.

## Goal

Replace the `Fs` parameter with an Effect-based API so the transpiler becomes a pure Effect program. Tests use the `fs/types/effects/node/virtual` runner with a pre-loaded in-memory filesystem instead of `createVirtualIo`.

## Current shape

```ts
// module.f.ts
import type { Fs } from '../../io/module.f.ts'

export type ParseContext = {
    readonly fs: Fs
    // ...
}

// only usage:
const content = context.fs.readFileSync(path)
```

```ts
// test.f.ts
import { createVirtualIo } from '../../io/virtual/module.f.ts'

const fs = createVirtualIo(map).fs
const result = transpile(fs)('a')
```

## Target shape

Replace `Fs` with `ReadFile` effect. `transpile` returns an `Effect<ReadFile, Result<...>>` instead of a plain `Result<...>`:

```ts
import { readFile } from '../../types/effects/node/module.f.ts'

// reads a file as an effect, decodes, parses
const content: Effect<ReadFile, Result<Uint8Array, unknown>> = readFile(path)
```

Tests use the virtual effect runner with a pre-populated `root`:

```ts
import { virtual, emptyState } from '../../types/effects/node/virtual/module.f.ts'
import { setReplace } from '../../types/ordered_map/module.f.ts'

const state = { ...emptyState, root: { 'a': { content: encodeUtf8('export default 1') } } }
const [_, result] = virtual(state)(transpile('a'))
```

## Side effects

Once this is done, `fs/io/virtual/module.f.ts` (`createVirtualIo`) has no remaining callers and can be deleted.
