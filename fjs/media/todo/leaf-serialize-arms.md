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
- `fjs/media/datajs/serializer/module.f.mjs:94-102` (`leafSerialize`,
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
/** A leaf's spelling as chunks. Public: every codec names it for its `numberSerialize`. */
export type LeafSerializer<V> = (value: V) => List<string>
/** The dialect-specific arms a configuration may carry. */
type _ExtraLeaves = {
    readonly bigint?: LeafSerializer<bigint>
    readonly undefined?: LeafSerializer<undefined>
}
/**
 * The leaf kinds a configuration serializes: the shared four plus each
 * arm `X` carries as a **required** property. An optional key does not
 * count — `{ bigint?: … }` is what a widened configuration looks like
 * when the arm may be absent, and a kind is supported only where its
 * serializer is known to be there.
 */
type _Leaves<X extends _ExtraLeaves> =
    | null | boolean | number | string
    | (X extends { readonly bigint: LeafSerializer<bigint> } ? bigint : never)
    | (X extends { readonly undefined: LeafSerializer<undefined> } ? undefined : never)
const leafSerialize: (numberSerialize: LeafSerializer<number>)
    => <X extends _ExtraLeaves>(extra: X)
    => LeafSerializer<_Leaves<X>>
```

Every `extra` member is a serializer *function*, `undefined`'s included —
a constant case is written `() => undefinedSerialize`, so there is one
member shape and no second convention for "already a list". **The
returned function's input type depends on the arms actually present**:
with `{}` it is `LeafSerializer<null | boolean | number | string>`, so
`leafSerialize(numberSerialize)({})(1n)` is a type error rather than a
`null` on the wire — and so is the same call through a widened
`const extra: _ExtraLeaves = {}`, because an optional `bigint?` is not a
required `bigint` and `_Leaves` tests for the required one. A codec that
wants `bigint` accepted passes a literal whose `bigint` arm is present,
which is how all three callers here are written. Of the three helper
types, `LeafSerializer` is public API — every codec spells its
`numberSerialize` with it — and `_ExtraLeaves`/`_Leaves` are
`_`-prefixed: they exist only to state `leafSerialize`'s declaration,
inside the public closure because that declaration names them. The returned function dispatches on `typeof`:
`boolean`/`string` to the shared atoms, `number` to the given serializer,
`bigint`/`undefined` to their `extra` arm, `null` to `nullSerialize` —
and a `bigint` or `undefined` that reaches a configuration with no arm
for it **asserts**, since only a cast can deliver one past the type; it
is not answered with `nullSerialize`, which would be a plausible wrong
value ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
That is the one behaviour this builder changes: today's `default` arm
folds an out-of-type `bigint` into `null` silently. It is reachable only
outside the declared input types, so no `Changelog:` entry is owed, and
the proof pins the assertion. Standard passes
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
