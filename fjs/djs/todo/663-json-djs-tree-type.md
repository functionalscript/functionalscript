## 663-json-djs-tree-type. One generic recursive value shape for `json`/`djs`

**Priority:** P4
**Status:** open

### Problem

The recursive JSON-like tree container shape is repeated in `fjs/media/json` and
`fjs/djs`. The copies have the same recursive object/array structure and differ
only in their primitive leaf set.

The shared shape must also model JavaScript object property access honestly. A
JSON-shaped object may not contain a requested key, so reading an arbitrary key
can produce `undefined` even when `undefined` is not part of the tree's leaf
set. A required index signature such as:

```ts
type Object<P> = { readonly [k in string]: Unknown<P> }
```

is therefore unsound for generic consumers: `object[key]` is typed as
`Unknown<P>` even when the property is absent at runtime.

### Proposal

`fjs/media/json/types.ts` already defines this shape, as `Tree<P>` /
`TreeObject<P>` / `TreeArray<P>`, and both `json.Unknown` and the extended value
domain instantiate it. What remains is sharing it with `djs`, and deciding
whether it keeps living in the JSON types or moves to a module both families
name:

```ts
/** A recursive JSON-shaped tree over a leaf/primitive type `P`. */
export type Unknown<P> = P | Object<P> | Array<P>
export type Object<P> = { readonly [k in string]?: Unknown<P> }
export type Array<P> = readonly Unknown<P>[]
```

The **optional recursive index signature is required**. It matches existing
JavaScript property-read behavior and the standard JSON object's existing
optional-property convention: callers must handle a missing property as
`undefined` rather than treating every string key as present.

Keep the names the modules already use and import the shared definitions through
a namespace where useful:

```ts
// fjs/media/json/types.ts
import type * as Tree from './common/module.f.mjs'
export type Primitive = boolean | string | number | null
export type Unknown = Tree.Unknown<Primitive>
export type Object = Tree.Object<Primitive>
export type Array = Tree.Array<Primitive>
```

```ts
// fjs/djs/module.f.mjs
import type * as Tree from '../media/json/common/module.f.mjs'
import type { Primitive as JsonPrimitive } from '../media/json/types.ts'
export type Primitive = JsonPrimitive | bigint | undefined
export type Unknown = Tree.Unknown<Primitive>
export type Object = Tree.Object<Primitive>
export type Array = Tree.Array<Primitive>
```

Do not add consumers merely to justify the generic type. The current JSON
serializer does not define its own recursive generic value aliases, so there is
nothing to migrate there. A future parser, serializer, transformer, or other
module may use `Tree.Unknown<P>` when it actually needs the same recursive
shape.

This is a type-only change: it should not change runtime representation or
serialization behavior.

### Compatibility requirements

- Keep the public `Object` / `Array` / `Unknown` aliases in `json` and `djs` so
  existing importers do not break.
- The shared `Object<P>` must remain optional at arbitrary string keys. Do not
  narrow it back to a required index signature merely because serialized JSON
  object entries themselves never contain `undefined` values.
- Distinguish **missing property** from **stored leaf value**. In the extended
  JSON tree, `undefined` is not a primitive leaf, but `object[key]` can still be
  `undefined` because the property is absent.
- Preserve `readonly` recursive containers.
- Keep `fjs/media/json/types.ts`'s
  `Assert<Equal<Unknown, Ts<typeof unknown>>>` pin against the rtti schema in
  `fjs/media/json/rtti/module.f.mjs` satisfied by the re-expressed aliases.
- Keep the shared module in the JSON/DJS family rather than promoting it to a
  broader generic types package without another real consumer.
- Confirm recursive generic aliases work with `tsc` and the repository's Deno
  checks.

### The equality already holds and is now pinned

`fjs/djs/types.ts` carries
`Assert<Equal<Unknown, Tree<Primitive>>>`, added while sharing `colon` and
`_MapEntries` with the json serializer. It compiles today, so djs's
hand-written `Object` / `Array` / `Unknown` are **already** structurally
`TreeObject` / `TreeArray` / `Tree` at djs's leaf set — the remaining work
below is a rename, not a redefinition, and cannot change any type's meaning.
The pin was checked to be load-bearing rather than vacuous: substituting
`Tree<JsonPrimitive>` makes `tsc` fail with `Type 'false' does not satisfy
the constraint 'true'`.

`fjs/djs/types.ts` also already names `_MapEntries` as
`TreeMapEntries<Primitive>`, matching `fjs/media/json/extended/types.ts`.
That file is the worked precedent for the rest of this task: it instantiates
all four aliases off the generic tree and nothing else.

### Tasks

- [x] Define the leaf-parameterized tree with the optional recursive index
      signature `{ readonly [k in string]?: Unknown<P> }`; it is
      `Tree<P>` / `TreeObject<P>` / `TreeArray<P>` in `fjs/media/json/types.ts`.
- [x] Re-express `fjs/media/json`'s `Unknown` / `Object` / `Array` aliases using
      the generic tree while preserving their current public names.
- [ ] Decide where the shared shape lives once `djs` uses it too, and move it
      there if `fjs/media/json/types.ts` is the wrong home for both families.
- [ ] Add proof/type coverage that arbitrary missing object-property reads are
      `Unknown<P> | undefined`.
- [ ] Re-express `fjs/djs`'s aliases using the same shared generic tree.
- [ ] Preserve existing runtime behavior; this task should remain type-only.
- [ ] Add the standard module header and handle `deno.json` exports according to
      the repository's current exports-map policy.
- [ ] `tsc`, relevant Deno checks, and `fjs test`.

### Related

- [`fjs/media/json/types.ts`](../../media/json/types.ts) — already carries a
  leaf-parameterized `Tree<P>` with the optional object index signature, which
  `json.Unknown` and the extended value domain both instantiate. This task is
  now about sharing that shape with `djs` rather than introducing it.
- [157](./157-json-djs-shared-value-machine.md) — its §2 shares one *serializer
  walker* between the two families. It does **not** wait for this issue:
  `fjs/djs/types.ts` already pins `Unknown` equal to `Tree<Primitive>`, so the
  shared walker's type works today and this issue only changes how that shape is
  spelled and where it lives. Its parser sub-task, by contrast, is superseded —
  the DJS state machine it would have shared no longer exists.
- [197](./197-djs-unknown-shape-walker.md) — extracts traversal over the same `Unknown` shape.
- `fjs/media/json/types.ts` — current JSON recursive type aliases.
- `fjs/djs/types.ts` — current DJS recursive type aliases.
- `fjs/media/json/serializer/module.f.mjs` — its `treeSerialize` walks
  `Tree<P>`, so it follows whatever spelling this task settles on.
