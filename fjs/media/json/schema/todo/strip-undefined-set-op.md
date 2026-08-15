## strip-undefined-set-op. `stripUndefined` hand-rebuilds `UnionSet` field by field

**Priority:** P4
**Status:** open

### Problem

`fjs/media/json/schema/module.f.mjs:202-213` performs a *set operation on the
rtti data form* — remove the `undefined` unit from a union — by enumerating
every member of `UnionSet` to copy it:

```js
const stripUndefined = n => {
    if (typeof n === 'string') { return n }
    const unit = (n.unit ?? 0) & ~undefinedBit
    return {
        ...(unit === 0 ? {} : { unit }),
        ...(n.number === undefined ? {} : { number: n.number }),
        ...(n.string === undefined ? {} : { string: n.string }),
        ...(n.bigint === undefined ? {} : { bigint: n.bigint }),
        ...(n.array === undefined ? {} : { array: n.array }),
        ...(n.object === undefined ? {} : { object: n.object }),
    }
}
```

mirroring the field list of `fjs/types/rtti/data/types.ts`. The same file
enumerates the kinds a second time in `unionSchema` (`:242-257`) — that one
is a genuine per-kind eliminator (each kind maps to a different schema form),
but the two enumerations fail differently if `UnionSet` ever gains a kind:
`unionSchema` visibly stops handling it, while `stripUndefined` silently
**drops** it from every optional property's schema.

### Proposal

`fjs/types/rtti/data` owns `UnionSet` and its algebra (`cmp`, merge,
normalization); give it the missing operation and export it:

```js
// fjs/types/rtti/data — remove unit bits from a union, dropping the key when empty
/** @type {(bits: number) => (n: Node) => Node} */
export const withoutUnits = bits => n => ...
```

`stripUndefined` becomes `withoutUnits(undefinedBit)` plus nothing — the
schema module keeps only JSON-Schema decisions, and a new kind can't be
silently dropped because the owner's implementation is written next to the
type it must mirror.

### Tasks

- [ ] Add `withoutUnits` (or `subtractUnit`) to `fjs/types/rtti/data` with
      proof coverage, including the drop-empty-`unit`-key rule.
- [ ] Rewrite `stripUndefined` through it.
- [ ] `npx tsc`, `fjs t` — schema proofs pass unchanged.

### Related

- `fjs/types/rtti/todo/kindset-eliminator.md` — the same "state the
  `UnionSet` shape once" theme inside `rtti` itself.
