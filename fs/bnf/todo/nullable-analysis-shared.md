## nullable-analysis-shared. Compute the nullable/empty-tag analysis once, in `bnf/data`

**Priority:** P3
**Status:** open

### Problem

Both parser backends independently derive the same grammar property — "can
this rule match empty input, and which variant tag represents the empty
match" — and their two implementations disagree on the sequence case.

`fs/bnf/descent/module.f.ts:60-93` (`emptyTagMapAdd`, exposed as
`createEmptyTagMap` at `:99-101`) computes it as a standalone recursive pass
with encoding `EmptyTagEntry = string | boolean`:

```ts
if (typeof rule === 'number') {
    return [ruleSet, { ...map, [name]: false }, false]
} else if (rule instanceof Array) {
    let emptyTag: EmptyTagEntry = rule.length == 0
    for (const item of rule) {
        ...
        if (emptyTag === false) { emptyTag = itemEmptyTag !== false }
    }
    ...
} else { /* variant: emptyTag = tag of a nullable branch */ }
```

`fs/bnf/ll1/module.f.ts:112-158` (`dispatchRule`) recomputes the same
property inline while building the dispatch map, with encoding
`EmptyTag = string | true | undefined`:

```ts
} else if (rule instanceof Array) {
    let emptyTag: EmptyTag = true
    for (const item of rule) {
        ...
        emptyTag = dr.emptyTag !== undefined ? true : undefined   // AND over the prefix
    }
```

Consequences:

1. **The streaming invariant lives in two places** that must stay in sync;
   `descentParser` even carries a `getEmptyTag` adapter
   (`descent/module.f.ts:111-114`) whose only job is translating `false` to
   `undefined`, i.e. converting between the two encodings.
2. **The implementations diverge on sequences.** ll1 computes the standard
   definition — a sequence is nullable iff *every* item is nullable (once
   `emptyTag` becomes `undefined` it stays `undefined`). descent's loop only
   updates `emptyTag` while it is `false`, so once the *first* item turns out
   nullable the result is pinned to `true` regardless of later non-nullable
   items. For a sequence `[nullable, nonNullable]` descent reports nullable,
   ll1 reports not nullable. In `descentParser` the value only feeds the
   reported AST tag at EOF/failure (`descent/module.f.ts:122-124,148-149`),
   so the impact is subtle — but two "same" analyses silently disagreeing is
   exactly the failure mode duplication invites.

### Proposal

Move a single nullability pass into `fs/bnf/data/module.f.ts` — the module
that already owns `RuleSet` — as

```ts
export type EmptyTag = string | true | undefined
export const emptyTagMap = (ruleSet: RuleSet): StringMap<string, EmptyTag> => ...
```

using ll1's encoding (no adapter needed) and the standard AND semantics for
sequences (a sequence is nullable iff all items are nullable), with a proof
case covering `[nullable, nonNullable]` to pin the resolved semantics down.

Then:

- `descent` deletes `emptyTagMapAdd` / `createEmptyTagMap` / `getEmptyTag`
  and re-exports or imports `emptyTagMap` (its `proof.f.ts` calls
  `createEmptyTagMap` seven times, so keep a re-export or update the proof).
- `ll1`'s `dispatchRule` reads `emptyTag` from the precomputed map instead of
  threading `let emptyTag` through its build loop — the dispatch-merge logic
  stays, only the nullability *derivation* is deleted. This also removes the
  `let`-mutation smell, the same one
  [669-bnf-data-shared-helpers](./669-bnf-data-shared-helpers.md) flags in
  descent's copy.
- While unifying, confirm which sequence semantics the descent proofs
  actually depend on; if any proof relies on descent's first-item behavior,
  that is a bug capture, not a feature to preserve.

### Tasks

- [ ] Add `emptyTagMap` (encoding `string | true | undefined`, AND semantics
      for sequences) to `fs/bnf/data/module.f.ts` with proof coverage
      including a `[nullable, nonNullable]` sequence.
- [ ] Replace `createEmptyTagMap`/`getEmptyTag` in `fs/bnf/descent` with the
      shared pass; update `fs/bnf/descent/proof.f.ts` and the module JSDoc.
- [ ] Drop the inline `emptyTag` derivation from `dispatchRule` in
      `fs/bnf/ll1`; read the precomputed map instead.
- [ ] `npx tsc`, `fjs t`; verify `fs/djs/tokenizer` (a `descentParser`
      consumer) still passes.

### Related

- [669-bnf-data-shared-helpers](./669-bnf-data-shared-helpers.md) — flags the
  `let`-mutation in `emptyTagMapAdd`; subsumed on the descent side by this
  extraction.
- [rule-visitor](./rule-visitor.md) — the shared pass becomes one instance of
  the proposed `Rule` visitor.
