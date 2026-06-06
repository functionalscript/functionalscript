# 168. UTF-8/UTF-16: extract the streaming code-point decoder skeleton

**Priority:** P3
**Status:** open

`fs/text/utf8/module.f.ts` and `fs/text/utf16/module.f.ts` both decode a stream
of code units into Unicode code points with the *same* end-of-input plumbing:
append a `null` EOF sentinel, run a `stateScan` whose step dispatches unit vs.
EOF, and `flat` the result. Only the per-unit transition and the leftover-state
error differ — exactly the additive delta DRY targets.

## The shared skeleton

```ts
// utf8/module.f.ts:223
const utf8ByteOrEofToCodePointOp: StateScan<ByteOrEof, Utf8State, List<I32>> = (input, state) =>
    input === null ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(input, state)
// utf8/module.f.ts:234
const eofList: readonly ByteOrEof[] = [null]
// utf8/module.f.ts:242
export const toCodePointList: (input: List<U8>) => List<I32> = (input) =>
    flat(stateScan(utf8ByteOrEofToCodePointOp)(null)(flat([input, eofList])))
```

```ts
// utf16/module.f.ts:304
const utf16ByteOrEofToCodePointOp: StateScan<WordOrEof, Utf16State, List<CodePoint>>
    = (input, state) => input === null ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(input, state)
// utf16/module.f.ts:320
const eofList: List<WordOrEof> = [null]
// utf16/module.f.ts:338
export const toCodePointList = (input: List<U16>): List<CodePoint> =>
    flat(stateScan(utf16ByteOrEofToCodePointOp)(null)(flat([input, eofList])))
```

The two `eofList = [null]` sentinels are identical, the `…ByteOrEofToCodePointOp`
combinators are identical modulo the names they call, and both `toCodePointList`
bodies are character-for-character the same: `flat(stateScan(op)(null)(flat([input, eofList])))`.

The EOF ops are also structurally the same — "empty if no pending state, else a
single error code from the leftover state":

```ts
// utf8/module.f.ts:207
const utf8EofToCodePointOp = (state) => [state === null ? null : [utf8StateToError(state)], null]
// utf16/module.f.ts:267
const utf16EofToCodePointOp = (state) => [state === null ? empty : [state | errorMask], null]
```

## The deltas

1. The per-unit step (`utf8ByteToCodePointOp` vs `utf16ByteToCodePointOp`) —
   genuinely different bit-twiddling (variable-length continuation bytes vs.
   fixed surrogate pairs), correctly **not** shared.
2. The initial scan state — both `null`.
3. How a leftover state becomes an error code (`utf8StateToError(state)` vs
   `state | errorMask`).

## Proposed abstraction

A `decoder` factory in a shared module (e.g. `fs/text/code_point/module.f.ts`,
the natural home for the code-point contract) parameterized by the two
direction-specific steps:

```ts
const decoder = <Unit, S, Cp>(
    byteOp: StateScan<Unit, S, List<Cp>>,
    eofOp: (state: S) => readonly [List<Cp>, S],
    init: S,
): (input: List<Unit>) => List<Cp> => {
    const op: StateScan<Unit | null, S, List<Cp>> =
        (input, state) => input === null ? eofOp(state) : byteOp(input, state)
    return input => flat(stateScan(op)(init)(flat([input, [null]])))
}
```

`utf8.toCodePointList = decoder(utf8ByteToCodePointOp, utf8EofToCodePointOp, null)`
and likewise for UTF-16. This removes the duplicated `eofList`, the duplicated
`…ByteOrEofToCodePointOp` wrapper, and the duplicated `toCodePointList` body from
both modules.

### Ride-along: `errorMask`

The error-tag constant is duplicated verbatim and is defined in only these two
files:

```ts
// utf8/module.f.ts:43  and  utf16/module.f.ts:79
const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000
```

It is part of the shared code-point/error-tagging contract between the two
decoders and belongs in the same shared module.

### Ride-along: encode side

The reverse direction is already a one-liner in each module and follows the same
shape — `fromCodePointList = flatMap(codePointToXxx)`
(`utf8/module.f.ts:108`, `utf16/module.f.ts:163`). A matching
`encoder = flatMap` is optional; bundle it only if the decode refactor lands.

## Why this qualifies

- Two real, independent consumers exist today (`utf8` and `utf16`), both
  re-exported through `fs/text/module.f.ts`. This satisfies the
  "second real consumer" rule in `AGENTS.md`.
- The lexical/leaf layer is already shared elsewhere in the same spirit (the
  tokenizer core in [i157](./157-json-djs-shared-core.md)); the EOF-streaming
  wrapper is the analogous shared layer here.

## Related

- [i157](./157-json-djs-shared-core.md) — same pattern (shared engine, additive
  per-consumer delta) one layer up in the JSON/DJS stack.
