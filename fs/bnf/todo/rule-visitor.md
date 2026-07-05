## rule-visitor. Share the `Rule` three-way discrimination via a visitor in `bnf/data`

**Priority:** P4
**Status:** open

### Problem

The `typeof rule === 'number'` → `rule instanceof Array` → `else` (variant)
discrimination over the data `Rule` ADT is hand-rolled at four sites:

- `fs/bnf/data/module.f.ts:104-116` — `data()` (over `DataRule`, adds the
  `'string'` case)
- `fs/bnf/descent/module.f.ts:67-92` — `emptyTagMapAdd`
- `fs/bnf/descent/module.f.ts:121-160` — `descentParser`'s inner `f`
- `fs/bnf/ll1/module.f.ts:116-157` — `dispatchRule`

That this is a maintenance liability is already visible in
[667-bnf-repeat-flatten](./667-bnf-repeat-flatten.md), whose task list says
*"Add the `typeof rule === 'string'` branch to every dispatch site
(`dispatchMap`, `emptyTagMapAdd`, `descentParser`, `parserRuleSet`)"* —
adding one grammar shape requires four parallel edits, each re-deriving the
same discriminator.

### Proposal

Add a visitor over the data `Rule` ADT in `fs/bnf/data/module.f.ts` (the
module that owns the type), mirroring the proven `visit` pattern in
`fs/types/rtti/common`:

```ts
export type RuleVisitor<R> = {
    readonly terminal: (r: TerminalRange) => R
    readonly sequence: (s: Sequence) => R
    readonly variant: (v: Variant) => R
}
export const matchRule = <R>(v: RuleVisitor<R>) => (rule: Rule): R =>
    typeof rule === 'number' ? v.terminal(rule)
    : rule instanceof Array ? v.sequence(rule)
    : v.variant(rule)
```

`emptyTagMapAdd`, `descentParser`'s `f`, and `dispatchRule` each become one
`matchRule({ terminal, sequence, variant })` call. When
[667-bnf-repeat-flatten](./667-bnf-repeat-flatten.md) lands, `repeat` becomes
a single new visitor member — the compiler then forces every backend to
handle it, instead of four manual edits.

Keep it exactly this narrow: a discriminator, not a recursion scheme —
each call site keeps its own recursion/accumulator structure.

### Tasks

- [ ] Add `RuleVisitor`/`matchRule` to `fs/bnf/data/module.f.ts` with proof
      coverage.
- [ ] Rewrite the three backend dispatch sites (and `data()` if the
      `DataRule` variant with the `'string'` case folds in cleanly — it may
      need its own `DataRuleVisitor` or stay as-is).
- [ ] `npx tsc`, `fjs t`.

### Related

- [667-bnf-repeat-flatten](./667-bnf-repeat-flatten.md) — the four-site
  lockstep edit this removes.
- [nullable-analysis-shared](./nullable-analysis-shared.md) — the shared
  nullability pass is a natural first consumer.
- `fs/types/rtti/common/module.f.ts` — existing `visit` precedent.
