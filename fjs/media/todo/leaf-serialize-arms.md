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
/** A leaf's spelling as chunks. */
type LeafSerializer<V> = (value: V) => List<string>
/** The dialect-specific arms; an arm left out falls to the shared default. */
type ExtraLeaves = {
    readonly bigint?: LeafSerializer<bigint>
    readonly undefined?: LeafSerializer<undefined>
}
const leafSerialize: (numberSerialize: LeafSerializer<number>)
    => (extra: ExtraLeaves)
    => LeafSerializer<null | boolean | number | string | bigint | undefined>
```

Every `extra` member is a serializer *function*, `undefined`'s included —
a constant case is written `() => undefinedSerialize`, so there is one
member shape and no second convention for "already a list". The returned
function dispatches on `typeof`: `boolean`/`string` to the shared atoms,
`number` to the given serializer, `bigint`/`undefined` to the `extra` arm
when present, and everything else — `null`, and any `extra` arm left out
— to `nullSerialize`, which is exactly today's `default`. Standard passes
only its `numberSerialize` and `{}`; extended adds `bigint`; DataJS adds
`bigint` and `undefined`. Each dialect states exactly what it adds, and
`bigint`'s return shape is fixed once by `LeafSerializer<bigint>`.

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
