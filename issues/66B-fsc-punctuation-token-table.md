# 66B-fsc-punctuation-token-table. `fsc`: collapse 27 single-char punctuation rules into one table

**Priority:** P3
**Status:** done

## Problem

`fs/fsc/module.f.ts` builds the tokenizer's initial state (`init`) from a
literal array of range rules. Most of that array is 27 single-character
punctuation rules that are byte-identical except for the one character they
match and emit:

```ts
// fs/fsc/module.f.ts:83-111 (excerpt)
range('!')(() => () => [['!'], unexpectedSymbol]),
range('"')(() => () => [['"'], unexpectedSymbol]),
range('%')(() => () => [['%'], unexpectedSymbol]),
range('&')(() => () => [['&'], unexpectedSymbol]),
range("'")(() => () => [["'"], unexpectedSymbol]),
range('(')(() => () => [['('], unexpectedSymbol]),
// … 21 more identical rows …
range('}')(() => () => [['}'], unexpectedSymbol]),
range('~')(() => () => [['~'], unexpectedSymbol]),
```

Every one of these rows has the exact shape

```ts
range(C)(() => () => [[C], unexpectedSymbol])
```

— match the single ASCII character `C`, emit `C` as a one-character token, and
fall back to `unexpectedSymbol` for whatever follows. The character `C` is the
*only* thing that varies across all 27 rows. This is the textbook "same
algorithm, one varying constant" shape that DRY targets, and it is the bulk of
the file: 27 of the ~31 rules in `init` are this single pattern, so the rule
that a character is a self-emitting punctuation token is buried under 27 copies
of identical boilerplate.

The remaining rules in the array are genuinely distinct and should stay as they
are:

- `codePointRange(one(terminal))(toInit)` — the end-of-input rule (`:81`).
- `rangeSet(['\t', ' ', '\n', '\r'])(toInit)` — whitespace (`:82`).
- `rangeSet(['$', '_', 'AZ', 'az'])(() => c => [[fromCharCode(c)], …])` —
  identifier characters, which emit the *matched* code point, not a fixed
  literal (`:85`).
- `range('09')(() => a => [[fromCharCode(a)], …])` — digits, same (`:97`).

## Proposal

Name the repeated shape once as a module-scope helper (it captures no local
state, so it belongs at module scope per `AGENTS.md`) and drive the 27 rows
from a single string of the punctuation characters:

```ts
const single = (c: string): State<undefined> =>
    range(c)(() => () => [[c], unexpectedSymbol])

// "!\"%&'()*+,-./:;<=>?[]^`{|}~" — all 27 single-char punctuation tokens.
// (Double-quoted so the apostrophe is literal; the backtick is fine unescaped.)
const punctuation = "!\"%&'()*+,-./:;<=>?[]^`{|}~"
```

Then `init` becomes:

```ts
export const init: ToResult = create([
    codePointRange(one(terminal))(toInit),
    rangeSet(['\t', ' ', '\n', '\r'])(toInit),
    ...[...punctuation].map(single),
    rangeSet(['$', '_', 'AZ', 'az'])(() => c => [[fromCharCode(c)], unexpectedSymbol]),
    range('09')(() => a => [[fromCharCode(a)], unexpectedSymbol]),
])(undefined)
```

This collapses ~27 lines to two declarations plus one spread, with no behavioral
change: `reduce`/`rangeMapMerge` is order-independent and each punctuation
character still maps to its own one-character self-emitting rule.

## Why this qualifies

- **DRY.** 27 copies of one rule shape, far past the second-consumer bar. The
  varying part (the character) is data; the structure is constant.
- **Readability.** The reader sees one helper and one alphabet string instead of
  scanning 27 near-identical rows to confirm they really are all the same. If a
  punctuation token ever needs different handling, it stands out the moment it
  leaves the `single`/`punctuation` set.
- **Maintainability.** Adding or removing a punctuation token becomes a
  one-character edit to `punctuation`, not a new hand-spelled row.

## Caveats

- The emitter ignores its `state` argument, so `single` is parametric in the
  state type; annotate its result as `State<undefined>` (the type `init`'s
  `create(...)(undefined)` fixes) so the `map` produces the array element type
  the surrounding literal expects, rather than relying on widening.
- `single` is intentionally limited to the *fixed-literal* punctuation rows.
  The identifier and digit rules emit the matched code point and must keep their
  own `rangeSet` / `range('09')` form — do not fold them into `single`.

## Tasks

- [x] Add the `single` helper and `punctuation` string at module scope.
- [x] Replace the 27 punctuation rows in `init` with `...[...punctuation].map(single)`.
- [x] Confirm `fs/fsc/proof.f.ts` still passes (`fjs t`) with full branch
      coverage and `npx tsc` is clean — the `fsc` tokenizer is exercised by
      `fjs compile`.

## Related

- [i024-fsc-ts](./024-fsc-ts.md) — broader `fsc` direction; this is a localized
  cleanup independent of it.
- [i174-range-map-lexer](./174-range-map-lexer.md) — the range-map lexer
  machinery (`range`, `rangeSet`, `rangeMapMerge`) these rules plug into.
