## export-node-accessors. `rtti/ts` re-implements `rtti/data`'s private `Node` accessors

**Priority:** P4
**Status:** open

### Problem

`rtti/data` owns the `Node`/`UnionSet` algebra but keeps its accessors private,
so `rtti/ts` re-implements them — once even by allocating fake `Data` tuples to
reach a private comparison through the public `cmp`.

Resolving a `Node` through the rule set:

```js
// fjs/rtti/data/module.f.mjs:331
const resolve = rules => n => typeof n === 'string' ? assertNotNullish(at(n)(rules)) : n

// fjs/rtti/ts/module.f.mjs:166-169 — the same lookup, open-coded
const admitsUndefined = ctx => n => {
    const u = typeof n === 'string' ? assertNotNullish(at(n)(ctx.rules)) : n
    ...
```

Testing "is this the top set":

```js
// fjs/rtti/data/module.f.mjs:268
const isTop = n => typeof n !== 'string' && cmpUnion(n, unknown) === 0

// fjs/rtti/ts/module.f.mjs:197
const isTop = u => cmp([{}, u])([{}, top]) === 0
```

The `ts` version is the tell: `cmpUnion` is private, so the printer wraps `u`
and `top` in two throwaway `[{}, …]` `Data` tuples purely to reach the union
comparison through the public `cmp`. `rtti/ts` already imports `cmp`, `toData`,
`unitBit`, and `unknown as top` from `../data/module.f.mjs`, so this is a
missing export, not a layering problem. The own-property-lookup subtlety that
`resolve`'s JSDoc documents (`data/module.f.mjs:325-329`) is silently repeated
by the copy.

### Proposal

Export a small `Node` accessor API from `rtti/data` — `resolve`, `isTop`
(and `isNever`, `data/module.f.mjs:265`, for symmetry) — and delete the copies
in `rtti/ts`:

- `admitsUndefined` becomes `const u = resolve(ctx.rules)(n)`.
- `ts`'s `isTop` disappears; call the imported one (its argument is a
  `UnionSet`, which the data version accepts as a `Node`).

### Tasks

- [ ] Export `resolve`, `isTop`, `isNever` from `fjs/rtti/data/module.f.mjs`
      with JSDoc; add proof coverage for the exported forms.
- [ ] Make **`resolveNode` itself** delegate to the imported `resolve`
      (`ts/module.f.mjs:189`). That is where the duplicated lookup lives, and
      it has four callers — `admitsUndefined` (`:201`), `admitsAbsence`
      (`:210`), `interiorToTs` (`:223`), and `isNever` (`:236`) — so
      rewriting only the functions named below would leave the copy standing
      for the other two. One delegation gives every caller the shared rule.
- [ ] Rewrite `admitsUndefined`, `isTop`, **and `isNever`** through the
      imports; drop the fake-`Data` `cmp` trick. `isNever` (`:236`) is the
      site that actually spells it —
      `cmp([{}, resolveNode(ctx)(n)])([{}, bottom]) === 0` — so leaving it
      out would complete every task with the trick still standing. Resolve
      the node before calling the imported `isNever`: data's returns `false`
      for a string reference, which is why `ts`'s version resolves first.
- [ ] `tsc`, `fjs t` — rtti proofs pass unchanged.

### Related

- `../parse/module.f.mjs` — the same theme of `rtti` submodules sharing the
  `data` algebra instead of copying it.
- [container-read-skeleton.md](./container-read-skeleton.md) — the
  container-skeleton issue this used to point at; a note briefly recorded it
  as resolved by deleting `validate`, but that deletion never landed and both
  walkers remain.
