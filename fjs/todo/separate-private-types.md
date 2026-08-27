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

#### Relationship to the current `_` workaround

[`../fsc/README.md`](../fsc/README.md) currently defines a deliberate interim
policy for private JSDoc typedefs: until TypeScript supports stripping JSDoc
`@typedef`s with `@internal` plus `stripInternal`, a leading `_` marks an emitted
alias as private by contract even when declaration emit exposes it. The upstream
blocker is
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407),
and the waiting strategy is tracked in
[`../../todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md).

That policy remains authoritative **until this migration is implemented**. This
TODO intentionally proposes replacing the wait-for-upstream workaround for
file-scope implementation-private types with a structural boundary:

- file-scope implementation-private named types move to `private.ts`;
- file-scope JSDoc typedefs disappear from implementation/proof modules, so they
  no longer leak merely because TypeScript emits them;
- `private.d.ts` is treated as an intermediate package-build artifact and is
  removed before packing;
- function-local typedefs remain available for lexical type proofs and do not
  need the file-level workaround.

Physical separation is preferred here because it solves the declaration leak
with tools available today, gives private named types the full TypeScript type
language, and makes the public/private source and package boundaries explicit.
The leading `_` remains the naming convention for private types; this proposal
changes where file-scope private types live, not what `_` means.

When this TODO is implemented, update `fjs/fsc/README.md` so it no longer presents
leaked file-scope JSDoc typedefs as the intended steady-state convention. Also
revisit `todo/blocked/jsdoc-typedef-strip-internal.md`: delete it if no remaining
supported case needs file-scope private JSDoc typedef stripping, or narrow it to
whatever cases remain. Do not leave two live documents prescribing different
private-type strategies.

### Proposal

Use this directory convention where named types or runtime metadata used for
type derivation are needed:

```text
module.f.mjs  # implementation; no file-scope @typedef
proof.f.mjs   # proofs; no file-scope @typedef
meta.f.mjs    # runtime constants used by TypeScript type definitions/proofs
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
runtime constant used by TypeScript types/proofs -> meta.f.mjs
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

`meta.f.mjs` contains runtime constants that TypeScript type definitions or
file-scope type proofs refer to. The values do **not** need to be RTTI, and they
do not need to exist primarily for type-system purposes. A normal runtime
constant belongs in `meta.f.mjs` when its literal value or inferred type is part
of a TypeScript type definition/proof.

This includes RTTI definitions:

```ts
import type { type } from './meta.f.mjs'

export type Value = Ts<typeof type>
```

ordinary literal constants:

```ts
import type { statuses } from './meta.f.mjs'

export type Status = typeof statuses[number]
```

and runtime tables that are also used by normal implementation code:

```js
// meta.f.mjs
export const framingKeywords =
    /** @type {const} */ (['import', 'const', 'export', 'default', 'from'])
```

```ts
// private.ts
import type { framingKeywords } from './meta.f.mjs'

type _KeywordsAreComplete =
    Assert<Equal<(typeof framingKeywords)[number], _FramingKeyword>>
```

```js
// module.f.mjs
import { framingKeywords } from './meta.f.mjs'
```

This is the intended solution for file-scope type proofs over module constants:
move the referenced constant to `meta.f.mjs`, keep its runtime consumers using a
normal JavaScript import, and move the file-scope private proof/type to
`private.ts` (or `types.ts` when it is required by a public declaration). The
constant does not become RTTI merely because it lives in `meta.f.mjs`; `meta`
means that its value participates in the type-level model.

Do not move arbitrary runtime values to `meta.f.mjs` merely because their type
could theoretically be queried. The trigger is an actual TypeScript type
reference/proof (`typeof`, `Ts<typeof ...>`, indexed access, etc.).

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
- `module.f.mjs` and other runtime modules may import runtime constants normally
  from `meta.f.mjs`.
- `private.ts` may `import type { ... }` public types from `types.ts`.
- `types.ts` must not depend on `private.ts`.
- `_` helpers required to express public aliases remain in `types.ts` rather
  than creating a `types.ts -> private.ts` edge.
- `types.ts` and `private.ts` may `import type { ... }` constants from
  `meta.f.mjs` when those values participate in TypeScript type definitions or
  proofs.
- all imports in `types.ts` and `private.ts` are named `import type { ... }`
  imports and must not create runtime dependencies.
- a public declaration must never depend on the removable `private.ts` module.

#### Breaking public API migration

Moving a public file-scope JSDoc typedef from `module.f.mjs` or `proof.f.mjs` to
`types.ts` changes its published type import path. Moving a public runtime
constant from `module.f.mjs` to `meta.f.mjs` changes its published runtime import
path. Treat **both** relocations as intentional breaking API changes; do not
preserve the old entry points with compatibility typedefs, exports, or re-exports.

For types:

```text
./module.f.mjs -> ./types.ts
```

For runtime metadata:

```text
./module.f.mjs -> ./meta.f.mjs
```

The migration must update every repository importer to the new path and record
the breaking change in the changelog. Keeping compatibility aliases or
re-exports in `module.f.mjs` would preserve exactly the mixed responsibilities
this convention is intended to remove.

### Declaration emission and packaging

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
- [ ] Reconcile the implemented convention with the current private-JSDoc policy:
      update `fjs/fsc/README.md` to replace the leaked-file-scope-typedef
      workaround, and delete or narrow
      `todo/blocked/jsdoc-typedef-strip-internal.md` so the repository has one
      authoritative strategy.
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
- [ ] Move runtime constants referenced by TypeScript type definitions/proofs
      into `meta.f.mjs`, including RTTI definitions, non-RTTI literal constants,
      and ordinary runtime tables whose literal/inferred types are asserted.
- [ ] Move file-scope private type proofs over those constants to `private.ts`
      (or keep helpers in `types.ts` when required by a public declaration), and
      use `import type { ... }` to reference the `meta.f.mjs` values.
- [ ] Treat moves of public runtime constants to `meta.f.mjs` as breaking API
      changes: update every repository runtime importer and the changelog; do not
      leave compatibility exports or re-exports in `module.f.mjs`.
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
- [ ] Extend the fixture with `meta.f.mjs` containing an RTTI value, a non-RTTI
      literal constant, and a runtime-used constant whose type is asserted from
      `private.ts`; verify runtime imports, type-only imports, source checking,
      packing, clean-consumer resolution, and Node/Deno coverage.
- [ ] Verify a clean TypeScript consumer can install the packed tarball and use
      the public API without any private artifact present.

### Acceptance criteria

- The current `_` leak-tolerance policy is explicitly superseded when this
  migration is implemented; `fjs/fsc/README.md` and the blocked `@internal` /
  `stripInternal` TODO no longer prescribe a conflicting strategy.
- `module.f.mjs` and `proof.f.mjs` contain no file-scope JSDoc `@typedef`.
- Function-local JSDoc `@typedef` declarations are allowed everywhere; private
  ones keep `_` and do not escape as exported declaration aliases.
- Public file-scope types live in `types.ts`.
- Moving a public type from `module.f.mjs` / `proof.f.mjs` to `types.ts` is an
  intentional breaking API change: repository importers use the new path, the
  changelog records the break, and no compatibility typedef/re-export preserves
  the old type entry point.
- Moving a public runtime constant from `module.f.mjs` to `meta.f.mjs` is also an
  intentional breaking API change: repository importers use the new path, the
  changelog records the break, and no compatibility export/re-export preserves
  the old runtime entry point.
- Private `_` helpers required to express public types also remain in `types.ts`
  and are not source exports merely because they are declaration helpers.
- Other private file-scope types live in `private.ts` and keep `_`.
- `types.ts` never depends on `private.ts`.
- Every import in `types.ts` and `private.ts` uses named `import type { ... }`.
- Runtime constants referenced by TypeScript type definitions/proofs live in
  `meta.f.mjs`, whether they are RTTI, literal metadata, or ordinary runtime
  tables also consumed by implementation code.
- File-scope private proofs over such constants can live in `private.ts` without
  exporting implementation locals from `module.f.mjs`.
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

- [`../fsc/README.md`](../fsc/README.md) — current `_` leak-tolerance policy that
  this migration supersedes once implemented.
- [`../../todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md)
  — current wait-for-`@internal`/`stripInternal` strategy; delete or narrow when
  this migration lands.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream JSDoc `@typedef` stripping limitation that motivated the current
  workaround.
- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md) — detect private type names that leak through exported types.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md) — document the repository's source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md) — current JavaScript/JSDoc implementation migration and `_` private-type convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md) — declaration emission and clean packed-package validation.
