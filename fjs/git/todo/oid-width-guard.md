## oid-width-guard. The id-width rule is `oid`'s to own

**Priority:** P4
**Status:** open

### Problem

"How many bits an `Oid` of a repository has" is a fact about `OidBytes`
(`fjs/git/types.ts`), and `fjs/git/oid` owns the id — yet it exports no
way to ask. Four modules re-derive `BigInt(oidBytes) * 8n`, two with a
byte-identical assertion:

```js
// store/module.f.mjs:124-126                // walk/module.f.mjs:171-173
const bits = BigInt(oidBytes) * 8n           const bits = BigInt(oidBytes) * 8n
assert(length(id) === bits,                  assert(length(id) === bits,
    ['not an id of the width', id])              ['not an id of the width', id])
```

```js
// oid/module.f.mjs:63
return id !== null && length(id) === BigInt(oidBytes) * 8n ? id : null
// tree/module.f.mjs:263
assert(bitLength(e.oid) === BigInt(oidBytes) * 8n, ['not an id', e.oid])
```

`tree` even spells the same rule in different units — `bitLength` from
`bit_vec` where the others use `oid`'s `length` — so one concept has three
spellings across four sites. The doc comments in `store` and `walk` assert
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

`tryFromHexOf` uses `isOidOf` internally; `store.tryRead` and `walk.peel`
bind `isOidOf(oidBytes)` once and assert on it, keeping their shared
message in one place; `tree`'s serializer asserts through the same
predicate instead of reaching for `bitLength`.

While there: `const hex = id => codePointListToString(toHex(id))` is
written out in both `fjs/git/store/module.f.mjs:42-43` and
`fjs/git/walk/proof.f.mjs:31-32`; it belongs beside `toHex` in `oid` as
`toHexString`.

### Tasks

- [ ] Export `oidBits`/`isOidOf` (and `toHexString`) from
      `fjs/git/oid/module.f.mjs` with proofs.
- [ ] Use them in `oid.tryFromHexOf`, `store.tryRead`, `walk.peel`, and
      `tree`'s entry serializer.
- [ ] `tsc`, `fjs test`.

### Related

- [object-store.md](./object-store.md) — owns where the width comes from
  (`config` → `oidBytes`); this issue owns the guard every holder of that
  width re-implements.
