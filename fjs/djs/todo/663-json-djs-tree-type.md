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

Define the recursive container once, parameterized over the leaf type, in
`fjs/media/json/common/module.f.ts`:

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
// fjs/media/json/module.f.mjs
import type * as Tree from './common/module.f.ts'
export type Primitive = boolean | string | number | null
export type Unknown = Tree.Unknown<Primitive>
export type Object = Tree.Object<Primitive>
export type Array = Tree.Array<Primitive>
```

```ts
// fjs/djs/module.f.ts
import type * as Tree from '../media/json/common/module.f.ts'
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
- Keep the shared module in the JSON/DJS family rather than promoting it to a
  broader generic types package without another real consumer.
- Confirm recursive generic aliases work with `tsc` and the repository's Deno
  checks.

### Tasks

- [ ] Add `fjs/media/json/common/module.f.ts` with `Unknown<P>`, `Object<P>`, and
      `Array<P>`.
- [ ] Define `Object<P>` with the optional recursive index signature
      `{ readonly [k in string]?: Unknown<P> }`.
- [ ] Add proof/type coverage that arbitrary missing object-property reads are
      `Unknown<P> | undefined`.
- [ ] Re-express `fjs/media/json`'s `Unknown` / `Object` / `Array` aliases using
      the shared generic tree while preserving their current public names.
- [ ] Re-express `fjs/djs`'s aliases using the same shared generic tree.
- [ ] Preserve existing runtime behavior; this task should remain type-only.
- [ ] Add the standard module header and handle `deno.json` exports according to
      the repository's current exports-map policy.
- [ ] `npx tsc`, relevant Deno checks, and `fjs test`.

### Related

- [Extended JSON bigint parse/serialize](../../media/json/todo/bigint-parse-serialize.md)
  — may instantiate this tree with `null | boolean | string | number | bigint`;
  it must rely on the optional object index signature rather than a required one.
- [157](./157.md) — shares JSON/DJS parser value machinery; complementary to
  sharing the recursive value type.
- [197](./197.md) — extracts traversal over the same `Unknown` shape.
- `fjs/media/json/types.ts` — current JSON recursive type aliases.
- `fjs/djs/module.f.ts` — current DJS recursive type aliases.
- `fjs/media/json/serializer/module.f.mjs` — currently has no separate recursive
  generic value aliases and therefore is not part of this migration.
