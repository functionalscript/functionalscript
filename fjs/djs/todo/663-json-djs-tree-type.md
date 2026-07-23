## 663-json-djs-tree-type. One generic recursive value shape for `json`/`djs`/serializer

**Priority:** P4
**Status:** open

### Problem

The recursive "JSON-like tree" container shape — *an object whose values are
trees, an array of trees, or a leaf* — is spelled out **three times** in the
codebase. The three copies have the **identical container structure** and differ
only in which leaf (`Primitive`) types are allowed:

```ts
// fjs/media/json/module.f.ts:16
type Object = { readonly [k in string]: Unknown }
type Array = readonly Unknown[]
export type Primitive = boolean | string | number | null
export type Unknown = Primitive | Object | Array
```

```ts
// fjs/djs/module.f.ts:19
export type Object = { readonly [k in string]: Unknown }
export type Array = readonly Unknown[]
export type Primitive = JsonPrimitive | bigint | undefined   // JsonPrimitive imported from json
export type Unknown = Primitive | Object | Array
```

```ts
// fjs/media/json/serializer/module.f.ts:10
type Obj<T> = { readonly [k in string]: Unknown<T> }
type Arr<T> = readonly Unknown<T>[]
type Primitive = boolean | string | number | null           // ← unused (see below)
type Unknown<T> = Arr<T> | Obj<T> | null | T
```

The container half — `{ [k]: tree }`, `readonly tree[]`, and the
`leaf | object | array` union — is byte-for-byte the same idea in all three.
The only axis of real variation is the leaf set:

| Module | Leaf set (`Primitive`) |
|---|---|
| `fjs/media/json/module.f.ts` | `boolean \| string \| number \| null` |
| `fjs/djs/module.f.ts` | json's `+ bigint \| undefined` |
| `fjs/media/json/serializer/module.f.ts` | generic `T` (with `null` baked in) |

Two further observations sharpen the case:

1. **The serializer already invented the generic form.** Its `Unknown<T>`
   (`serializer/module.f.ts:22`) is exactly "the json/djs tree, parameterized
   over the leaf type." It exists so the one serializer can stringify both json
   values and djs values. But it lives **privately inside the serializer**, so
   the two public modules (`json`, `djs`) can't name it and re-declare the shape
   by hand instead.

2. **`djs` already declares its leaf set as an extension of json's.** It imports
   `Primitive as JsonPrimitive` (`djs/module.f.ts:6`) and writes
   `JsonPrimitive | bigint | undefined`. So the "json ⊂ djs" relationship is
   half-expressed at the leaf level but thrown away at the container level,
   where `Object`/`Array`/`Unknown` are copy-pasted rather than reused.

3. **The serializer's local `Primitive` (`serializer/module.f.ts:16`) is dead.**
   `Unknown<T>` never references it — it bakes `null` in directly and takes the
   rest of the leaf set as `T`. `grep -n Primitive fjs/media/json/serializer/module.f.ts`
   finds only the declaration. It's a leftover copy of json's leaf set with no
   consumer (companion to the i65Y-dead-code-cleanup
   theme).

### Proposal

Define the recursive container **once**, parameterized over the leaf type, and
make `json` and `djs` two instantiations. Home: a small shared module
`fjs/media/json/common/module.f.ts`, since both `json` and `djs` already sit on the
json leaf set.

**Naming (per review on PR #928).** Keep the names the modules already use —
`Unknown<P>`, `Object<P>`, `Array<P>` — in the common module, and let consumers
pull them in under a namespace alias so the call sites read `Tree.Unknown<P>`,
`Tree.Object<P>`, `Tree.Array<P>`. This keeps each name consistent with its
existing role and avoids minting new bespoke identifiers:

```ts
// fjs/media/json/common/module.f.ts
/** A recursive JSON-shaped tree over a leaf/primitive type `P`. */
export type Unknown<P> = P | Object<P> | Array<P>
export type Object<P> = { readonly [k in string]: Unknown<P> }
export type Array<P> = readonly Unknown<P>[]
```

```ts
// fjs/media/json/module.f.ts
import type * as Tree from './common/module.f.ts'
export type Primitive = boolean | string | number | null
export type Unknown = Tree.Unknown<Primitive>
export type Object = Tree.Object<Primitive>   // keep named alias for current importers
export type Array = Tree.Array<Primitive>
```

```ts
// fjs/djs/module.f.ts
import type * as Tree from '../json/common/module.f.ts'
import type { Primitive as JsonPrimitive } from '../json/module.f.ts'
export type Primitive = JsonPrimitive | bigint | undefined
export type Unknown = Tree.Unknown<Primitive>
export type Object = Tree.Object<Primitive>
export type Array = Tree.Array<Primitive>
```

```ts
// fjs/media/json/serializer/module.f.ts
// delete the local Obj<T>/Arr<T>/Primitive/Unknown<T> block; use the namespace instead.
import type * as Tree from '../common/module.f.ts'
// every `Unknown<T>` site becomes `Tree.Unknown<T>` (T includes/excludes null per caller)
```

> **Alternative naming.** If a namespace import is undesirable at some call
> site, the flat form `TreeUnknown<P>` / `TreeObject<P>` / `TreeArray<P>`
> (a single `Tree`-prefixed trio) is equivalent and keeps the union name
> consistent with its `TreeObject`/`TreeArray` siblings.

This is a **type-only** change — zero runtime impact, no `.f.ts` value exports
move — yet it collapses three hand-written copies of the same recursive shape
into one generic, deletes one dead local type, and makes the `json ⊂ djs`
relationship explicit at the container level instead of only the leaf level.

### Why this qualifies

- **DRY at the right altitude.** The container recursion is one concept with two
  real consumers today (`json`, `djs`) plus the serializer's already-generic
  third copy — well past the "second real consumer" bar `AGENTS.md` sets for
  extraction. We are not inventing a generic for a single hypothetical caller;
  we are unifying three existing copies.
- **Separation of concerns.** "What a JSON/DJS *value* is" is a data-shape
  concern that should have one home, distinct from "how to parse it"
  ([i157](todo.md)) and "how to walk/serialize it"
  ([i197](todo.md)). Today the shape is co-located with, and
  duplicated across, the modules that consume it.
- **Removes a divergence hazard.** As long as three copies exist, a fix to the
  container (say, tightening object keys, or a `readonly` change) has to be made
  in three places or the shapes silently drift. One generic makes drift
  impossible.

### Caveats / why this is a proposal, not a mechanical edit

- **Keep the named `Object`/`Array` aliases.** Real importers depend on the
  member names, not just `Unknown`: `fjs/djs/serializer/module.f.ts:6` imports
  `Object` from `djs`, and the rtti family imports `Unknown`/`Primitive` from
  `djs` (`types/rtti/{validate,parse,ts,common}/module.f.ts`,
  `types/rtti/module.f.ts:40`). The generic must therefore ship with
  `Tree.Object<P>`/`Tree.Array<P>` so each module can re-expose `Object`/`Array`
  under their current names. Re-exposing only the `Unknown` union would break
  those imports.
- **Recursive generic type aliases.** TypeScript supports recursive generic
  aliases like `Tree.Unknown<P>` fine, but confirm `tsc` (and `deno`'s slow-types check,
  i147) accept the three-alias form without an
  explicit annotation cycle error before landing. The current non-generic
  `Unknown` is itself recursive, so this is expected to be a non-issue — verify
  rather than assume.
- **`null` placement in the serializer's `T`.** The serializer writes
  `Unknown<T> = Arr<T> | Obj<T> | null | T` — `null` is outside `T`. For
  `json`/`djs` the leaf set already contains `null`, so instantiating
  `Tree.Unknown<Primitive>` (where `Primitive ∋ null`) is correct; just make
  sure the serializer's call sites pass a leaf type that already includes `null`
  (or that the common definition folds `null` in consistently) so the migration
  doesn't quietly add/drop `null` from any position.
- **Decide the home, don't over-engineer it.** A new `fjs/media/json/common/` module is
  the obvious fit (json owns the base leaf set; djs already imports from json).
  Don't promote this to `fjs/types/` "just in case" — there is no consumer
  outside the json/djs family.
- **Module-header JSDoc + `deno.json`.** If a new `module.f.ts` is created, add
  the standard `@module` header and register it in the `exports` map of
  `deno.json`, per `AGENTS.md`.

### Related

- [i157](todo.md) — shares the json/djs *parser* value
  machine. Complementary: that issue unifies the runtime that builds these
  trees; this one unifies the type that describes them. A shared `Tree<P>` gives
  i157's factored machine a single typed target.
- [i197](todo.md) — extracts the `Unknown`-shape *walker*
  (5 consumers). It quotes these very type definitions as context but proposes
  deduplicating the *traversal functions*, not the *types*. Landing this first
  gives that walker one generic shape to be written against.
- i65Y-dead-code-cleanup — same spirit; the unused
  `Primitive` in `json/serializer/module.f.ts:16` can be removed here or there.

- `fjs/media/json/module.f.ts:16,20,22,24` — copy 1 (json leaf set).
- `fjs/djs/module.f.ts:19,23,25,27` — copy 2 (djs leaf set).
- `fjs/media/json/serializer/module.f.ts:10,14,16,22` — copy 3 (generic, private; line 16 dead).
