## Retain failure information in the descent parser

**Priority:** P3
**Status:** open

### Problem

A failed `descentParser` match reports *that* the input was rejected and nothing
usable about where. Two mechanisms in `fjs/bnf/descent/module.f.ts` destroy the
information:

1. **A failed result carries no matched symbols.** Every `mrFail` call site
   passes an empty sequence (`:112`, `:125`, `:129`, `:141`, `:162`), so a failed
   `DescentMatchResult` is `[{ tag, sequence: [] }, false, idx]`. On a failed
   sequence item the accumulated `seq` is discarded for `[]` (`:162`) and that
   empty failure propagates outward through every enclosing sequence. Nothing in
   the result identifies the offending rule, and no `CodePointMeta` survives — so
   the caller cannot recover the metadata of a single consumed symbol.
2. **`idx` rewinds.** `:162` returns `frame.startIdx`, the start of the enclosing
   sequence, rather than the position where matching stopped. Nested failures
   rewind repeatedly, so a top-level failure can report index 0.

`DescentMatchResult<T> = readonly[AstRuleMeta<T>, boolean, number]` (`:29`) has
nowhere to carry the missing facts in any case.

**This is not a live mis-reporting bug in today's consumers.** `tokenizeJs`
(`fjs/djs/tokenizer/module.f.ts:530-534`) derives its error position from `len`
when `len !== cp.length`, and for the token grammar — a repeat that matches a
prefix and then stops — that is a *successful* match's consumed length, not a
failure index. Probed with `'abc @'`, `'a\nb\n@'`, `'{ "x": 1 } @'` and
`'let x = #'`, it reports the exact line and column of the bad character in all
four. The gap bites when the whole match genuinely fails, which is the normal
case for a grammar that must consume its entire input.

### Proposal

Track the furthest position reached across the whole match, plus the terminals
expected there, and return it alongside the result.

The furthest position is monotone — it only ever advances, and unlike `idx` it is
never rewound by a failing frame — so it threads through the driver loop as a
single value rather than per-frame state:

```ts
export type DescentFailure = {
    /** Furthest symbol index reached by any attempted match. */
    readonly idx: number
    /** Terminals that would have allowed progress at `idx`. */
    readonly expected: readonly TerminalRange[]
}
```

Two candidate shapes for exposing it, to be settled when implementing:

- widen the result to `readonly[AstRuleMeta<T>, boolean, number, DescentFailure]`,
  which every consumer's destructuring must then be updated for; or
- return a record instead of a tuple, which is the better API but a larger
  breaking change.

`expected` is the set worth having for messages ("expected `,` or `}`"), but it
is separable: the furthest `idx` alone already turns "rejected" into "rejected at
this token", and a first cut may ship only that.

Because the furthest index points at a symbol, the caller pairs it with that
symbol's metadata to build a real source position — which is what
[new-parser](../../todo/new-parser.md) needs, and why that issue is blocked on
this one.

### Tasks

- [ ] Thread the furthest reached index through the driver loop
- [ ] Decide the result shape (widened tuple vs. record) and update consumers —
      `fjs/djs/tokenizer`, `descentParserCpOnly`, and the proofs
- [ ] Collect expected terminals at the furthest index, or record why it is
      deferred
- [ ] Proof coverage for a failing match: assert the reported index is the
      furthest position, not the enclosing rule's start
- [ ] `npx tsc`, `fjs t`

### Related

- [new-parser](../../todo/new-parser.md) — the consumer blocked on this; its
  proposal item 4 reports error positions as metadata ranges and cannot do so
  while a failed match carries no metadata
- [../README.md](../README.md) — the backend being changed
