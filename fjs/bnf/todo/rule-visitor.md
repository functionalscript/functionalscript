## rule-visitor. Share `Rule` discrimination via a visitor in `bnf/data`

**Priority:** P4
**Status:** blocked
**Blocked by:**
- [Separate alphabet-specific BNF helpers](./unicode-rules.md)
- [256-bit bigint BNF symbols](./bigint-symbols.md)

### Problem

The current `Rule` discrimination is hand-rolled at several sites. Today it is
based on the pre-migration representation (`typeof rule === 'number'`, array,
otherwise variant), while `DataRule` also has a string-specific path.

That is a maintenance liability because every new or changed rule shape requires
parallel edits across the parser backends. The `Repeat` rule kind demonstrated
it: adding it meant a new dispatch branch at every site, kept honest only by the
shared `isRepeat` discriminator it introduced.

The surrounding BNF work now changes those assumptions before this TODO can be
implemented:

- the alphabet split removes raw `string` as a generic `DataRule` / `Rule` case;
- the bigint symbol/range migration changes the current number-based terminal
  representation and may change how terminal rules are discriminated.

Therefore the visitor must be designed against the **final post-migration `Rule`
union**, not against today's `number | string` implementation details.

### Proposal

After the alphabet and terminal-representation migrations settle the generic
`Rule` union, add a visitor in `fjs/bnf/data/module.f.mjs` (the module that owns the
type), mirroring the proven `visit` pattern in `fjs/types/rtti/common`.

Conceptually the visitor exposes the semantic rule cases:

```ts
export type RuleVisitor<R> = {
    readonly terminal: (r: TerminalRange) => R
    readonly sequence: (s: Sequence) => R
    readonly variant: (v: Variant) => R
}
```

This type sketch names semantic cases only; it does not prescribe the final
runtime representation of `TerminalRange`. The concrete `matchRule`
discrimination must follow whatever final `Rule` representation the blocking
bigint/range work chooses. Do **not** preserve or reintroduce
`typeof rule === 'number'` merely for this visitor, and do not add a generic
string branch after the alphabet split removes one.

`emptyTagMapAdd`, `descentParser`'s rule matcher, and LL(1) dispatch then use the
shared visitor instead of independently re-deriving the rule discriminant. If a
future rule kind such as `Repeat` is added, it should become one new visitor
member so the type checker forces every backend to handle it.

Keep the abstraction exactly this narrow: a discriminator, not a recursion
scheme. Each call site keeps its own recursion/accumulator structure.

### Tasks

- [ ] Wait for the alphabet split and bigint terminal/range migration to settle
      the final generic `Rule` union and terminal representation.
- [ ] Define `RuleVisitor` / `matchRule` against those final discriminants in
      `fjs/bnf/data/module.f.mjs`; do not depend on the obsolete raw-string rule or
      `typeof rule === 'number'` terminal test.
- [ ] Rewrite the backend dispatch sites to use the shared visitor.
- [ ] Keep any alphabet-specific lowering outside this generic visitor.
- [ ] Absorb `isRepeat` from `fjs/bnf/data/module.f.mjs` into the visitor, so the
      repetition case has one discriminator rather than a predicate beside it.
- [ ] Add proof coverage for every final `Rule` case so a newly added case cannot
      be silently skipped by a backend.
- [ ] `npx tsc`, `fjs t`.

### Related

- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — **blocks this
  task** by removing the current generic string rule.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — **blocks this task** until
  the terminal/range representation and parser discriminants are migrated.
- [`../data/README.md`](../data/README.md#the-repeat-rule) — the `Repeat` case
  the visitor has to cover; both backends now match it iteratively.
- [nullable-analysis-shared](./nullable-analysis-shared.md) — the shared
  nullability pass is a natural consumer once the visitor exists.
- `fjs/types/rtti/common/module.f.mjs` — existing `visit` precedent.
