## oid-width-guard. The id-width rule is `oid`'s to own

**Priority:** P4
**Status:** open

### Problem

"How many bits an `Oid` of a repository has" is a fact about `OidBytes`
(`fjs/git/types.ts`), and `fjs/git/oid` owns the id — yet it exports no
way to ask. `store`, `walk`, `oid`, and `tree` each re-derive
`BigInt(oidBytes) * 8n`, the first two with a byte-identical assertion:

```js
// store/module.f.mjs, tryRead               // walk/module.f.mjs, peel
const bits = BigInt(oidBytes) * 8n           const bits = BigInt(oidBytes) * 8n
assert(length(id) === bits,                  assert(length(id) === bits,
    ['not an id of the width', id])              ['not an id of the width', id])
```

```js
// oid/module.f.mjs, tryFromHexOf
return id !== null && length(id) === BigInt(oidBytes) * 8n ? id : null
// tree/module.f.mjs, the entry serializer
assert(bitLength(e.oid) === BigInt(oidBytes) * 8n, ['not an id', e.oid])
```

`tree` even spells the same rule in different units — `bitLength` from
`bit_vec` where the others use `oid`'s `length` — so one concept has a
spelling per site. The doc comments in `store` and `walk` assert
the two panics are the same rule ("`fjs/git/store`'s `tryRead` says the
same of one it is handed"), which is the tell that the rule wants a name.

### Proposal

Export the rule from `fjs/git/oid/module.f.mjs`:

```ts
/** The width, in bits, of an id of a repository with `oidBytes`-wide ids. */
const oidBits: (oidBytes: OidBytes) => bigint
/** Whether `id` is an id of that width — bound once, asked many times. */
const isOidOf: (oidBytes: OidBytes) => (id: Vec) => boolean
```

`tryFromHexOf` uses `isOidOf` internally; `store.tryRead`, `walk.peel` and
the other asserting sites bind `isOidOf(oidBytes)` once and assert on it,
keeping their shared message in one place; `tree`'s serializer asserts
through the same predicate instead of reaching for `bitLength`.

**The spelling half of this is done.** `const hex = id =>
codePointListToString(toHex(id))`, written out in `fjs/git/store` and
`fjs/git/walk`'s proof, is now `hexText` in
[`fjs/git/oid`](../oid/module.f.mjs) — beside `toHex`, where this issue asked
for it under the name `toHexString`. `store`, `packstore` and `walk`'s proof
use it, and a new caller takes it rather than writing the line again —
including `fjs/git/pack`'s proof, which carried a byte-identical copy of the
helper under the name `hex` and now imports `hexText` instead. What is left of
this issue is the width, which is the harder half and the reason it was filed:
an `Oid`'s width is still re-derived at several sites, each spelling
`BigInt(oidBytes) * 8n` for itself —
[`oid`](../oid/module.f.mjs)'s `tryFromHexOf`,
[`walk`](../walk/module.f.mjs)'s `peel`,
[`store`](../store/module.f.mjs)'s `readIn` and `tryRead`,
[`tree`](../tree/module.f.mjs)'s `entryBytes`,
[`packidx`](../packidx/module.f.mjs)'s `offsetOf`,
[`packstore`](../packstore/module.f.mjs)'s `tryRead`, and
[`refstore`](../refstore/module.f.mjs)'s `tryWrite`, which refuses rather than
asserts. Enumerate them from the tree when the change is made rather than
trusting this list.

Other proofs spell their own variants of the same call — a name and an id
(`ref`), an index's ids and its pack checksum (`packidx`), the id of what a read
answered (`packstore`) — and those are their own shapes rather than this one
helper, so they are not part of this.

### Tasks

- [x] A hex spelling beside `toHex` in `fjs/git/oid`, with a proof — landed as
      `hexText`, and its importers take it.
- [ ] Export `oidBits`/`isOidOf` from `fjs/git/oid/module.f.mjs` with proofs.
- [ ] Use them at every site above: `oid.tryFromHexOf`, `walk.peel`,
      `store.readIn` and `store.tryRead`, `tree`'s `entryBytes`,
      `packidx.offsetOf`, `packstore.tryRead`, and `refstore.tryWrite`'s
      refusal.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/git/config`](../config/module.f.mjs) and
  [`fjs/git/store`](../store/module.f.mjs) — where the width comes from
  (`config` → `oidBytes`); this issue owns the guard every holder of that
  width re-implements.
