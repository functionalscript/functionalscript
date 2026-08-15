## export-node-accessors. `rtti/ts` re-implements `rtti/data`'s private `Node` accessors

**Priority:** P4
**Status:** open

### Problem

`rtti/data` owns the `Node`/`UnionSet` algebra but keeps its accessors private,
so `rtti/ts` re-implements them — once even by allocating fake `Data` tuples to
reach a private comparison through the public `cmp`.

Resolving a `Node` through the rule set:

```js
// fjs/types/rtti/data/module.f.mjs:331
const resolve = rules => n => typeof n === 'string' ? assertNotNullish(at(n)(rules)) : n

// fjs/types/rtti/ts/module.f.mjs:166-169 — the same lookup, open-coded
const admitsUndefined = ctx => n => {
    const u = typeof n === 'string' ? assertNotNullish(at(n)(ctx.rules)) : n
    ...
```

Testing "is this the top set":

```js
// fjs/types/rtti/data/module.f.mjs:268
const isTop = n => typeof n !== 'string' && cmpUnion(n, unknown) === 0

// fjs/types/rtti/ts/module.f.mjs:197
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

- [ ] Export `resolve`, `isTop`, `isNever` from `fjs/types/rtti/data/module.f.mjs`
      with JSDoc; add proof coverage for the exported forms.
- [ ] Rewrite `admitsUndefined` and `isTop` in `fjs/types/rtti/ts/module.f.mjs`
      through the imports; drop the fake-`Data` `cmp` trick.
- [ ] `npx tsc`, `fjs t` — rtti proofs pass unchanged.

### Related

- [172](./172.md) — one container skeleton for `validate`/`parse`;
  same theme of `rtti` submodules sharing the `data` algebra instead of copying it.
