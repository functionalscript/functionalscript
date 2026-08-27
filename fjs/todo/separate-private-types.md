## Separate private types into `private.ts`

**Priority:** P2
**Status:** open

### Problem

FunctionalScript directories currently mix private types with implementation and
public type declarations:

```text
module.f.mjs  # implementation + private JSDoc types
proof.f.mjs   # proofs + private JSDoc types
types.ts      # public type API + private helper types
```

Private types already use a leading `_` by convention, but their location still
creates declaration and package noise. In particular, file-scope JSDoc
`@typedef`s in `module.f.mjs` and `proof.f.mjs` escape into generated `.d.mts`
files: TypeScript emits them as exported type aliases even when they were
intended to be private.

There are two different kinds of private file-scope type, and the convention must
not confuse them:

1. **public-type helpers** such as `_Tuple` that are required to express an
   exported type such as `Tuple`; these must stay with the public declaration
   graph in `types.ts`;
2. **implementation-private types** used only by implementation/proofs; these
   belong in `private.ts`.

Moving the second category out of implementation/proof files removes the JSDoc
typedef leakage structurally. TypeScript will still emit a declaration for an
imported `private.ts`, because that source file is part of the declaration
program; that generated private declaration must be removed before packaging.

The leading `_` convention remains useful in both categories: it means the type
name itself is private even when the helper must live beside public types.

### Proposal

Use this directory convention where named types or runtime metadata used for
type derivation are needed:

```text
module.f.mjs  # implementation; no file-scope @typedef
proof.f.mjs   # proofs; no file-scope @typedef
meta.f.mjs    # runtime metadata used to define/derive types
types.ts      # public types + `_` helpers required to express them
private.ts    # implementation-private `_` types
```

`module.f.mjs` and `proof.f.mjs` may use JSDoc annotations and `@import`, but
must not declare file-scope named types with `@typedef`.

The placement rule is based on the type dependency graph, not only visibility:

```text
public type                                      -> types.ts
private `_` helper required by a public type     -> types.ts
other file-scope private `_` type                -> private.ts
function-local typedef                           -> allowed in place
```

A `_` helper required to define a public type is still private by name and need
not be exported from `types.ts`. Keeping it there allows TypeScript to emit a
self-contained public declaration module. Moving it to `private.ts` would make a
shipped declaration depend on a module that packaging deliberately removes.

For example:

```ts
type _Tuple<N extends number, T, R extends readonly T[]> =
    N extends R['length'] ? R : _Tuple<N, T, readonly [...R, T]>

export type Tuple<N extends number, T> = _Tuple<N, T, readonly []>
```

`_Tuple` stays in `types.ts`: it is private, but it is part of the implementation
of the public `Tuple` declaration. By contrast, a `_State` used only to annotate
`module.f.mjs` belongs in `private.ts`.

`types.ts` must never import `private.ts`. If moving a private alias out of
`types.ts` would create such an edge, that is evidence that the alias is a
public-type helper and should remain in `types.ts`.

#### Function-local typedefs

Function-local JSDoc `@typedef` declarations are allowed everywhere. They are
useful for compile-time proofs that depend on values available only in lexical
scope and therefore cannot be moved to `private.ts`.

For example:

```js
const proof = () => {
    const orConst = or(42, string)
    /** @typedef {Assert<Equal<typeof orConst, Or<readonly [42, typeof string]>>>} _OrConst */
}
```

A callback-local proof is also valid:

```js
({ kind }) => {
    /** @typedef {Assert<Equal<typeof kind, 'add'>>} _Kind */
    return kind
}
```

These typedefs stay inside the narrowest function scope that provides the values
they need. Private function-local typedef names keep the leading `_` convention.
Declaration validation must verify that they remain lexical and do not appear as
exported aliases in generated `.d.ts` / `.d.mts` files.

#### Type metadata

Some TypeScript types are derived from runtime values rather than declared
independently. These values include RTTI definitions:

```ts
import type { type } from './meta.f.mjs'

export type Value = Ts<typeof type>
```

and ordinary constants whose literal value is used by a type query:

```ts
import type { statuses } from './meta.f.mjs'

export type Status = typeof statuses[number]
```

Put runtime values whose primary purpose is to define, describe, or derive
type-level information in `meta.f.mjs`. Values whose primary purpose is normal
program behavior remain in `module.f.mjs` even if their types are reused
incidentally.

Both `types.ts` and `private.ts` may depend on `meta.f.mjs` for
`Ts<typeof ...>`, `typeof ...`, indexed access over literal values, and similar
type derivation. All imports in authored TypeScript type files use the named
type-only form:

```ts
import type { PublicType } from './types.ts'
import type { metadataValue } from './meta.f.mjs'
```

Do not use runtime `import { ... }`, namespace imports, or side-effect imports in
`types.ts` or `private.ts`.

`meta.f.mjs` is executable FunctionalScript source and is packaged like other
required `.f.mjs` modules. Node and Deno coverage filters must include it under
the same coverage expectations as `module.f.mjs`.

#### Dependency rules

- `module.f.mjs` and `proof.f.mjs` may use `types.ts` and `private.ts` through
  JSDoc `@import`.
- `private.ts` may `import type { ... }` public types from `types.ts`.
- `types.ts` must not depend on `private.ts`.
- `_` helpers required to express public aliases remain in `types.ts` rather
  than creating a `types.ts -> private.ts` edge.
- `types.ts` and `private.ts` may `import type { ... }` runtime metadata from
  `meta.f.mjs`.
- all imports in `types.ts` and `private.ts` are named `import type { ... }`
  imports and must not create runtime dependencies.
- a public declaration must never depend on the removable `private.ts` module.

#### Breaking public type migration

Moving a public file-scope JSDoc typedef from `module.f.mjs` or `proof.f.mjs` to
`types.ts` changes its published import path. Treat that relocation as an
intentional breaking API change rather than preserving the old type entry point
with compatibility re-exports.

For example, if consumers previously imported a type from:

```text
./module.f.mjs
```

and the type moves to `types.ts`, its new public type entry point is:

```text
./types.ts
```

The migration must update every repository importer to the new path and record
the breaking change in the changelog. Do not leave compatibility typedefs or
re-exports in `module.f.mjs` merely to preserve the old type-only subpath: that
would reintroduce the file-scope typedef/declaration noise this convention is
intended to remove.

This breaking rule applies to type entry points, not runtime exports. Moving
runtime values to `meta.f.mjs` requires its own API decision if those values are
publicly imported at runtime.

#### Declaration emission and packaging

`private.ts` is source-only and remains in the normal TypeScript program so its
types and all `@import` users are checked. Consequently, the existing
`tsc --emitDeclarationOnly` pass will also generate `private.d.ts`; `exclude`
cannot suppress that output once another program input imports `private.ts`.

Do not require TypeScript to avoid generating that intermediate file. Make
private declaration cleanup the **final step of `prepack`**. `npm pack` runs
`prepack` itself, so an external emit/check/cleanup sequence followed by
`npm pack` would recreate the deleted declarations.

The packaging lifecycle is:

1. `prepack` runs normal declaration emission;
2. `prepack` runs the existing declaration round-trip type-check;
3. as the final `prepack` command, delete every generated `private.d.ts`;
4. `npm pack` selects package contents;
5. validate the actual packed artifact:
   - it contains neither authored `private.ts` nor generated `private.d.ts`;
   - every shipped `.d.ts` / `.d.mts` is scanned and must not reference a
     directory's `private` type module;
6. install the tarball in the clean TypeScript consumer and type-check it.

Conceptually, the current `prepack`:

```text
tsc --noEmit false --emitDeclarationOnly && tsc
```

becomes:

```text
tsc --noEmit false --emitDeclarationOnly && tsc && <delete generated private.d.ts files>
```

The cleanup command should use repository-portable tooling. Tests should invoke
`npm pack` normally so they exercise the real lifecycle.

The declaration scan should reject the private module rather than one particular
specifier spelling (`./private.ts`, `./private.d.ts`, or a future equivalent).
References to packaged `meta.f.mjs` are allowed.

### Tasks

- [ ] Document `private.ts` and `meta.f.mjs` beside the existing `types.ts`,
      `module.*`, and `proof.*` conventions.
- [ ] Prohibit file-scope JSDoc `@typedef` declarations in `module.f.mjs` and
      `proof.f.mjs`; allow function-local `@typedef` declarations everywhere.
- [ ] Keep the leading `_` convention for every private type name, including
      private helpers in `types.ts` and function-local private typedefs.
- [ ] Move public file-scope named types from implementation/proof JSDoc into
      `types.ts` as a breaking type-API migration; update every repository
      importer to the new `types.ts` path and record the break in the changelog.
- [ ] Do not add compatibility typedefs or re-exports to preserve old
      `module.f.mjs` type entry points.
- [ ] Keep `_` helpers required to express public declarations in `types.ts`;
      do not create `types.ts -> private.ts` dependencies.
- [ ] Move other private file-scope named types out of `types.ts`,
      `module.f.mjs`, and `proof.f.mjs` into each directory's `private.ts`.
- [ ] Keep lexical type-proof typedefs inside the functions whose local values
      they inspect.
- [ ] Move runtime values whose primary purpose is type derivation into
      `meta.f.mjs`, including RTTI definitions and non-RTTI literal constants.
- [ ] Require every import in `types.ts` and `private.ts` to use named
      `import type { ... }`.
- [ ] Update Node coverage selection to include both `module.f.mjs` and
      `meta.f.mjs` under the existing thresholds.
- [ ] Update Deno `cov` and `cov-html` filters to include both `module.f.mjs` and
      `meta.f.mjs`.
- [ ] Keep `private.ts` in normal TypeScript checking without generating runtime
      JavaScript for it.
- [ ] Make deletion of generated `private.d.ts` files the final `prepack` step.
- [ ] Exercise cleanup through normal `npm pack`.
- [ ] Inspect the packed artifact and reject any `private.ts` or `private.d.ts`.
- [ ] Scan every packed `.d.ts` / `.d.mts` and reject any dependency on a
      directory's private type module.
- [ ] Add a fixture covering all three private-type cases:
      - a `_` helper in `types.ts` required by an exported public alias;
      - an implementation-private `_` type in `private.ts`;
      - a function-local `_` typedef depending on a lexical value.
      Verify the first remains self-contained in `types.d.ts`, the second's
      intermediate `private.d.ts` is removed, and the third does not escape.
- [ ] Extend the fixture with `meta.f.mjs` containing both an RTTI value and a
      non-RTTI literal constant used through `import type { ... }`, and verify
      source checking, packing, clean-consumer resolution, and Node/Deno coverage.
- [ ] Verify a clean TypeScript consumer can install the packed tarball and use
      the public API without any private artifact present.

### Acceptance criteria

- `module.f.mjs` and `proof.f.mjs` contain no file-scope JSDoc `@typedef`.
- Function-local JSDoc `@typedef` declarations are allowed everywhere; private
  ones keep `_` and do not escape as exported declaration aliases.
- Public file-scope types live in `types.ts`.
- Moving a public type from `module.f.mjs` / `proof.f.mjs` to `types.ts` is an
  intentional breaking API change: repository importers use the new path, the
  changelog records the break, and no compatibility typedef/re-export preserves
  the old type entry point.
- Private `_` helpers required to express public types also remain in `types.ts`
  and are not source exports merely because they are declaration helpers.
- Other private file-scope types live in `private.ts` and keep `_`.
- `types.ts` never depends on `private.ts`.
- Every import in `types.ts` and `private.ts` uses named `import type { ... }`.
- Runtime values primarily used for type derivation live in `meta.f.mjs`.
- Node and Deno coverage include executable `meta.f.mjs` files.
- Declaration emission may create `private.d.ts`; the final `prepack` step
  removes it before package contents are selected.
- The packed tarball contains neither `private.ts` nor `private.d.ts`.
- No packed declaration depends on a directory's private type module.
- Public declaration helpers retained in `types.ts` remain resolvable from the
  shipped `types.d.ts` without any private artifact.
- Required references to packaged `meta.f.mjs` remain valid in the packed
  artifact and clean consumer.
- A clean TypeScript consumer type-checks successfully against the packed
  tarball after all private artifacts have been removed.

### Related

- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md) — detect private type names that leak through exported types.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md) — document the repository's source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md) — current JavaScript/JSDoc implementation migration and `_` private-type convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md) — declaration emission and clean packed-package validation.
