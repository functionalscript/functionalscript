# 184. `function`: a generic comparable `min`/`max`, retiring the per-type copies

The exact same two-line "pick the smaller / larger of two values" algorithm is
written out in two modules, differing only in the element type.

```ts
// fs/types/function/operator/module.f.ts:48
export const min: Reduce<number>
    = a => b => a < b ? a : b

export const max: Reduce<number>
    = a => b => a > b ? a : b
```

```ts
// fs/types/bigint/module.f.ts:215
export const min = (a:bigint) => (b: bigint): bigint =>
    a < b ? a : b

// fs/types/bigint/module.f.ts:224
export const max = (a: bigint) => (b: bigint): bigint =>
    a < b ? b : a
```

Both pairs are real, consumed code, not dead helpers:

| function | consumer |
|---|---|
| `operator.min`/`max` | `fs/types/number/module.f.ts:8` (`reduce(minOp)`/`reduce(maxOp)`) |
| `bigint.min`/`max` | `fs/types/bit_vec/module.f.ts:24`, `fs/asn.1/module.f.ts:71` (`max`) |

The only difference is the literal element type. `max` is even spelled two ways
(`a > b ? a : b` vs `a < b ? b : a`) that are equivalent for a total order.

## Proposed abstraction

`fs/types/function/compare/module.f.ts` already owns the comparable vocabulary —
`Cmp1 = boolean | string | number | bigint`, `Cmp2<A, B>`, and `cmp`. Define
`min`/`max` there with the **same technique `cmp` uses** — the `Cmp1`/`Cmp2`
generic signature plus the `as any` relational compare — and keep the names
`min`/`max`:

```ts
// fs/types/function/compare  (mirrors `cmp`)
export const min = <A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B): A | B =>
    a as any < b ? a : b

export const max = <A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B): A | B =>
    a as any > b ? a : b
```

Then **retire** the old copies: delete `operator.min`/`max` and
`bigint.min`/`max`, and point their consumers (`number/module.f.ts`,
`bit_vec/module.f.ts`, `asn.1/module.f.ts`) at the single `compare.min`/`max`.

## Why this qualifies

- DRY with two real consumers (`number` via `operator`, `bit_vec`/`asn.1` via
  `bigint`) — past the second-consumer bar in `AGENTS.md`. One generic pair
  replaces both per-type copies.
- Removes the textual `min`-uses-`<` / `max`-uses-`>` inconsistency, and the same
  `min`/`max` then works for `string` ordering too (`string` already delegates to
  `compare`).

## Caveats

- The `a as any < b` form is deliberate: TypeScript rejects `<`/`>` on a
  `Cmp1`-constrained parameter, and `cmp` already establishes exactly this
  `as any` carve-out (`compare/module.f.ts:34`). So `min`/`max` follow the
  sanctioned precedent rather than introducing a new style — they are the one
  place, alongside `cmp`, where the otherwise-banned `as` is justified.
- Inference as a `reduce` accumulator: `number.min = reduce(minOp)(null)` needs
  `minOp` to resolve to `Fold<number, number>`. The doubly-generic `min` may need
  an explicit `min<number>` (or a small typed local) at that call site for
  `reduce` to infer the fold type; instantiate where inference needs help.
- Retiring removes the `min as minOp`/`max as maxOp` aliases in `number` and the
  `min`/`max` exports from `operator` and `bigint`; update those import sites.
- Behavior-preserving for all callers.

## Related

- [i164](./README.md) — uncurrying state-threading accumulators; `min`/`max` are
  `Reduce`s and stay curried, so this is orthogonal.
