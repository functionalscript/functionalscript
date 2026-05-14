# 130. RTTI: `or` Optimization and Normalization

> **Status: paused — blocked by [143](./143-rtti-data.md).**
>
> All further work on this issue is on hold until the serializable data
> representation lands. The existing ad‑hoc analysis in `or` (`reduceOr` /
> `flattenOr`) will be removed; `or` will revert to a lazy, allocation-free
> constructor, and normalization will happen on the data form. See the
> _Dependencies_ section below.

Optimize and normalize `or` in [../fs/types/rtti/module.f.ts](../fs/types/rtti/module.f.ts) at schema construction time. After this pass, an `or` schema should be in a canonical form: two constructions that describe the same set of values should produce structurally identical results, and dispatch should have fewer variants to scan.

## Goals

### 1. Drop redundant subset variants

If `or` has variants `A` and `B` where `A ⊆ B` (every value `A` accepts is also accepted by `B`), `A` can be dropped — it never contributes a unique match.

Examples:
- [x] A primitive const is a subset of its primitive type: `42 ⊆ number`, `'hi' ⊆ string`, `true ⊆ boolean`.
- [ ] A narrower const tuple/struct is a subset of a wider one (matching keys/positions, narrower element types).
- [x] Any type is a subset of `unknown` — `or(unknown, ...rest)` simplifies to `unknown`.
- [x] Duplicate variants (`A ⊆ A` and `A ⊇ A`) collapse to a single variant.
- [ ] A complete set of variants that together cover a wider type collapses to that wider type:
  - `['or', true, false]` ≡ `['boolean']`.
  - `['or', ...all primitive type thunks, ...all object/array thunks]` ≡ `['unknown']` (a union of every variant that makes up `unknown` is `unknown`).

This requires generic subset utilities on `Type`:

```ts
const equal = (a: Type, b: Type): boolean => ...
const subset = (sub: Type, sup: Type): boolean => ...
```

These utilities are reusable beyond `or` optimization (see also 141). Currently `or` uses ad-hoc checks for the cases above (`Object.is`-based dedup, `'unknown'` tag check, `primitive0List` membership) instead of generic `equal`/`subset` predicates.

### 2. Flatten nested `or`

- [x] `or` variants that are themselves `or` thunks should be flattened into the outer `or`. After flattening, the analysis (subset removal, normalization) applies to the combined variants.

```ts
or(or(a, b), c)        // should normalize to: or(a, b, c)
or(a, () => ['or', b]) // should normalize to: or(a, b)
```

- [x] Flattening must work for both `or(...)` calls and manually constructed `() => ['or', ...]` thunks discovered as variants.

### 3. Normalize the canonical result

Two constructions that describe the same set must produce the same result of `or` (e.g. structurally equal output and/or the same memoized identity):

- [ ] `or(a, b)            // ≡ or(b, a)`
- [x] `or(a, a, b)         // ≡ or(a, b)`
- [x] `or(or(a, b), c)     // ≡ or(a, b, c)`
- [x] `or(unknown, 42)     // ≡ unknown`
- [x] `or(number, 42)      // ≡ number`

This implies a canonical ordering on `Type` and a stable layout for the resulting variants. The order chosen should not affect observable semantics, since redundant variants have been removed. The reordering itself is still TODO — it needs a total order on `Type` that includes thunks, which depends on the generic `equal`/`subset` predicates from goal 1.

## Dependencies

This issue is **paused** until [143-rtti-data](./143-rtti-data.md) lands.

The remaining goals — canonical ordering, structural subset on tuples/structs, and full coverage collapse (`{ true, false }` → `boolean`) — depend on a function-free, serializable representation of `Type` whose nodes can be compared, sorted, and traversed without bespoke visited-set logic. Once 143 is in place:

1. Drop the current `reduceOr` / `flattenOr` machinery in `or`. `or(...types)` reverts to a lazy thunk that simply captures its arguments.
2. Move all normalization (flatten, dedup, subset removal, coverage collapse, canonical ordering) to the data form, run once during `toData`.
3. Re-implement and re-test the goals listed above on the data form rather than the thunk graph.

No code work on this issue should start before 143; the existing checkboxes describe behavior that lives on the wrong representation and will be migrated wholesale.

## Note on location

This analysis must live in the `or` function itself (in [../fs/types/rtti/module.f.ts](../fs/types/rtti/module.f.ts)), not in `orParse` or `orValidate`. `or` is used in many places — `orValidate`, `orParse`, and manual schema construction — so the simplification should be performed once at schema construction time and shared by all consumers.

## Related

- 141 (universal, extensible type system): the `subset`/`equal` predicates introduced here align with the proposed `TypeSystem<T>` interface.
- 142 (`NaN` handling in `constPrimitiveValidate`): affects how primitive const equality/subset is defined.
- 143 (serializable data representation): see Dependencies above.
