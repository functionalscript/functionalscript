## Additional strictness flags for `tsconfig.json`

**Priority:** P2
**Status:** wip

### Problem

[`tsconfig.json`](../tsconfig.json) enables `strict`, `exactOptionalPropertyTypes`,
`erasableSyntaxOnly`, `verbatimModuleSyntax`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `noImplicitOverride` and `isolatedModules`, but
leaves four further checking flags commented out. Nothing records whether they
were rejected or merely never tried, so each new contributor re-asks the
question.

One of them — `noUncheckedIndexedAccess` — matters beyond hygiene. It makes
every index access yield `T | undefined`, which is exactly the obligation
[AGENTS.md](../fjs/AGENTS.md) wants discharged by `assertNotNullish` rather than
by an unchecked cast. Its error sites cluster in the same modules where
[inline-type-casts.md](./inline-type-casts.md) already found `assert`
candidates: `fjs/effects/node/virtual/`, `fjs/bnf/descent/`,
`fjs/rtti/data/`, `fjs/sul/level/hash/`.

### Measurements

Error counts from `tsc --<flag>` on a clean tree (TypeScript 7.0.2), one
flag at a time. The four enabled flags are listed with the count they carried
when they were turned on; the rest are current.

| Flag | New errors | Notes |
| --- | --: | --- |
| `noImplicitReturns` | 0 | **enabled** |
| `noImplicitOverride` | 0 | **enabled** |
| `isolatedModules` | 0 | **enabled** |
| `noFallthroughCasesInSwitch` | 2 | **enabled**, after two fixes — see below |
| `noUnusedParameters` | 8 | |
| `noPropertyAccessFromIndexSignature` | 33 | |
| `noUncheckedIndexedAccess` | 212 | the one with design value, see above |
| `noUnusedLocals` | 218 | 137 `TS6196` + 81 `TS6133`, see below |

`noFallthroughCasesInSwitch` was measured at 0 when this issue was first
written; the tree had drifted to 2 by the time the flag was turned on. Both
sites were switches whose exhaustiveness TypeScript could not see, so the end of
the enclosing `case` was reachable and control would have fallen into the next
one:

- `fjs/djs/tokenizer/module.f.mjs` — `stringDecodeScan`'s `escape` state
  switches on a code point against the ASCII constants of `fjs/text/ascii`,
  which are `number`, not literal types. No such switch can ever be exhaustive
  to TypeScript, so the last clause became a `default`.
- `fjs/types/btree/set/module.f.mjs` — `switch (x.length)` over a tuple union,
  where TSGO does not narrow the length to a literal union
  ([typescript-go#4613](https://github.com/microsoft/typescript-go/issues/4613)).
  Fixed the way the same function already worked around that regression: bind
  the length, `assert` the two possible values, switch on the binding.

The two fixes are the argument for the flag: in both places a fallthrough would
have silently continued into an unrelated state rather than failing.

`noUnusedLocals` splits into two unrelated populations:

- **137 `TS6196`** — type names pulled in by a JSDoc
  `@import { … } from './types.ts'` list and never referenced. `@import` lists
  drift as a module changes and nothing catches it today; this is real dead
  weight and the only JSDoc-specific hygiene gap the audit found.
- **81 `TS6133`** — unused values, e.g. the ASN.1 universal tag constants
  (`eoc`, `bitString`, `null_`, `external`, …) kept as documentation of the tag
  space. Those are deliberate; enabling the flag forces a decision about them
  (export, drop, or annotate).

### Tasks

- [x] Enable the four low-cost flags: `noImplicitReturns`,
      `noFallthroughCasesInSwitch`, `noImplicitOverride`, `isolatedModules`.
- [ ] Enable `noUnusedParameters` (8 sites) and
      `noPropertyAccessFromIndexSignature` (33 sites) as small follow-ups.
- [ ] Take `noUncheckedIndexedAccess` as its own task, sequenced **after** the
      `assert` conversions in [inline-type-casts.md](./inline-type-casts.md) —
      the two overlap, and doing the casts first shrinks the 212.
- [ ] For `noUnusedLocals`, fix the 137 stale `@import` entries first; that is
      worth doing on its own even if the flag stays off. Decide the 81 unused
      values separately.

Each step is independently verifiable with `tsc` and `fjs t`. Re-measure
before starting one: the counts above are a snapshot, and
`noFallthroughCasesInSwitch` is the standing proof that they drift.

### Related

- [strict-static-analysis.md](./strict-static-analysis.md) — the umbrella this
  is the first step of.
- [inline-type-casts.md](./inline-type-casts.md) — the cast audit; overlaps with
  `noUncheckedIndexedAccess`.
- [eslint.md](./eslint.md) — the rules no `tsc` flag can express.
- [123-tsgo-types-node.md](./123-tsgo-types-node.md) — the other open
  `tsconfig.json` question.
