## kindset-eliminator. Name the `KindSet` absent/whole/members trichotomy once

**Priority:** P4
**Status:** open

### Problem

`KindSet<T> | undefined` always means the same three-way contract — `undefined`
= empty set, `true` = the whole kind, array = these members — but every
consumer re-spells the trichotomy inline. Unary eliminations alone:

```js
// fjs/types/rtti/data/module.f.mjs:852
const kindRefs = f => k => k === undefined || k === true ? [] : k.flatMap(f)

// fjs/types/rtti/data/module.f.mjs:956-965
const patternsValidate = (k, item, value) => {
    if (k === undefined) { return verror('unexpected value') }
    if (k === true) { return ok(value) }
    ...

// fjs/types/rtti/ts/module.f.mjs:130-133
const kindToTs = (k, whole, item) =>
    k === undefined ? [] :
    k === true ? [whole] :
    k.map(item)
```

and the same `undefined || true` guard is duplicated twice within each of two
structurally identical union rewriters:

```js
// fjs/types/rtti/data/module.f.mjs:493-501
const mapChildren = f => u => ({
    ...u,
    ...(u.array === undefined || u.array === true ? {} : {
        array: sortedDedup(cmpArraySet)(u.array.map(mapArraySet(f))),
    }),
    ...(u.object === undefined || u.object === true ? {} : {
        object: sortedDedup(cmpObjectSet)(u.object.map(mapObjectSet(f))),
    }),
})

// fjs/types/rtti/data/module.f.mjs:519-527 — same skeleton, different transform
const dropSubsumedUnion = ctx => u => ({
    ...u,
    ...(u.array === undefined || u.array === true ? {} : {
        array: dropSubsumed(arraySetSubset(ctx)({}))(u.array),
    }),
    ...(u.object === undefined || u.object === true ? {} : {
        object: dropSubsumed(objectSetSubset(ctx)({}))(u.object),
    }),
})
```

The binary combinators `cmpKind` (`data:119`), `mergeKind` (`data:233`),
`kindSubset` (`data:344`) and the membership test `kindHas` (`data:940`) spell
the same case analysis pairwise. Nine sites total state the "absent / whole /
members" contract; none of them names it.

### Proposal

Two extractions in `rtti/data`, both exported for `rtti/ts`:

1. A unary eliminator stating the trichotomy once:

   ```js
   /** @type {<T, R>(cases: {
    *     readonly absent: () => R
    *     readonly whole: () => R
    *     readonly members: (list: readonly T[]) => R
    * }) => (k: KindSet<T> | undefined) => R} */
   const kindFold = ({ absent, whole, members }) => k =>
       k === undefined ? absent() :
       k === true ? whole() :
       members(k)
   ```

   Derive `kindRefs`, `kindToTs`, `patternsValidate` (and the guard used by
   the rewriters below) from it.

2. A shared skeleton for the two union rewriters, holding the spread and both
   guards once:

   ```js
   /** @type {(onArray: (l: readonly ArraySet[]) => readonly ArraySet[],
    *          onObject: (l: readonly ObjectSet[]) => readonly ObjectSet[])
    *  => (u: UnionSet) => UnionSet} */
   const mapPatternKinds = (onArray, onObject) => u => ({ ... })
   ```

   `mapChildren` and `dropSubsumedUnion` become two instantiations.

The binary sites (`cmpKind`, `mergeKind`, `kindSubset`, `kindHas`) genuinely
need pairwise case analysis, so they stay — but their doc comments should point
at `kindFold` as the statement of the contract.

### Tasks

- [ ] Add `kindFold` to `fjs/types/rtti/data/module.f.mjs`; rewrite `kindRefs`,
      `patternsValidate`, and `ts`'s `kindToTs` through it.
- [ ] Extract `mapPatternKinds`; re-derive `mapChildren` and `dropSubsumedUnion`.
- [ ] `npx tsc`, `fjs t` — pure refactor, rtti proofs pass unchanged.

### Related

- [172](./172.md) — validate/parse container skeleton; touches
  `patternsValidate`'s callers, coordinate if both land.
