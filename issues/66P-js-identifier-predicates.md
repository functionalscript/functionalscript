# 66P-js-identifier-predicates. Lift the JS lexical predicates out of `emergent_testing`

**Priority:** P4
**Status:** open

## Problem

`fs/emergent_testing/module.f.ts` carries four predicates that have nothing to do
with running or reporting tests — they encode **JavaScript lexical rules** about
strings:

```ts
// fs/emergent_testing/module.f.ts:263-274
const isAlpha = (c: string): boolean =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_' || c === '$'

const isDigit = (c: string): boolean => c >= '0' && c <= '9'

/** Returns `true` if `s` is a non-negative decimal integer without a leading zero. */
export const isInteger = (s: string): boolean =>
    s.length > 0 && [...s].every(isDigit) && (s === '0' || s[0] !== '0')

/** Returns `true` if `s` is a valid JS identifier (ASCII subset: `[A-Za-z_$][A-Za-z0-9_$]*`). */
export const isIdentifier = (s: string): boolean =>
    s.length > 0 && isAlpha(s[0]) && [...s.slice(1)].every(c => isAlpha(c) || isDigit(c))
```

They exist only to let the reporter decide how to render a JS property-access
chain — identifier keys as `.name`, integer keys as `[N]`, everything else as a
quoted `["…"]`:

```ts
// :276-280
const fmtKey = (k: string | null): string =>
    k === null ? '()'
    : isInteger(k) ? `[${k}]`
    : isIdentifier(k) ? `.${k}`
    : `[${JSON.stringify(k)}]`
```

This is the one place in the module whose subject is the **lexical shape of a
string**, not test orchestration. It violates separation of concerns: the test
framework's module header (`:1-12`) describes "running and reporting
FunctionalScript tests" and two execution paths — character classification is
not part of that contract, yet `isInteger` / `isIdentifier` are even exported
from it (`:269`, `:273`), so the `emergent_testing` public surface now advertises
JS-lexis helpers as if they were part of the test API.

### The same rule already exists in another representation

`[A-Za-z_$][A-Za-z0-9_$]*` is not new to the codebase. `fs/js/tokenizer` already
encodes exactly this identifier rule — but over **code-point ranges** rather than
strings:

```ts
// fs/js/tokenizer/module.f.ts:206-211, 239
const rangeIdStart = [
    latinSmallLetterRange,
    latinCapitalLetterRange,
    one(lowLine),       // '_'
    one(dollarSign),    // '$'
]
const rangeId = [digitRange, ...rangeIdStart]
```

So the project states "what an identifier character is" twice, in two different
encodings (string comparison in `emergent_testing`, `Range` arrays in
`js/tokenizer`), with no shared source of truth. The two can silently drift —
e.g. if the tokenizer's identifier set is ever widened, the reporter's
`isIdentifier` will keep using the old set and quietly mis-render keys. This is
the latent-DRY tail of a separation-of-concerns problem: the knowledge has no
home, so it gets re-derived wherever it is needed.

## Proposal

Move the four predicates to a small module whose subject *is* JS lexis, and have
`emergent_testing` import them. The rules are JS-specific (the `_`/`$` start
characters and the no-leading-zero integer rule are JavaScript/JSON conventions,
not generic string operations), so the natural home is the `fs/js` namespace
rather than `fs/types/string`:

```ts
// fs/js/identifier/module.f.ts (new)
/**
 * String-level JavaScript lexical predicates: recognise an ASCII identifier and
 * a non-negative decimal integer. Shared by code that renders or recognises JS
 * member-access syntax.
 *
 * @module
 */
const isAlpha = (c: string): boolean =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_' || c === '$'

const isDigit = (c: string): boolean => c >= '0' && c <= '9'

export const isInteger = (s: string): boolean =>
    s.length > 0 && [...s].every(isDigit) && (s === '0' || s[0] !== '0')

export const isIdentifier = (s: string): boolean =>
    s.length > 0 && isAlpha(s[0]) && [...s.slice(1)].every(c => isAlpha(c) || isDigit(c))
```

`emergent_testing` then drops the four definitions and imports
`isInteger` / `isIdentifier`; `fmtKey` / `fmtTerm` are unchanged. The reporter's
public surface no longer re-exports lexis helpers, and the module header again
describes only what it does.

### Why this is worth doing with a single consumer today

`AGENTS.md` separates the two motivations and explicitly allows this one:

> Separation of concerns — move logic to its natural module **even with a single
> consumer** when the logic is conceptually distinct (e.g. path manipulation
> belongs in `fs/path`, not inline in a loader). … This is different from DRY
> extraction: it is always appropriate.

So the move stands on separation of concerns alone. The DRY angle (sharing one
identifier rule with `js/tokenizer`) is a **future** consolidation, not part of
this change — the two representations differ (string vs `Range`), and unifying
them is only worth it once the shared module exists and a second consumer asks
for it. Record the relationship; do not force the unification now.

A concrete second string-level consumer is already plausible: the DJS serializer
currently quotes **every** object key —

```ts
// fs/djs/serializer/module.f.ts:96-102 — propertySerialize always calls stringSerialize(k)
```

— even though `fs/djs/README.md` lists unquoted identifier keys (`{a:5}`) as a
DJS feature on the parse side. A serializer that emits `{a: 5}` instead of
`{"a": 5}` for identifier keys would call exactly this `isIdentifier`. That work
is out of scope here, but it is the natural reason the predicate should live
somewhere reusable rather than inside the test reporter.

## Tasks

- [ ] Create `fs/js/identifier/module.f.ts` with `isInteger` and `isIdentifier`
      (private `isAlpha` / `isDigit`), carrying over the existing JSDoc.
- [ ] Add a co-located `proof.f.ts` with 100% coverage — reuse the cases already
      in `fs/emergent_testing/proof.f.ts:313-328` (they exercise both branches of
      each predicate).
- [ ] Register the new module in `deno.json`'s `exports` map.
- [ ] Replace the four definitions in `fs/emergent_testing/module.f.ts` with an
      import; confirm `isInteger` / `isIdentifier` are no longer exported from
      there unless a consumer outside the module still needs them
      (`emergent_testing/proof.f.ts` imports them today — repoint it at the new
      module).
- [ ] Run `npx tsc` and `fjs t`; confirm `emergent_testing` coverage is unaffected.

## Related

- [i666-js-tokenizer-position-layer](./666-js-tokenizer-position-layer.md) — other
  `fs/js/tokenizer` work; the tokenizer's `rangeIdStart` / `rangeId` are the
  code-point twin of these string predicates and a candidate for a future shared
  source of truth.
- [i077-property-accessor](./077-property-accessor.md) — the *language* property
  accessor operator; unrelated to rendering, but the same `.name` vs `["…"]`
  distinction surfaces there too.
