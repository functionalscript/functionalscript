# Additional strictness flags for `tsconfig.json`

**Priority:** P3
**Status:** open

### Problem

[`tsconfig.json`](../tsconfig.json) enables `strict`, `exactOptionalPropertyTypes`,
`erasableSyntaxOnly` and `verbatimModuleSyntax`, but leaves eight further
checking flags commented out. Nothing records whether they were rejected or
merely never tried, so each new contributor re-asks the question.

Four of them cost nothing today: the tree is already clean under them. Leaving
them off means the property is unenforced and can silently regress.

One of them — `noUncheckedIndexedAccess` — matters beyond hygiene. It makes
every index access yield `T | undefined`, which is exactly the obligation
[AGENTS.md](../fjs/AGENTS.md) wants discharged by `assertNotNullish` rather than
by an unchecked cast. Its error sites cluster in the same modules where
[inline-type-casts.md](./inline-type-casts.md) already found `assert`
candidates: `fjs/effects/node/virtual/`, `fjs/bnf/descent/`,
`fjs/types/rtti/data/`, `fjs/sul/level/hash/`.

### Measurements

Error counts from `npx tsc --noEmit --<flag>` on a clean tree (TypeScript
7.0.2), one flag at a time:

| Flag | New errors | Notes |
| --- | --: | --- |
| `noImplicitReturns` | 0 | free |
| `noFallthroughCasesInSwitch` | 0 | free |
| `noImplicitOverride` | 0 | free |
| `isolatedModules` | 0 | free |
| `noUnusedParameters` | 8 | |
| `noPropertyAccessFromIndexSignature` | 31 | |
| `noUncheckedIndexedAccess` | 202 | the one with design value, see above |
| `noUnusedLocals` | 209 | 130 `TS6196` + 79 `TS6133`, see below |

`noUnusedLocals` splits into two unrelated populations:

- **130 `TS6196`** — type names pulled in by a JSDoc
  `@import { … } from './types.ts'` list and never referenced. `@import` lists
  drift as a module changes and nothing catches it today; this is real dead
  weight and the only JSDoc-specific hygiene gap the audit found.
- **79 `TS6133`** — unused values, e.g. the ASN.1 universal tag constants
  (`eoc`, `bitString`, `null_`, `external`, …) kept as documentation of the tag
  space. Those are deliberate; enabling the flag forces a decision about them
  (export, drop, or annotate).

### Proposal

1. Enable the four zero-cost flags now, in one commit, to lock in properties the
   tree already has: `noImplicitReturns`, `noFallthroughCasesInSwitch`,
   `noImplicitOverride`, `isolatedModules`.
2. Enable `noUnusedParameters` (8 sites) and `noPropertyAccessFromIndexSignature`
   (31 sites) as small follow-ups.
3. Take `noUncheckedIndexedAccess` as its own task, sequenced **after** the
   `assert` conversions in [inline-type-casts.md](./inline-type-casts.md) — the
   two overlap, and doing the casts first shrinks the 202.
4. For `noUnusedLocals`, fix the 130 stale `@import` entries first; that is
   worth doing on its own even if the flag stays off. Decide the 79 unused
   values separately.

Each step is independently verifiable with `npx tsc` and `fjs t`.

### Related

- [inline-type-casts.md](./inline-type-casts.md) — the cast audit; overlaps with
  `noUncheckedIndexedAccess`.
- [eslint.md](./eslint.md) — the rules no `tsc` flag can express.
- [123-tsgo-types-node.md](./123-tsgo-types-node.md) — the other open
  `tsconfig.json` question.
