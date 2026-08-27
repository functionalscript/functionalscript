## Separate private types into `private.ts`

**Priority:** P2
**Status:** open

### Problem

FunctionalScript currently mixes named types with implementation/proof source:

```text
module.f.mjs  # implementation + file-scope JSDoc typedefs
proof.f.mjs   # proofs + file-scope JSDoc typedefs
types.ts      # public types + private helpers
```

TypeScript declaration emit turns file-scope JSDoc `@typedef`s into exported
aliases, so implementation-private names leak into generated `.d.mts` files.
The existing leading-`_` convention marks those names private by contract, but
the declarations still contain noise and make the source/package boundary less
clear.

The goal is to give every file-scope named type a deliberate home while keeping
public declarations self-contained.

### Proposal

Use this directory convention where needed:

```text
module.f.mjs  # implementation; no file-scope @typedef
proof.f.mjs   # proofs; no file-scope @typedef
meta.f.mjs    # runtime constants referenced by TypeScript types/proofs
types.ts      # public declaration closure
private.ts    # other implementation-private file-scope types
```

Private type names continue to start with `_`.

#### Public declaration closure

`types.ts` is primarily the public type API, but it may contain private `_`
helpers when they are required to express any shipped public declaration.
"Public declaration" includes both exported type aliases and declarations of
exported runtime values/functions.

The placement rule is:

```text
public type                                         -> types.ts
private `_` helper used by any public declaration   -> types.ts
other file-scope private `_` type                   -> private.ts
function-local typedef                              -> allowed in place
runtime constant referenced by TS types/proofs      -> meta.f.mjs
```

For example, a helper used by a public type stays in `types.ts`:

```ts
type _Tuple<N extends number, T, R extends readonly T[]> =
    N extends R['length'] ? R : _Tuple<N, T, readonly [...R, T]>

export type Tuple<N extends number, T> = _Tuple<N, T, readonly []>
```

The same rule applies when a helper appears in an exported value declaration.
For example, if declaration emit for an exported `find` contains:

```ts
export const find: <T>(cmp: Cmp<T>) =>
    (value: T) => (array: _SortedArray<T>) => T | null
```

then `_SortedArray` is part of the public declaration closure and must remain in
`types.ts` (or be inlined into the public declaration). Moving it to
`private.ts` would make a shipped declaration depend on a declaration module
that packaging removes.

`types.ts` must never import `private.ts`. If moving a private helper to
`private.ts` would create a `types.ts -> private.ts` edge or cause any generated
public declaration to reference `private.ts`, keep or inline that helper in
`types.ts` instead.

This should keep `private.ts` uncommon in `types.ts`-heavy modules: it is for
implementation-private file-scope types that are outside the public declaration
closure, not a mechanical destination for every `_` name.

#### Function-local typedefs

Function-local JSDoc `@typedef` declarations are allowed everywhere. They may
refer to lexical values that cannot be named from a sibling TypeScript file.

For example:

```js
const proof = () => {
    const orConst = or(42, string)
    /** @typedef {Assert<Equal<typeof orConst, Or<readonly [42, typeof string]>>>} _OrConst */
}
```

Callback-local type proofs are also valid:

```js
({ kind }) => {
    /** @typedef {Assert<Equal<typeof kind, 'add'>>} _Kind */
    return kind
}
```

Private function-local typedefs keep the leading `_`. Declaration validation
must verify that function-local typedefs remain lexical and do not escape as
exported aliases in generated `.d.ts` / `.d.mts` files.

#### `meta.f.mjs`

`meta.f.mjs` contains runtime constants whose literal/inferred types are
actually referenced by TypeScript type definitions or file-scope type proofs.
They do not need to be RTTI and do not need to exist primarily for type-system
purposes.

Examples include RTTI values:

```ts
import type { type } from './meta.f.mjs'

export type Value = Ts<typeof type>
```

ordinary literal constants:

```ts
import type { statuses } from './meta.f.mjs'

export type Status = typeof statuses[number]
```

and normal runtime tables whose type is asserted:

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

The trigger is an actual TypeScript type dependency (`typeof`,
`Ts<typeof ...>`, indexed access, a type proof, etc.), not merely that a runtime
value *could* be queried.

Runtime code imports values from `meta.f.mjs` normally. Authored TypeScript type
modules use only named type-only imports:

```ts
import type { PublicType } from './types.ts'
import type { metadataValue } from './meta.f.mjs'
```

Do not use runtime `import { ... }`, namespace imports, or side-effect imports in
`types.ts` or `private.ts`.

`meta.f.mjs` is executable FunctionalScript source. Node and Deno coverage must
include it under the same expectations as `module.f.mjs`.

#### Breaking migration; no compatibility re-exports

Moving a public file-scope type from `module.f.mjs` / `proof.f.mjs` to
`types.ts` changes its public type import path. Moving a public runtime constant
from `module.f.mjs` to `meta.f.mjs` changes its runtime import path.

Treat both as intentional breaking API changes:

```text
public type:     ./module.f.mjs -> ./types.ts
public metadata: ./module.f.mjs -> ./meta.f.mjs
```

Update every repository importer and the changelog. Do not preserve old entry
points with compatibility typedefs, exports, or re-exports.

#### Declaration emission and packaging

`private.ts` remains in the normal TypeScript program so its declarations and
all JSDoc `@import` users are checked. Therefore normal declaration emit may
produce an intermediate `private.d.ts`.

Do not try to exclude `private.ts` from the TypeScript program. Instead make
private-declaration cleanup the final `prepack` step:

1. emit declarations;
2. run the existing declaration round-trip type-check;
3. delete every generated `private.d.ts` as the final `prepack` command;
4. let `npm pack` select files after `prepack` completes;
5. inspect the actual tarball;
6. install the tarball in a clean TypeScript consumer and type-check it.

Conceptually:

```text
tsc --noEmit false --emitDeclarationOnly && tsc && <delete generated private.d.ts files>
```

Validation of the packed artifact must prove both:

- neither authored `private.ts` nor generated `private.d.ts` is shipped;
- no packed `.d.ts` / `.d.mts` references a directory's private type module,
  regardless of the exact emitted suffix.

References to packaged `meta.f.mjs` are allowed.

#### Repository-policy reconciliation

[`../fsc/README.md`](../fsc/README.md) currently documents the leading `_` as an
interim API contract for private JSDoc typedefs that TypeScript leaks into
emitted declarations. The upstream blocker is
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407),
and the wait-for-`@internal`/`stripInternal` strategy is tracked in
[`../../todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md).

That policy remains authoritative until this migration is implemented. When this
TODO lands, update `fjs/fsc/README.md` and delete or narrow the blocked TODO so
the repository has one private-type strategy.

The migration also changes [`../AGENTS.md`](../AGENTS.md), which currently says
`types.ts` is the only authored TypeScript under `fjs/`. Update it so the allowed
authored TypeScript type-module roles are:

```text
types.ts    # public declaration closure
private.ts  # implementation-private file-scope types outside that closure
```

Both remain type-only modules and use named `import type { ... }` imports.

### Tasks

- [ ] Document `types.ts`, `private.ts`, and `meta.f.mjs` beside the existing
      `module.*` / `proof.*` file conventions.
- [ ] Update `fjs/AGENTS.md` to allow `types.ts` and `private.ts` as the authored
      TypeScript type-module roles and document the public-declaration-closure
      rule.
- [ ] Update `fjs/fsc/README.md` and delete or narrow
      `todo/blocked/jsdoc-typedef-strip-internal.md` so they no longer prescribe
      a conflicting private-JSDoc strategy.
- [ ] Prohibit file-scope JSDoc `@typedef` in `module.f.mjs` and `proof.f.mjs`;
      allow function-local `@typedef` everywhere.
- [ ] Keep the leading `_` convention for every private type name.
- [ ] Move public file-scope named types from implementation/proof JSDoc into
      `types.ts` as a breaking migration; update importers and changelog.
- [ ] Keep or inline every private `_` helper required transitively by any
      shipped public declaration in `types.ts`, including helpers appearing in
      exported runtime-value/function signatures.
- [ ] Move only other implementation-private file-scope types to `private.ts`;
      do not create `types.ts -> private.ts` or public-declaration -> `private.ts`
      dependencies.
- [ ] Keep lexical type-proof typedefs inside their functions.
- [ ] Move runtime constants actually referenced by TypeScript type
      definitions/proofs into `meta.f.mjs`, including RTTI values, non-RTTI
      literal constants, and runtime-used tables.
- [ ] Move file-scope private proofs over those constants to `private.ts` (or
      `types.ts` when part of the public declaration closure) and use
      `import type { ... }`.
- [ ] Treat moves of public runtime constants to `meta.f.mjs` as breaking API
      changes; update runtime importers and changelog, with no compatibility
      re-exports.
- [ ] Require every import in `types.ts` and `private.ts` to use named
      `import type { ... }`.
- [ ] Update Node and Deno coverage filters to include `meta.f.mjs`.
- [ ] Keep `private.ts` in normal TypeScript checking without runtime JS emit.
- [ ] Make deletion of generated `private.d.ts` the final `prepack` step.
- [ ] Inspect the `npm pack` artifact for private files and private declaration
      dependencies.
- [ ] Add a fixture covering:
      - a private helper required by a public type alias;
      - a private helper required by an exported runtime value/function
        declaration (the `_SortedArray`/`find` shape);
      - an implementation-private type in `private.ts`;
      - a function-local typedef depending on a lexical value;
      - `meta.f.mjs` with RTTI, literal, and runtime-used constants.
- [ ] Verify source checking, declaration emit/cleanup, Node+Deno coverage,
      packing, and clean-consumer type checking.

### Acceptance criteria

- `module.f.mjs` and `proof.f.mjs` contain no file-scope JSDoc `@typedef`.
- Function-local JSDoc `@typedef` is allowed everywhere; private names keep `_`
  and do not escape as exported declaration aliases.
- `types.ts` is the public declaration closure: public types plus any private
  helpers required transitively to express shipped declarations of public types
  or exported runtime values/functions.
- `private.ts` contains only implementation-private file-scope types outside the
  public declaration closure and is expected to be used sparingly where
  `types.ts` already describes most of a module's type surface.
- `types.ts` and every packed public declaration are independent of
  `private.ts`.
- Every import in `types.ts` and `private.ts` uses named `import type { ... }`.
- Runtime constants referenced by TypeScript definitions/proofs live in
  `meta.f.mjs`, whether RTTI or not; executable metadata is covered by Node and
  Deno coverage.
- Moving public types to `types.ts` and public runtime metadata to `meta.f.mjs`
  are breaking migrations: importers and changelog are updated and no
  compatibility re-exports preserve old entry points.
- Declaration emit may create `private.d.ts`; final-`prepack` cleanup removes it
  before package contents are selected.
- The packed tarball contains neither `private.ts` nor `private.d.ts`, and no
  packed declaration depends on the private module.
- Public declaration helpers retained in `types.ts` remain self-contained and
  resolvable from shipped declarations, including helpers used by exported
  runtime-value/function signatures.
- `fjs/AGENTS.md` no longer says `types.ts` is the only authored TypeScript and
  documents both `types.ts` and `private.ts` with the declaration-closure rule.
- `fjs/fsc/README.md` and the blocked `@internal`/`stripInternal` TODO no longer
  prescribe a conflicting private-JSDoc strategy.
- A clean TypeScript consumer type-checks successfully against the packed
  tarball after private artifacts are removed.

### Related

- [`../fsc/README.md`](../fsc/README.md) — current `_` leak-tolerance policy.
- [`../AGENTS.md`](../AGENTS.md) — authored-TypeScript policy to update.
- [`../../todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md)
  — current wait-for-`@internal`/`stripInternal` strategy.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream JSDoc typedef stripping limitation.
- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md)
  — related declaration-leak detection.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md)
  — repository source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md)
  — current JavaScript/JSDoc migration and `_` convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md)
  — declaration emission and clean package validation.
