## 66t-monoid-fold. `fold` companion for `Monoid` — collapse hand-paired `reduce(op)(identity)` calls

**Priority:** P4
**Status:** open

### Problem

Four exported list reductions are each the same shape — fold a `List<T>`
with an associative operation seeded at that operation's identity —
differing only in the (operation, identity) pair:

- `fs/types/number/module.f.ts:11-12` — `sum = reduce(addition)(0)`
- `fs/types/bigint/module.f.ts:48-49` — `sum = reduce(addition)(0n)`
- `fs/types/bigint/module.f.ts:65-66` — `product = reduce(multiple)(1n)`
- `fs/types/string/module.f.ts:23-30` — `concat = reduce(concatOp)` where
  the private `reduce` hardcodes the `''` seed

Each pair — `(addition, 0)`, `(addition, 0n)`, `(multiple, 1n)`,
`(concatOp, '')` — is exactly a `Monoid<T>` (`identity` + associative
`operation`), the structure already defined in
`fs/types/monoid/module.f.ts`. That module ships `repeat`, which consumes
`{ identity, operation }`, but no fold companion — so every caller re-pairs
the identity with its operation by hand, and the *"which identity belongs
to which operation"* knowledge is scattered across four modules. Inline
monoid literals elsewhere echo the same gap:
`prime_field/module.f.ts` (`repeat({ identity: 1n, operation: mul })`) and
`bit_vec/module.f.ts` (`mRepeat({ identity: empty, operation: lsb.concat })`).

Note `number.min`/`max` are *not* candidates: their `null` seed is an
`Option` semilattice, not a `Monoid<number>`.

### Proposal

Add the fold as the natural sibling of `repeat` in
`fs/types/monoid/module.f.ts`:

```ts
import { reduce, type List } from '../list/module.f.ts'

export const fold = <T>({ identity, operation }: Monoid<T>): (list: List<T>) => T =>
    reduce(operation)(identity)
```

(`monoid` → `list` introduces no cycle: `list` imports only
`function/operator`.) Then define the monoid instances where their
operations live (e.g. `addition`/`multiple` monoids next to the operators,
or exported from the numeric modules) and rewrite:

- `bigint.sum = fold(additionMonoid)`, `bigint.product = fold(multiplicationMonoid)`
- `number.sum = fold(...)`
- `string.concat = fold(concatMonoid)` (drops the private seeded `reduce`)

The exported monoid instances also serve `repeat` call sites that currently
build literals inline.

### Tasks

- [ ] Add `fold` to `fs/types/monoid/module.f.ts` with proof coverage.
- [ ] Export monoid instances for bigint addition/multiplication, number
      addition, and string concatenation next to their operations.
- [ ] Rewrite the four reductions; drop `string`'s private seeded `reduce`.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- `fs/types/monoid/module.f.ts` — `repeat`, the existing `Monoid` consumer.
- `fs/types/prime_field/module.f.ts`, `fs/types/bit_vec/module.f.ts` —
  inline monoid literals that the exported instances would serve.
