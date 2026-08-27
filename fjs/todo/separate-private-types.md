## Keep private types out of public declarations

**Priority:** P2
**Status:** wip

### Problem

TypeScript declaration emit turns file-scope JSDoc `@typedef`s in authored
`.mjs` files into declaration aliases. Implementation-private `_` types therefore
leak into generated `.d.ts` / `.d.mts` files and add noise to the public surface.

The requirement is a clean, self-contained public declaration/API boundary.
`private.ts` and subordinate modules such as `meta/module.f.mjs` are **tools** for
reaching that result, not required companion files.

### Progress

The rules, the policy documents, and the packaging step are in place; what
remains is migrating the authored `.mjs` files written before them.

Done:

- root `AGENTS.md`, `fjs/AGENTS.md` ("Private types" under §3.2 and §3.5), and
  `fjs/fsc/README.md` state the rule, the public declaration closure, the
  optional `private.ts` and `meta/module.f.mjs`, and the dependency order;
- `todo/blocked/jsdoc-typedef-strip-internal.md` is deleted — the `@internal` /
  `stripInternal` wait is superseded, not merely narrowed — and its referrers
  point here;
- `prepack` ends with `node ./fjs/ci/prepack.mjs`, which deletes every generated
  `private.d.ts` and then fails packaging if a remaining declaration has a
  *semantic* dependency on a private module. The check reads static module
  specifiers as tokens (`specifiers` in `fjs/website/browser-source.mjs`), so a
  retained JSDoc `@import` comment is not mistaken for one and no emitted text is
  rewritten;
- `fjs/djs/tokenizer` is the first module with a `private.ts`: `_Token`,
  `_FlatToken`, `_TokenScanState`, `_StringDecodeState` and `_DjsScanState` left
  its declaration, which now names none of them. Validated against the packed
  tarball — no private artifact in it, and a clean TypeScript consumer of
  `fjs/djs/tokenizer` type-checks with `bad.ts` still failing TS2322.

Remaining: the other authored `.mjs` files that still hold a file-scope
`@typedef`, including the individually-analyzed cases below and `todo/proof.f.mjs`
outside `fjs/`.

### Rules

#### No file-scope typedefs in authored `.mjs`

No authored `.mjs` anywhere in the repository may contain a **file-scope** JSDoc
`@typedef`, regardless of directory, basename, or whether the file is
FunctionalScript. This includes `module.f.mjs`, `proof.f.mjs`, host `.mjs` files,
descriptive companions such as `testlib.f.mjs`, and root/`todo/` files such as
`todo/proof.f.mjs`.

Function-local typedefs remain allowed. This is especially useful for compile-time
proofs that need lexical or downstream runtime values:

```js
const signatures = () => {
    /** @typedef {Assert<Equal<ReturnType<typeof step<...>>, Effect<...>>>} _Step */
    /** @typedef {Assert<Equal<ReturnType<typeof catchStep<...>>, Effect<...>>>} _CatchStep */
}
```

Private type and runtime constant names continue to use a leading `_`.

#### Public declaration closure

`types.ts` describes the public declaration closure:

- public types;
- private `_` helpers required transitively by shipped public declarations,
  including declarations of exported runtime functions/values.

For example, if an exported `find` declaration contains `_SortedArray<T>`, then
`_SortedArray` is part of the public declaration closure and stays in `types.ts`
(or is inlined). Moving it to an unshipped private module would make the public
declaration incomplete.

`types.ts` must not depend on `private.ts`.

`private.ts` is optional. Use it only when separating implementation-private
file-scope types outside the public declaration closure makes the design cleaner.
Do not create it mechanically for every `_` name.

#### Dependency order

Within one module directory, preserve the dependency direction for the roles that
exist:

```text
types.ts <- private.ts <- module.f.mjs <- proof.f.mjs <- module.mjs <- proof.mjs
```

The arrow points from dependency to dependent. This is a layering guide, not a
requirement that every file or edge exists. A subordinate module such as
`meta/module.f.mjs` is a separate module and is therefore described separately
below rather than appearing in this intra-directory diagram.

Move verification downstream before moving implementation upstream. For example,
`fjs/effects/types.ts` currently imports implementation functions only to assert
`ReturnType<typeof ...>` signatures. Those assertions verify `module.f.mjs`, so
move them into one or more proof functions in `proof.f.mjs`; keep the functions
in `module.f.mjs`.

Analyze constrained and recursive cases individually rather than inventing broad
exceptions:

- `fjs/media/revision`: `LockMap` / `LockSchema` can remain in `types.ts`; recursive
  `lock` can remain in `module.f.mjs` when it requires the named `LockSchema`
  annotation; move `Assert<Check<...>>` consistency checks into a proof function.
- `fjs/edag`: recursive RTTI such as `exp` can remain in `module.f.mjs` when its
  annotation depends on public EDAG types; move file-scope consistency asserts
  into proof functions.

The goal is to preserve the dependency direction and simplify the public surface,
not to satisfy a mechanical file-placement rule.

### Optional metaprogramming submodule

When declarative runtime constants are shared between TypeScript and runtime code,
it can be useful to split them into a normal subordinate module, for example:

```text
meta/
    module.f.mjs
```

`meta` here means **metaprogramming**: declarative definitions of types/schema-like
information that are useful at both compile time (TypeScript through `typeof`,
RTTI conversion, indexed access, etc.) and runtime.

Typical examples are:

- RTTI/schema constants;
- `as const`-style literal data;
- declarative lookup tables whose literal shape defines or constrains types.

This is only a suggestion. Do not create `meta/` merely because a runtime value
appears in a type proof. Ordinary implementation functions stay in
`module.f.mjs`; recursively annotated metadata may also stay there when moving it
would reverse the dependency direction.

The parent module may depend on `meta/module.f.mjs` like any other lower-level
module. The `meta/` module itself follows the same normal module conventions and,
if it grows additional files, its own intra-directory dependency order.

A private constant exported from `meta/module.f.mjs` for sibling-module linkage
uses a leading `_`:

```js
// meta/module.f.mjs
export const _framingKeywords =
    /** @type {const} */ (['import', 'const', 'export', 'default', 'from'])
```

```ts
// private.ts or types.ts
import type { _framingKeywords } from './meta/module.f.mjs'
```

```js
// module.f.mjs
import { _framingKeywords } from './meta/module.f.mjs'
```

Exportability is linkage, not API status: `_` means consumers must not depend on
the name. Renaming/removing it is not breaking solely because it is exported.

Because `meta/module.f.mjs` is just another `module.f.mjs`, existing tooling
already handles it:

- emergent testing loads it as `*.f.mjs`;
- the existing Node `**/module.f.mjs` coverage filter includes it;
- the existing Deno `.*module\\.f\\.mjs` filter includes it.

No special metadata filename or coverage rule is needed.

### Breaking migrations

Moving an existing public type from an authored `.mjs` declaration surface to
`types.ts` changes its public type import path. Moving an existing public runtime
constant into a subordinate module such as `meta/module.f.mjs` changes its runtime
import path.

When such moves are chosen, treat them as intentional breaking changes:

- update every repository importer;
- update the changelog;
- do **not** add compatibility typedefs, exports, or re-exports to preserve the
  old entry point.

Private `_` names are not public API merely because declaration emit or module
linkage exposes them.

### Declaration emission and packaging

If `private.ts` is used, keep it in the normal TypeScript program so source users
are checked. Declaration emit may therefore create an intermediate
`private.d.ts`.

Do not try to exclude `private.ts` from checking. Instead delete generated
`private.d.ts` files as the final `prepack` step, after declaration emit and the
existing declaration round-trip check, before package contents are selected.

Do **not** rewrite/post-process emitted declaration text. TypeScript may retain a
source comment such as:

```js
/** @import { _Private } from './private.ts' */
```

inside an emitted declaration. In `.d.ts` / `.d.mts` this is only a comment, not
a TypeScript module dependency, so it may remain after the private declaration is
removed.

Package validation must check semantic dependencies, not raw text:

- no authored/generated private type artifact that is intended to be unshipped is
  present in the tarball;
- no packed declaration semantically depends on an unshipped private type module;
- a clean TypeScript consumer installed from the tarball type-checks successfully.

### Repository policy

Done, see Progress above: root `AGENTS.md` carries the repository-wide rule,
`fjs/AGENTS.md` the public-declaration-closure rule with the optional
`private.ts`, the optional `meta/module.f.mjs`, and the dependency order, and
`fjs/fsc/README.md` the private-type contract that replaced its `_`-leak-tolerance
policy. `todo/blocked/jsdoc-typedef-strip-internal.md` is deleted, so the
repository no longer keeps two conflicting private-type strategies.

Authored TypeScript type modules (`types.ts`, and `private.ts` when present) remain
type-only and use named `import type { ... }` imports.

### Tasks

- [x] Document the repository-wide prohibition on file-scope JSDoc `@typedef` in
      authored `.mjs`; allow function-local typedefs.
- [ ] Migrate existing violations, including authored `.mjs` outside `fjs/` such
      as `todo/proof.f.mjs`.
- [ ] Keep `types.ts` as the public declaration closure; retain/in-line private
      helpers required by public declarations.
- [x] Use `private.ts` only where separating implementation-private file-scope
      types improves the design — first one: `fjs/djs/tokenizer/private.ts`.
- [ ] Preserve the intra-directory dependency direction shown above; move
      verification downstream when that is cleaner.
- [ ] Move the `fjs/effects/types.ts` implementation-signature asserts into proof
      functions in `fjs/effects/proof.f.mjs`.
- [ ] Review recursive cases individually, including `fjs/media/revision` and
      `fjs/edag`; keep recursive RTTI in `module.f.mjs` when required by layering
      and move consistency asserts into proof functions.
- [ ] Where useful, split declarative compile-time/runtime constants into a normal
      subordinate module such as `meta/module.f.mjs`; do not require it.
- [ ] Preserve leading `_` for private types and private runtime constants.
- [ ] Treat chosen public import-path moves as breaking changes with no
      compatibility re-exports.
- [x] If `private.ts` is used, delete generated `private.d.ts` as the final
      `prepack` step.
- [x] Do not text-postprocess emitted declarations; validate semantic private
      dependencies and clean-consumer type checking instead.
- [ ] Add fixtures/examples covering: public-declaration helpers, optional
      `private.ts`, function-local proof typedefs, recursive RTTI kept in
      `module.f.mjs`, optional `meta/module.f.mjs`, retained non-semantic JSDoc
      comments, and authored `.mjs` outside `fjs/`.
- [x] Update root/fjs policy documentation and reconcile the old `_` leak policy.

### Acceptance criteria

- The public declaration/API surface is clean and self-contained.
- No authored `.mjs` anywhere in the repository contains a file-scope JSDoc
  `@typedef`; function-local typedefs are allowed.
- `types.ts` contains the public declaration closure and does not depend on an
  unshipped private type module.
- `private.ts`, when present, is an optional implementation tool rather than a
  required companion.
- A subordinate module such as `meta/module.f.mjs`, when present, is an optional
  metaprogramming/design tool rather than a special file role or requirement.
- The intra-directory dependency direction is preserved; assertions do not create
  reverse edges merely for convenience.
- Private types/constants use leading `_`, even when linkage requires an export.
- Existing `module.f.mjs` discovery and coverage rules automatically include
  `meta/module.f.mjs`; no metadata-specific coverage convention exists.
- Chosen public import-path moves are breaking migrations with importers/changelog
  updated and no compatibility re-exports.
- If declaration emit creates `private.d.ts`, final-`prepack` cleanup removes it
  before packaging.
- Emitted declarations are not text-postprocessed; retained JSDoc `@import`
  comments are allowed when they are non-semantic.
- The packed artifact has no semantic dependency on an unshipped private type
  module, and a clean TypeScript consumer type-checks successfully.
- Root `AGENTS.md`, `fjs/AGENTS.md`, `fjs/fsc/README.md`, and the blocked
  `@internal` TODO no longer prescribe conflicting rules.

### Related

- [`../fsc/README.md`](../fsc/README.md) — the private-type contract that
  replaced the `_` leak-tolerance policy.
- [`../../AGENTS.md`](../../AGENTS.md) — root repository policy; carries the
  repository-wide no-file-scope-`@typedef` rule.
- [`../AGENTS.md`](../AGENTS.md) — `fjs/`-specific file/dependency policy;
  "Private types" holds the closure, `private.ts`, `meta/` and dependency order.
- [`../ci/prepack.mjs`](../ci/prepack.mjs) — the final `prepack` step: drops
  generated `private.d.ts` and checks the remaining declarations for a semantic
  dependency on a private module.
- [`../djs/tokenizer/private.ts`](../djs/tokenizer/private.ts) — the first
  `private.ts`.
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
