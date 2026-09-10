## symbol-domain-owner. Three `isSymbol` copies, and the weakest one guards the front door

**Priority:** P3
**Status:** open

### Problem

The symbol domain — "a terminal symbol is a non-negative safe integer, and
`-0` is not one" — is restated in three modules, each with its own JSDoc
rationale, and the copies disagree (a fourth, in the retired `ebnf/map`,
went with it):

```js
// fjs/ebnf/module.f.mjs:34 — the front end: accepts -0
const isSymbol = a => isSafeInteger(a) && a >= 0
// fjs/ebnf/data/module.f.mjs:165
const isSymbol = n => isSafeInteger(n) && n >= 0 && !sameValue(n, -0)
// fjs/ebnf/ll1/module.f.mjs:52
const isSymbol = s => isSafeInteger(s) && s >= 0 && !Object.is(s, -0)
```

The divergence is a bug, not just noise: the front end's copy — the one an
author's mistake reaches first — is the only one that accepts `-0`, which
`data` refuses explicitly because its memo `Map` keys by SameValueZero.
The constructor it guards that can actually receive `-0` is `rangeEncode`,
the one front-end constructor taking numeric endpoints (`range` and `set`
derive their symbols from string code points, which are never `-0`). So
`rangeEncode(-0, …)` passes the constructor and is refused three layers
down, far from the call site that wrote it.

EOF's *numeric sentinel* is written independently twice: `data` lowers EOF
to the terminal range `eofSet = [-1, 0]` (`:150`) and `ll1` synthesizes the
input symbol `eofSymbol = -1` (`:42`) — the same `-1` with no shared
declaration tying them together. The front end's `eof = null`
(`module.f.mjs:165`) is **not** a third copy: it is a deliberate public
representation, because a `DataRule` reserves every number for ordinary
symbols; it stays as it is.

### Proposal

One owner for the domain predicate and the numeric EOF sentinel: `ll1`
imports the sentinel, `data` derives its `eofSet` range from it, and each
layer keeps its own representation on top (the front end's public `null`,
`data`'s terminal range, `ll1`'s input symbol — those are contracts, not
copies). The migration that built `fjs/ebnf/`
([DESIGN.md §11](../../../doc/DESIGN.md#11-build-the-replacement-beside-the-module-it-replaces)) reserved
the module `terminal/` for this — "the symbol domain, EOF, integer helpers
over range_set" — and finished without building it, so this issue is
`terminal/`'s: the concrete inventory of what moves there, plus the
front-end `-0` fix that should not wait for the module. What else
`terminal/` owes is named where it is relied on: the domain set `[0]`, `eof`
and the integer helpers over `fjs/types/range_set` values in
[ebnf-range-set](../terminal/todo/ebnf-range-set.md), and the base
[unicode-rules](../unicode/todo/unicode-rules.md)'s text adapter is built
on. If `terminal/` is not imminent, the interim owner can be `data` (the
strictest existing copy) with the other two importing it.

### Tasks

- [ ] Pick the owner (`terminal/` per the migration, or `data` interim);
      export `isSymbol` and the numeric EOF sentinel; delete the other
      `isSymbol` copies, derive `data`'s `eofSet` and `ll1`'s `eofSymbol`
      from the sentinel, leave the front end's `eof = null` as is.
- [ ] `rangeEncode` now refuses `-0` at the constructor — add a
      `rangeEncode(-0, …)` refusal proof case (the string-driven `range`/
      `set` cannot supply `-0`, so no case is possible or needed there).
- [ ] `tsc`, `fjs t`.

### Related

- [ebnf-range-set](../terminal/todo/ebnf-range-set.md) — the terminal as
  a range set, which is what `terminal/` builds its helpers over; this
  issue names the three existing copies the module replaces.
- [unicode-rules](../unicode/todo/unicode-rules.md) — the text adapter
  blocked on `terminal/`.
- [DESIGN.md §11](../../../doc/DESIGN.md#11-build-the-replacement-beside-the-module-it-replaces) — the
  migration that reserved the module.
- [repeat-bounds.md](./repeat-bounds.md),
  [malformed-utf16-symbols.md](./malformed-utf16-symbols.md) — both add
  front-end domain checks; built on the shared predicate they strengthen
  one owner instead of adding a fifth copy.
