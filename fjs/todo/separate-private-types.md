## Separate private types into `private.ts`

**Priority:** P2
**Status:** open

### Problem

FunctionalScript currently mixes named types with authored JavaScript source.
Common examples are:

```text
module.f.mjs  # FunctionalScript implementation + file-scope JSDoc typedefs
module.mjs    # host integration + file-scope JSDoc typedefs
proof.f.mjs   # proofs + file-scope JSDoc typedefs
types.ts      # public types + private helpers
```

Other authored JavaScript companions, such as `testlib.f.mjs`, can contain the
same file-scope typedefs and are subject to the same declaration emit. TypeScript
turns file-scope JSDoc `@typedef`s in authored `.mjs` files into exported aliases,
so implementation-private names leak into generated `.d.mts` files. The existing
leading-`_` convention marks those names private by contract, but the declarations
still contain noise and make the source/package boundary less clear.

The goal is to give every file-scope named type a deliberate home while keeping
public declarations self-contained.

### Proposal

Use this directory convention where needed:

```text
module.f.mjs  # FunctionalScript implementation
module.mjs    # host integration, when needed
proof.f.mjs   # FunctionalScript proofs
proof.mjs     # host proofs, when needed
meta.f.mjs    # runtime constants referenced by TypeScript types/proofs
types.ts      # public declaration closure
private.ts    # other implementation-private file-scope types
```

No authored `.mjs` file may declare a **file-scope** JSDoc `@typedef`, regardless
of basename or whether the file is FunctionalScript. This includes
`module.f.mjs`, `module.mjs`, `proof.f.mjs`, `proof.mjs`, `meta.f.mjs`,
`testlib.f.mjs`, and other descriptive companions. Function-local typedefs remain
allowed as described below.

Private type and runtime constant names continue to start with `_`.

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
`types.ts` (or be inlined into the public declaration). Moving it to `private.ts`
would make a shipped declaration depend on a declaration module that packaging
removes.

`types.ts` must never import `private.ts`. If moving a private helper to
`private.ts` would create a `types.ts -> private.ts` edge or cause any generated
public declaration to reference `private.ts`, keep or inline that helper in
`types.ts` instead.

This should keep `private.ts` uncommon in `types.ts`-heavy modules: it is for
implementation-private file-scope types that are outside the public declaration
closure, not a mechanical destination for every `_` name.

#### Function-local typedefs

Function-local JSDoc `@typedef` declarations are allowed in any authored source
file. They may refer to lexical values that cannot be named from a sibling
TypeScript file.

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

`meta.f.mjs` contains runtime constants whose literal/inferred types are actually
referenced by TypeScript type definitions or file-scope type proofs. They do not
need to be RTTI and do not need to exist primarily for type-system purposes.

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
export const _framingKeywords =
    /** @type {const} */ (['import', 'const', 'export', 'default', 'from'])
```

```ts
// private.ts
import type { _framingKeywords } from './meta.f.mjs'

type _KeywordsAreComplete =
    Assert<Equal<(typeof _framingKeywords)[number], _FramingKeyword>>
```

```js
// module.f.mjs
import { _framingKeywords } from './meta.f.mjs'
```

Private constants in `meta.f.mjs` use the same leading-`_` API convention as
private types. They may need to be exported so sibling runtime or TypeScript
modules can name them, but that export is module linkage rather than public API:
consumers must not depend on `_`-prefixed constants directly. Renaming or removing
such a name is not a breaking change solely because it was exported. As with
private types, changes that alter an actual public runtime/type contract still
follow the normal breaking-change rules.

The trigger is an actual TypeScript type dependency (`typeof`, `Ts<typeof ...>`,
indexed access, a type proof, etc.), not merely that a runtime value *could* be
queried.

Runtime code imports values from `meta.f.mjs` normally. Authored TypeScript type
modules use only named type-only imports:

```ts
import type { PublicType } from './types.ts'
import type { metadataValue } from './meta.f.mjs'
```

Do not use runtime `import { ... }`, namespace imports, or side-effect imports in
`types.ts` or `private.ts`.

`meta.f.mjs` is executable FunctionalScript source. Emergent testing already
loads every `*.f.mjs` during normal test discovery, including modules without a
`proof` export. Add `meta.f.mjs` to the Node and Deno coverage filters so the
existing coverage thresholds apply to it. How a particular metadata module
satisfies those thresholds is left to its developer; this convention does not
prescribe proof imports, calls, or other coverage-specific implementation choices.

#### Breaking migration; no compatibility re-exports

Moving a public file-scope type from any authored `.mjs` file to `types.ts`
changes its public type import path. Moving a public runtime constant from
`module.f.mjs` to `meta.f.mjs` changes its runtime import path.

Treat both as intentional breaking API changes:

```text
public type:     ./<source>.mjs  -> ./types.ts
public metadata: ./module.f.mjs -> ./meta.f.mjs
```

Update every repository importer and the changelog. Do not preserve old entry
points with compatibility typedefs, exports, or re-exports.

#### Declaration emission and packaging

`private.ts` remains in the normal TypeScript program so its declarations and all
JSDoc `@import` users are checked. Therefore normal declaration emit may produce
an intermediate `private.d.ts`.

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

Do **not** rewrite or post-process emitted declaration text. TypeScript may retain
source JSDoc comments such as:

```js
/** @import { _Private } from './private.ts' */
```

inside an emitted `.d.ts` / `.d.mts`. In a declaration file this is a comment,
not a TypeScript import or module dependency, so it may remain after
`private.d.ts` is deleted.

Validation of the packed artifact must prove:

- neither authored `private.ts` nor generated `private.d.ts` is shipped;
- no packed `.d.ts` / `.d.mts` has a **semantic TypeScript dependency** on a
  directory's private type module.

A raw text search for `private.ts` / `@import` is therefore incorrect because it
would reject harmless retained comments. If a structural scan is used, it must
ignore comments and reject only actual declaration syntax that creates a module
dependency. The clean-consumer TypeScript check is the final semantic validation.
References to packaged `meta.f.mjs` are allowed.

#### Repository-policy reconciliation

[`../fsc/README.md`](../fsc/README.md) currently documents the leading `_` as an
interim API contract for private JSDoc typedefs that TypeScript leaks into emitted
declarations. The upstream blocker is
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

Both remain type-only modules and use named `import type { ... }` imports. The
same policy must also state that file-scope JSDoc `@typedef` is prohibited in
**all authored `.mjs` files**, including non-FunctionalScript host JavaScript.

### Tasks

- [ ] Document `types.ts`, `private.ts`, and `meta.f.mjs` beside the existing
      JavaScript/FunctionalScript file conventions, including host `.mjs` and
      descriptive companions.
- [ ] Update `fjs/AGENTS.md` to allow `types.ts` and `private.ts` as the authored
      TypeScript type-module roles, document the public-declaration-closure rule,
      and prohibit file-scope `@typedef` in every authored `.mjs` file.
- [ ] Update `fjs/fsc/README.md` and delete or narrow
      `todo/blocked/jsdoc-typedef-strip-internal.md` so they no longer prescribe
      a conflicting private-JSDoc strategy.
- [ ] Prohibit file-scope JSDoc `@typedef` in every authored `.mjs`, including
      `.f.mjs`, host `module.mjs` / `proof.mjs`, and descriptive companions;
      allow function-local `@typedef` everywhere.
- [ ] Keep the leading `_` convention for every private type and private runtime
      metadata constant name.
- [ ] Move public file-scope named types from authored `.mjs` JSDoc into
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
      literal constants, and runtime-used tables; prefix private ones with `_`
      even when they must be exported for sibling-module access.
- [ ] Move file-scope private proofs over those constants to `private.ts` (or
      `types.ts` when part of the public declaration closure) and use
      `import type { ... }`.
- [ ] Treat moves of public runtime constants to `meta.f.mjs` as breaking API
      changes; update runtime importers and changelog, with no compatibility
      re-exports.
- [ ] Require every import in `types.ts` and `private.ts` to use named
      `import type { ... }`.
- [ ] Update Node and Deno coverage filters to include `meta.f.mjs`; emergent
      testing already loads it, and the existing coverage thresholds apply.
- [ ] Keep `private.ts` in normal TypeScript checking without runtime JS emit.
- [ ] Make deletion of generated `private.d.ts` the final `prepack` step.
- [ ] Do not rewrite/post-process emitted declarations to remove retained JSDoc
      `@import` comments; they are non-semantic in `.d.ts` / `.d.mts`.
- [ ] Inspect the `npm pack` artifact for private files and **semantic** private
      declaration dependencies, ignoring retained comments.
- [ ] Add a fixture covering:
      - a private helper required by a public type alias;
      - a private helper required by an exported runtime value/function
        declaration (the `_SortedArray`/`find` shape);
      - an implementation-private type in `private.ts`;
      - a function-local typedef depending on a lexical value;
      - a FunctionalScript descriptive companion such as `testlib.f.mjs` whose
        former file-scope typedef is moved to the appropriate TypeScript file;
      - a non-FunctionalScript authored `.mjs` file whose former file-scope
        typedef is moved to the appropriate TypeScript file;
      - `meta.f.mjs` with RTTI, literal, runtime-used, and private `_` constants.
- [ ] Include a retained JSDoc `@import ... './private.ts'` comment in an emitted
      declaration fixture and verify the clean consumer succeeds without
      `private.ts`; this proves comments do not create package dependencies.
- [ ] Verify the normal test runner loads fixture `meta.f.mjs` and Node/Deno
      coverage includes it under the existing thresholds.
- [ ] Verify source checking, declaration emit/cleanup, Node+Deno coverage,
      packing, and clean-consumer type checking.

### Acceptance criteria

- No authored `.mjs` file contains a file-scope JSDoc `@typedef`, regardless of
  basename, FunctionalScript marker, or role.
- Function-local JSDoc `@typedef` is allowed everywhere; private names keep `_`
  and do not escape as exported declaration aliases.
- `types.ts` is the public declaration closure: public types plus any private
  helpers required transitively to express shipped declarations of public types
  or exported runtime values/functions.
- `private.ts` contains only implementation-private file-scope types outside the
  public declaration closure and is expected to be used sparingly where
  `types.ts` already describes most of a module's type surface.
- `types.ts` and every packed public declaration are independent of `private.ts`.
- Every import in `types.ts` and `private.ts` uses named `import type { ... }`.
- Runtime constants referenced by TypeScript definitions/proofs live in
  `meta.f.mjs`, whether RTTI or not. Private constants use leading `_` even when
  exported for sibling-module access; `_` marks them private by contract.
  Emergent testing loads `meta.f.mjs`, Node and Deno coverage filters include it,
  and the existing coverage thresholds apply; this convention does not prescribe
  how developers satisfy those thresholds.
- Moving public types to `types.ts` and public runtime metadata to `meta.f.mjs`
  are breaking migrations: importers and changelog are updated and no
  compatibility re-exports preserve old entry points.
- Declaration emit may create `private.d.ts`; final-`prepack` cleanup removes it
  before package contents are selected.
- Emitted declarations are not text-postprocessed: retained JSDoc `@import`
  comments may mention `private.ts` and are allowed because they do not create a
  TypeScript module dependency.
- The packed tarball contains neither `private.ts` nor `private.d.ts`, and no
  packed declaration has a semantic dependency on the private module.
- Public declaration helpers retained in `types.ts` remain self-contained and
  resolvable from shipped declarations, including helpers used by exported
  runtime-value/function signatures.
- `fjs/AGENTS.md` no longer says `types.ts` is the only authored TypeScript and
  documents both `types.ts` and `private.ts`, the declaration-closure rule, and
  the all-authored-`.mjs` file-scope typedef prohibition.
- `fjs/fsc/README.md` and the blocked `@internal`/`stripInternal` TODO no longer
  prescribe a conflicting private-JSDoc strategy.
- A clean TypeScript consumer type-checks successfully against the packed
  tarball after private artifacts are removed, including when retained comments
  mention the removed private source path.

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
