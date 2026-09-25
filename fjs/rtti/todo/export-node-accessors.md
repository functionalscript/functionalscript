## export-node-accessors. `rtti/ts` and `json/schema` re-implement `rtti/data`'s private `Node` accessors

**Priority:** P4
**Status:** open

### Problem

`rtti/data` owns the `Node`/`UnionSet` algebra but keeps its accessors private,
so its two printers re-implement them — [`rtti/ts`](../ts/module.f.mjs) and
[`fjs/media/json/schema`](../../media/json/schema/module.f.mjs), the rtti →
JSON Schema printer — each once even by allocating fake `Data` tuples to reach
a private comparison through the public `cmp`.

Resolving a `Node` through the rule set:

```js
// fjs/rtti/data/module.f.mjs — resolve
const resolve = rules => n => typeof n === 'string' ? assertNotNullish(at(n)(rules)) : n

// fjs/rtti/ts/module.f.mjs — resolveNode, the same lookup
const resolveNode = ctx => n =>
    typeof n === 'string' ? assertNotNullish(at(n)(ctx.rules)) : n

// fjs/media/json/schema/module.f.mjs — admitsAbsence, open-coded again
const admitsAbsence = rules => n => {
    const u = typeof n === 'string' ? assertNotNullish(at(n)(rules)) : n
    ...
```

Testing "is this the top set":

```js
// fjs/rtti/data/module.f.mjs — isTop
const isTop = n => typeof n !== 'string' && cmpUnion(n, unknown) === 0

// fjs/rtti/ts/module.f.mjs and fjs/media/json/schema/module.f.mjs — isTop,
// byte-identical in both
const isTop = u => cmp([{}, u])([{}, top]) === 0
```

The printers' version is the tell: `cmpUnion` is private, so each wraps `u`
and `top` in two throwaway `[{}, …]` `Data` tuples purely to reach the union
comparison through the public `cmp`. Both already import `cmp`, `toData`,
`unitBit`, and `unknown as top` from `rtti/data`, so this is a missing export,
not a layering problem. The own-property-lookup subtlety that `resolve`'s JSDoc
documents is silently repeated by each copy.

The unit-bit constants are a third copy of the same kind: `nullBit`,
`undefinedBit`, `falseBit`, `trueBit` and `booleanBits` are defined identically,
each as `unitBit(…)` of its value, at the top of both printers.

### Proposal

Export a small `Node` accessor API from `rtti/data` — `resolve`, `isTop`
(and `isNever`, for symmetry) — and delete the copies in both printers:

- `rtti/ts`'s `resolveNode` and `json/schema`'s `admitsAbsence` read through
  `resolve`.
- Both `isTop`s disappear; call the imported one (its argument is a
  `UnionSet`, which the data version accepts as a `Node`).

### Tasks

- [ ] Export `resolve`, `isTop`, `isNever` from `fjs/rtti/data/module.f.mjs`
      with JSDoc; add proof coverage for the exported forms.
- [ ] Make **`resolveNode` itself** delegate to the imported `resolve`. That is
      where `rtti/ts`'s duplicated lookup lives, and it has four callers —
      `admitsUndefined`, `admitsAbsence`, `interiorToTs`, and `isNever` — so
      rewriting only the functions named below would leave the copy standing
      for the other two. One delegation gives every caller the shared rule.
- [ ] Rewrite `rtti/ts`'s `isTop` **and `isNever`** through the imports; drop
      the fake-`Data` `cmp` trick. `isNever` is the site that actually spells
      it — `cmp([{}, resolveNode(ctx)(n)])([{}, bottom]) === 0` — so leaving it
      out would complete every task with the trick still standing. Resolve the
      node before calling the imported `isNever`: data's returns `false` for a
      string reference, which is why `ts`'s version resolves first.
- [ ] Rewrite `fjs/media/json/schema`'s `isTop` and `admitsAbsence` through the
      same exports.
- [ ] Consider exporting the unit-bit constants (`nullBit`, `undefinedBit`,
      `falseBit`, `trueBit`, `booleanBits`) from `rtti/data`, beside `unitBit`
      and `absentBit`, and importing them in both printers.
- [ ] `tsc`, `fjs t` — rtti and JSON Schema proofs pass unchanged.

### Related

- `../parse/module.f.mjs` — the same theme of `rtti` submodules sharing the
  `data` algebra instead of copying it.
- [container-read-skeleton.md](./container-read-skeleton.md) — the
  container-skeleton issue this used to point at; a note briefly recorded it
  as resolved by deleting `validate`, but that deletion never landed and both
  walkers remain.
