## symbol-domain-owner. Four `isSymbol` copies, and the weakest one guards the front door

**Priority:** P3
**Status:** open

### Problem

The symbol domain — "a terminal symbol is a non-negative safe integer, and
`-0` is not one" — is restated in four modules, each with its own JSDoc
rationale, and the copies disagree:

```js
// fjs/ebnf/module.f.mjs:34 — the front end: accepts -0
const isSymbol = a => isSafeInteger(a) && a >= 0
// fjs/ebnf/data/module.f.mjs:165
const isSymbol = n => isSafeInteger(n) && n >= 0 && !sameValue(n, -0)
// fjs/ebnf/map/module.f.mjs:39
const isSymbol = n => typeof n === 'number' && isSafeInteger(n) && n >= 0 && !is(n, -0)
// fjs/ebnf/ll1/module.f.mjs:49
const isSymbol = s => isSafeInteger(s) && s >= 0 && !Object.is(s, -0)
```

The divergence is a bug, not just noise: the front end's copy — the one an
author's mistake reaches first — is the only one that accepts `-0`, which
`data` refuses explicitly because its memo `Map` keys by SameValueZero. So
`range` bounds involving `-0` pass the constructor and are refused three
layers down, far from the call site that wrote them.

EOF's *numeric sentinel* is written independently twice: `data` lowers EOF
to the terminal range `eofSet = [-1, 0]` (`:150`) and `ll1` synthesizes the
input symbol `eofSymbol = -1` (`:39`) — the same `-1` with no shared
declaration tying them together. The front end's `eof = null`
(`module.f.mjs:165`) is **not** a third copy: it is a deliberate public
representation, because a `DataRule` reserves every number for ordinary
symbols; it stays as it is.

### Proposal

One owner for the domain predicate and the numeric EOF sentinel: `ll1`
imports the sentinel, `data` derives its `eofSet` range from it, and each
layer keeps its own representation on top (the front end's public `null`,
`data`'s terminal range, `ll1`'s input symbol — those are contracts, not
copies). [`../../todo/ebnf-migration.md`](../../todo/ebnf-migration.md)
already reserves the module — stage 1's `terminal/` is "the symbol domain,
EOF, integer helpers over range_set" — and this issue is the concrete
inventory of what moves there, plus the front-end `-0` fix that should not
wait for the migration if the migration waits. If `terminal/` is not
imminent, the interim owner can be `data` (the strictest existing copy)
with the other three importing it.

### Tasks

- [ ] Pick the owner (`terminal/` per the migration, or `data` interim);
      export `isSymbol` and the numeric EOF sentinel; delete the other
      `isSymbol` copies, derive `data`'s `eofSet` and `ll1`'s `eofSymbol`
      from the sentinel, leave the front end's `eof = null` as is.
- [ ] The front end's `range`/`set` checks now refuse `-0` at the
      constructor — add the proof case.
- [ ] `tsc`, `fjs t`.

### Related

- [../../todo/ebnf-migration.md](../../todo/ebnf-migration.md) — stage 1's
  `terminal/` module is the planned owner; this issue names the four
  existing copies it replaces.
- [repeat-bounds.md](./repeat-bounds.md),
  [malformed-utf16-symbols.md](./malformed-utf16-symbols.md) — both add
  front-end domain checks; built on the shared predicate they strengthen
  one owner instead of adding a fifth copy.
