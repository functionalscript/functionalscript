# 665-bnf-comma-join-combinator. `bnf`: hoist the `commaJoin0Plus` delimited-list combinator

**Priority:** P4
**Status:** done

## Problem

The same "delimited, comma-separated list" grammar combinator is written out
**three times**, byte-for-byte identical:

```ts
// fs/bnf/testlib.f.ts:171
const commaJoin0Plus = ([open, close]: string, a: Rule) => [
    open,
    ws,
    join0Plus([a, ws], [',', ws]),
    close,
]
```

```ts
// fs/bnf/data/proof.f.ts:358   (inside the first test case)
const commaJoin0Plus = ([open, close]: string, a: Rule) => [
    open,
    ws,
    join0Plus([a, ws], [',', ws]),
    close,
]
```

```ts
// fs/bnf/data/proof.f.ts:547   (inside the second test case)
const commaJoin0Plus = ([open, close]: string, a: Rule) => [
    open,
    ws,
    join0Plus([a, ws], [',', ws]),
    close,
]
```

All three are the same function with the same body. Each one builds the classic
JSON-style "`open` … items separated by `,` … `close`" rule by wrapping the
existing `join0Plus` combinator (`fs/bnf/module.f.ts:256`) with leading/trailing
whitespace and the open/close delimiters. The two-character `[open, close]`
string destructuring (`'[]'` → `'['`, `']'`; `'{}'` → `'{'`, `'}'`) is a neat
idiom that is currently re-derived at every site.

`fs/bnf/module.f.ts` already exports a family of rule combinators that this one
belongs to — `option` (:214), `repeat0Plus` (:230), `repeat1Plus` (:240),
`join1Plus` (:248), `join0Plus` (:256), `repeat` (:264). `commaJoin0Plus` is the
natural next member of that family; it is the only one that lives copy-pasted in
consumer scope instead of in the shared module.

## Proposal

Add the combinator to `fs/bnf/module.f.ts` next to `join0Plus`, parameterized
over the whitespace rule (whitespace is a per-grammar choice, so it stays an
argument rather than being baked in):

```ts
/** A `separator`-free delimited list: `open ws (item ws)(, ws item ws)* close`. */
export const commaJoin0Plus =
    (ws: Rule) =>
    ([open, close]: string, item: Rule): Sequence =>
        [open, ws, join0Plus([item, ws], [',', ws]), close]
```

Each of the three sites then drops its local copy and calls
`commaJoin0Plus(ws)('[]', value)` with its own `ws` definition, e.g.:

```ts
const ws = repeat0Plus(set(' \n\r\t'))
const cj = commaJoin0Plus(ws)
const value = () => ({
    array: cj('[]', value),
    object: cj('{}', [string, ws, ':', ws, value]),
    ...
})
```

## Why this qualifies

- **DRY:** three real, identical copies — well past AGENTS.md's "second real
  consumer" bar. The combinator family in `bnf/module.f.ts` is exactly where
  shared rule builders are meant to live ("when two or more modules share an
  algorithm … extract a parameterized factory into a shared module").
- **Separation of concerns:** a reusable grammar combinator is conceptually part
  of the BNF vocabulary, not of any one test. Hoisting it documents the idiom
  (delimited comma list with whitespace) once.
- **Maintainability:** any extension to the pattern (e.g. an optional trailing
  comma) is a one-line change in one place instead of three.

## Tasks

- [ ] Add `commaJoin0Plus` to `fs/bnf/module.f.ts` with JSDoc, beside `join0Plus`.
- [ ] Replace the three local copies (`fs/bnf/testlib.f.ts:171`,
      `fs/bnf/data/proof.f.ts:358`, `fs/bnf/data/proof.f.ts:547`) with calls to it.
- [ ] Register no new module (this is a new export on an existing module — no
      `deno.json` change needed).
- [ ] Ensure `npm test` (BNF proofs) still passes; the new export needs its own
      proof coverage, which the existing three call sites already exercise.

## Caveats

- All three current consumers are **test/proof** code, so the immediate payoff is
  test readability plus a documented combinator — not production-path savings.
  This is why it is P4, not higher. It still clears the DRY bar (3 identical
  copies) and the combinator's home is unambiguous.
- Decide whether `ws` is curried (as sketched) or passed positionally. Currying
  reads best at the call site (`const cj = commaJoin0Plus(ws)` once, then
  `cj('[]', …)`), and matches the partial-application style used elsewhere in the
  module.

## Related

- [i207-bnf-semantic-actions](./207-bnf-semantic-actions.md) — other BNF-layer
  work; unrelated to this combinator but touches the same module.
