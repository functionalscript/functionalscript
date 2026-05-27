# 184. `function`: a generic comparable `min`/`max`, shared by `operator` and `bigint`

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
`Cmp1 = boolean | string | number | bigint` and `cmp` (which compares any two
`Cmp1` values). Add a generic `minBy`/`maxBy` there, expressed via `cmp` so the
relational operator never touches a bare type parameter:

```ts
// fs/types/function/compare
export const minBy = <T extends Cmp1>(a: T) => (b: T): T => cmp(a)(b) <= 0 ? a : b
export const maxBy = <T extends Cmp1>(a: T) => (b: T): T => cmp(a)(b) >= 0 ? a : b
```

Then `operator.min`/`max` and `bigint.min`/`max` become one-line typed bindings
(`export const min: Reduce<number> = minBy`, `export const min = minBy<bigint>`),
preserving their current names and signatures for every existing caller.

## Why this qualifies

- DRY with two real consumers (`number` via `operator`, `bit_vec`/`asn.1` via
  `bigint`) — past the second-consumer bar in `AGENTS.md`.
- The `cmp`-based body removes the textual `min`-uses-`<` / `max`-uses-`>`
  inconsistency and is reusable by `string` ordering too (`string` already
  delegates to `compare`).

## Caveats

- A naive `<T>(a: T) => (b: T) => a < b ? ...` does **not** type-check: TypeScript
  rejects `<` on a bare type parameter, which is why `cmp` itself uses an internal
  `as any` (`compare/module.f.ts:34`). Routing `minBy`/`maxBy` through `cmp`
  avoids introducing any new `as` cast (banned by `AGENTS.md` except `as const`).
- `operator.min: Reduce<number>` is consumed as a `reduce` accumulator; confirm
  the bound `minBy` still satisfies `Reduce<number> = Fold<number, number>` so
  `number/module.f.ts`'s `reduce(minOp)(null)` type-checks unchanged.
- Pure relocation/parameterization: no behavior change for any caller.

## Related

- [i164](./README.md) — uncurrying state-threading accumulators; `min`/`max` are
  `Reduce`s and stay curried, so this is orthogonal.
