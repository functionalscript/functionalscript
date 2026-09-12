## leaf-serialize-arms. Three leaf switches share their unvarying arms

**Priority:** P4
**Status:** open

### Problem

`treeSerialize` is a factory precisely so codecs supply only their leaf
spelling — but each of the three callers writes the whole `typeof`
switch, not just the part that varies:

- `fjs/media/json/module.f.mjs:56-63` (`primitiveSerialize`)
- `fjs/media/json/extended/module.f.mjs:129-137` (`primitiveSerialize`,
  adds a `bigint` arm)
- `fjs/media/datajs/serializer/module.f.mjs:91-100` (`leafSerialize`,
  adds `bigint` and `undefined` arms)

The `boolean`, `string`, and `default → null` arms are byte-identical in
all three, and all three import those atoms from
`fjs/media/json/serializer`. What varies is one function (`number`) plus
extra cases for two dialects. The copies have already drifted in shape:
datajs's `bigint` arm wraps in `[...]` while extended's `bigintSerialize`
returns the list itself.

### Proposal

Publish a leaf builder from `fjs/media/json/serializer/module.f.mjs`
beside `treeSerialize`:

```ts
const leafSerialize: (numberSerialize: (n: number) => List<string>)
    => (extra: Partial<Record<'bigint' | 'undefined', …>>)
    => (value) => List<string>
```

where `extra` holds additional `typeof` cases consulted before the shared
`boolean`/`string`/`null` defaults. Standard passes only its
`numberSerialize`; extended adds its `bigint`; DataJS adds `bigint` and
`undefined`. Each dialect then states exactly what it adds, and the
`bigint` return shape is fixed once.

### Tasks

- [ ] Add the builder with a proof; rewrite the three switches through it.
- [ ] `tsc`, `fjs test`; serializer proofs pass unchanged.

### Related

- [../../djs/todo/157-json-djs-shared-value-machine.md](../../djs/todo/157-json-djs-shared-value-machine.md)
  — shares the *container walker* and names `leafSerialize` as the seam
  that legitimately differs; this issue shares the unvarying arms of that
  seam.
- [../json/todo/remove-native-json.md](../json/todo/remove-native-json.md)
  — replaces `numberSerialize`'s body, the arm that varies; independent.
