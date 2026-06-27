## RTTI: share the container entry-loop between `parse` and `validate`

**Priority:** P3
**Status:** open

### Problem

`fs/types/rtti/validate/` and `fs/types/rtti/parse/` are designed to share
`fs/types/rtti/common/`, and they already share `visit`, the error helpers, and
the primitive checks. But the **container iteration** — the core "for each
`[key, item]` entry, run an item function, prepend the path on the first error" —
is duplicated, in two different shapes, and the two shapes are not even
behaviorally equivalent.

`validate` (`fs/types/rtti/validate/module.f.ts:82-95`) uses an early-exit loop —
it stops at the first error:

```ts
const itemValidate = validate(item)
for (const [k, v] of e) {
    const r = itemValidate(v)
    if (r[0] === 'error') {
        return prependPath(k, r)
    }
}
return ok(value) as any
```

`parse` (`fs/types/rtti/parse/module.f.ts:104-115`) instead maps **every** entry,
builds the full `results` array, *then* scans for the first error with a separate
`keyedFirstError` helper:

```ts
const itemParse = parse(item) as (v: Unknown) => ItemResult
const results = e.map(([k, v]) => [k, itemParse(v)] as const)
const err = keyedFirstError(results)
return err === null
    ? ok(rebuild(okEntries(results))) as any
    : prependPath(err[0], err[1])
```

Two problems:

1. **Duplication.** The same loop is written twice, plus `parse` carries two
   extra helpers that exist only to support its map-then-scan form:
   `keyedFirstError` (`parse:70-75`) and `okEntries` (`parse:84-86`). The same
   pattern recurs for the const-container builders (`constContainerValidate` vs
   `constContainerParse`), so the duplication is effectively ×2 in each module.
2. **Behavioral inconsistency.** `validate` stops at the first failing entry;
   `parse` evaluates *all* entries even after one has already failed, then
   discards the rest. For a large array whose first element is invalid, `parse`
   still parses every remaining element. This is wasted work and a silent
   semantic divergence between two functions that are supposed to mirror each
   other.

The only genuine difference between the two is how a **success** is built:
`validate` returns `value` unchanged; `parse` rebuilds via
`arrayRebuild`/`recordRebuild` from the per-entry results.

### Proposal

Hoist a single early-exit entry-loop helper into
`fs/types/rtti/common/module.f.ts`, e.g.:

```ts
// runs `item` over each entry, bailing on the first error with the path prefixed
export const eachEntry = <R>(
    entries: ReadonlyArray<readonly [string, Unknown]>,
    item: (k: string, v: Unknown) => CommonResult<R, ValidationError>,
): CommonResult<ReadonlyArray<readonly [string, R]>, ValidationError>
```

Then:

- `validate` calls it, ignores the collected entries, and returns `ok(value)`.
- `parse` calls it and feeds the collected `[key, result]` entries to `rebuild`.

This removes `keyedFirstError` and `okEntries` entirely, collapses the four
container builders (array/record/tuple/struct × validate/parse) onto one shared
loop, and gives `parse` the same first-error early-exit semantics `validate`
already has. The "instantiate the item function lazily only when the container is
non-empty, to avoid infinite recursion on empty containers" invariant
(documented in both modules) then lives once, in `common`.

### Tasks

- [ ] Add `eachEntry` (early-exit, path-prefixing) to
      `fs/types/rtti/common/module.f.ts` with proof coverage.
- [ ] Rewrite `containerValidate` / `constContainerValidate` to use it.
- [ ] Rewrite `containerParse` / `constContainerParse` to use it; delete
      `keyedFirstError` and `okEntries`.
- [ ] Run `npx tsc` and `fjs t`; confirm `parse`/`validate` proofs keep full
      coverage and that `parse` now short-circuits on the first error.

### Related

- `fs/types/todo/143.md` — the larger RTTI data-form redesign (two parsers).
  This issue is an independent near-term cleanup of the existing thunk-direct
  parsers and does not depend on it.
- `fs/types/rtti/todo/unknown-primitive-source-of-truth.md` — the related
  `Unknown`/`Primitive` import inconsistency surfaced while reading these files.
