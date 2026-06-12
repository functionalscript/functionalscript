# 198. `effects/node`: `readUtf8File` / `writeUtf8File` helpers

**Priority:** P3
**Status:** done

## Resolution

Implemented `readUtf8File` and `writeUtf8File` in
`fs/effects/node/module.f.ts`, next to `readFile`/`writeFile`.
Notes on how reality diverged from the proposal below:

- **Consumer drift.** The `dev` and `dev/version` consumers listed below
  were refactored away before this landed. Remaining call sites migrated:
  `djs/transpiler` (read), `djs` compile output and `ci` (write).
- **Return shape.** `readUtf8File` returns `Effect<ReadFile, IoResult<string>>`
  as proposed — `djs/transpiler` pattern-matches the error to build a
  domain-specific `ParseError`. `writeUtf8File` returns
  `Effect<WriteFile, IoResult<void>>`, not `Effect<WriteFile, void>` as
  sketched: `writeFile` itself yields `IoResult<void>`, and the helper is a
  transparent wrapper.
- **No dependency cycle.** `fs/effects/node` already imported `utf8` from
  `fs/text` (for `log`/`error`), so adding `utf8ToString` introduced no new
  dependency edge.
- [i176](./176-json-file-effects.md) is now unblocked, but its own consumer
  base has eroded — see the note added there.

## Problem

Five effect-using modules each open-code the same UTF-8 ↔ file
conversion sandwich over the `ReadFile` / `WriteFile` effects:

```ts
// read: readFile → unwrap → utf8ToString
// fs/dev/version/module.f.ts:15
const readJson = (name: string) => begin
    .step(() => readFile(jsonFile(name)))
    .step(v => pure(parse(utf8ToString(unwrap(v)))))

// fs/dev/module.f.ts:126
.step(() => readFile(denoJson))
.step(v => pure(unwrap(parseDenoJson(jsonParse(utf8ToString(unwrap(v)))))))

// fs/djs/transpiler/module.f.ts:42
= path => readFile(path).step(result => {
    if (result[0] === 'error') {
        return pure(error({ message: 'file not found', metadata: null }))
    }
    const tokens = tokenize(stringToList(utf8ToString(result[1])))(path)
    ...
})

// write: utf8 → writeFile
// fs/djs/module.f.ts:48
return writeFile(outputFileName, utf8(content))

// fs/dev/module.f.ts:140
return writeFile(denoJson, utf8(json))

// fs/ci/module.f.ts:53
.step(() => writeFile('.github/workflows/ci.yml', utf8(JSON.stringify(gha, null, '  '))))

// fs/dev/version/module.f.ts:21
.step(json => writeFile(jsonFile(name), utf8(stringify({...json, version}, null, 2))))
```

- **Read sandwich**: 3 modules (`dev/version`, `dev`, `djs/transpiler`)
  spell `utf8ToString(unwrap(readFile(...)))`.
- **Write sandwich**: 4 modules (`djs`, `dev`, `ci`, `dev/version`)
  spell `writeFile(path, utf8(content))`.

This sits one abstraction layer **below**
[i176](./176-json-file-effects.md): i176 lifts the JSON-specific
`readJsonFile`/`writeJsonFile` helpers, but each of those would
internally still want `readUtf8File`/`writeUtf8File` for the bytes
↔ string sandwich. The non-JSON consumers (`djs/transpiler` reads
source text, not JSON; `ci` writes YAML-shaped JSON; `djs` writes JS
output) want the UTF-8 helpers too.

## Proposed abstraction

Two thin helpers next to `readFile`/`writeFile` in
`fs/effects/node/module.f.ts`:

```ts
import { utf8, utf8ToString } from '../../../text/module.f.ts'
import { type IoResult } from './module.f.ts'

/** Reads a file as UTF-8 text, preserving the `IoResult` so callers can
 *  decide whether to `unwrap` or pattern-match on errors. */
export const readUtf8File = (path: string): Effect<ReadFile, IoResult<string>> =>
    readFile(path).step(r =>
        pure(r[0] === 'ok' ? ok(utf8ToString(r[1])) : r))

/** Writes a string to `path` as UTF-8 bytes. */
export const writeUtf8File = (path: string, content: string): Effect<WriteFile, void> =>
    writeFile(path, utf8(content))
```

Consumers shrink to:

```ts
// djs/transpiler.f.ts
= path => readUtf8File(path).step(result => {
    if (result[0] === 'error') {
        return pure(error({ message: 'file not found', metadata: null }))
    }
    const tokens = tokenize(stringToList(result[1]))(path)
    ...
})

// djs/module.f.ts
return writeUtf8File(outputFileName, content)

// ci/module.f.ts
.step(() => writeUtf8File('.github/workflows/ci.yml', JSON.stringify(gha, null, '  ')))

// dev/module.f.ts (read)
.step(() => readUtf8File(denoJson))
.step(v => pure(unwrap(parseDenoJson(jsonParse(unwrap(v))))))
```

The JSON helpers from i176 then become two-liners:

```ts
export const readJsonFile = (path: string): Effect<ReadFile, unknown> =>
    readUtf8File(path).step(v => pure(JSON.parse(unwrap(v))))

export const writeJsonFile = (path: string) => (value: unknown): Effect<WriteFile, void> =>
    writeUtf8File(path, JSON.stringify(value, null, 2))
```

## Why this qualifies

- DRY: 3 read consumers + 4 write consumers, both past the
  second-consumer bar, and the two sides share the same UTF-8
  conversion symmetry.
- Separation of concerns: "the file is UTF-8 text, not bytes" is one
  decision. Today every consumer re-makes that decision by reaching for
  `utf8`/`utf8ToString` next to `readFile`/`writeFile`. The natural
  home is alongside the byte-level effects in
  `fs/effects/node`.
- Strict prerequisite for [i176](./176-json-file-effects.md): JSON
  reading/writing is "UTF-8 file + JSON parse/stringify". Lift the
  bytes layer first, then JSON becomes a one-line composition rather
  than a four-step open-coded sandwich.
- The non-JSON consumers (`djs/transpiler`,  `djs` compile output)
  benefit too — they're not covered by i176.

## Caveats / why this is an idea, not a mechanical edit

- **Return shape decision.** `readUtf8File` could return
  `Effect<ReadFile, IoResult<string>>` (preserves error info) or
  `Effect<ReadFile, string>` (unwraps internally and lets the error
  propagate via the effect runner). `djs/transpiler` needs the former
  because it converts the `IoResult` error into a domain-specific
  `ParseError`. `dev/version` and `dev` `unwrap` immediately. Going
  with `IoResult<string>` keeps both call patterns intact; the
  `unwrap` variant can be a second helper if it turns out to be
  common.
- **Where it lives.** `fs/effects/node/module.f.ts` is the
  natural home (it's where `readFile`/`writeFile` live), but importing
  `utf8`/`utf8ToString` from `fs/text` creates a new dependency edge
  from `effects` to `text`. Verify there's no cycle (today `text` does
  not import `effects`; the edge should be clean). If a cycle exists,
  fall back to a new module like `fs/text/file/module.f.ts` or
  `fs/effects/node/utf8/module.f.ts`.
- **Land before i176.** If i176 is implemented first by inlining the
  UTF-8 sandwich into `readJsonFile`/`writeJsonFile`, the non-JSON
  consumers (`djs/transpiler`, `djs` compile, `dev/module`'s allFiles
  loader) still benefit from i198. Doing i198 first means i176 becomes a
  trivial composition.

## Related

- [i176](./176-json-file-effects.md) — the same shape one layer up,
  for JSON-specific I/O. Becomes a one-line composition over the
  helpers proposed here.
- i192 — same spirit: lift recurring
  effect sandwiches into named helpers next to the primitive effects.
- `fs/effects/node/module.f.ts:62` — `readFile` effect.
- `fs/effects/node/module.f.ts:90` — `writeFile` effect.
- `fs/text/module.f.ts:40` — `utf8`/`utf8ToString`.
