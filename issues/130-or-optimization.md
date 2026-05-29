# 130. RTTI: `or` Optimization and Normalization

**Priority:** P3
**Status:** open
**Blocked by:** [i143](./143-rtti-data.md)

> **Superseded by [143-rtti-data](./143-rtti-data.md).**

With the two-form architecture in 143 (thunk form for construction, data form for algebra), "optimize `or`" is no longer a separate project. The canonical-form properties this issue was tracking — flatten nested `or`, drop subset variants, coverage collapse, structural dedup, canonical ordering of variants — are properties of the data form *by construction*, not transformations applied to thunks.

Concretely, when 143 lands:

- The current `reduceOr` / `flattenOr` machinery in `or` is deleted. `or(...types)` reverts to a one-line lazy constructor that simply captures its arguments.
- All normalization (flatten, dedup, subset removal, coverage collapse, canonical ordering) lives in `toData` / on the `RuleSet` produced by it.
- Schema identity, structural equality, and subset are properties of the data form, never the thunk form.

There is nothing to do on this issue independently of 143. Do not reopen or carve out partial fixes here; if you find a missing canonical-form property, it belongs in 143.

## Historical record

The bullets below describe the original goals of this issue. They are kept for reference; do not implement them on the thunk form.

### 1. Drop redundant subset variants

If `or` has variants `A` and `B` where `A ⊆ B` (every value `A` accepts is also accepted by `B`), `A` can be dropped — it never contributes a unique match.

Examples:
- A primitive const is a subset of its primitive type: `42 ⊆ number`, `'hi' ⊆ string`, `true ⊆ boolean`.
- A narrower const tuple/struct is a subset of a wider one (matching keys/positions, narrower element types).
- Any type is a subset of `unknown` — `or(unknown, ...rest)` simplifies to `unknown`.
- Duplicate variants (`A ⊆ A` and `A ⊇ A`) collapse to a single variant.
- A complete set of variants that together cover a wider type collapses to that wider type:
  - `['or', true, false]` ≡ `['boolean']`.
  - `['or', ...all primitive type thunks, ...all object/array thunks]` ≡ `['unknown']` (a union of every variant that makes up `unknown` is `unknown`).

### 2. Flatten nested `or`

`or` variants that are themselves `or` thunks should be flattened into the outer `or`.

```ts
or(or(a, b), c)        // ≡ or(a, b, c)
or(a, () => ['or', b]) // ≡ or(a, b)
```

### 3. Normalize the canonical result

Two constructions that describe the same set must produce the same result:

```ts
or(a, b)            // ≡ or(b, a)
or(a, a, b)         // ≡ or(a, b)
or(or(a, b), c)     // ≡ or(a, b, c)
or(unknown, 42)     // ≡ unknown
or(number, 42)      // ≡ number
```

Implies a canonical ordering on the data form's nodes.
