## Keep private types out of public declarations

**Priority:** P2
**Status:** open

### Problem

TypeScript declaration emit turns file-scope JSDoc `@typedef`s in authored
`.mjs` files into declaration aliases. Implementation-private `_` types therefore
leak into generated `.d.ts` / `.d.mts` files and add noise to the public surface.

The requirement is a clean, self-contained public declaration/API boundary.
`private.ts` and subordinate modules such as `meta/module.f.mjs` are **tools** for
reaching that result, not required companion files.

### Staging

The work lands in two stages that are shippable independently:

1. **Stage 1 — source restructuring.** Everything below except
   [Declaration emission and packaging](#declaration-emission-and-packaging):
   the file-scope typedef prohibition, the public declaration closure in
   `types.ts`, optional `private.ts` and `meta/module.f.mjs`, the dependency
   order, breaking migrations, and the matching policy documentation.
2. **Stage 2 — packaging cleanup.** The
   [Declaration emission and packaging](#declaration-emission-and-packaging)
   rules: delete generated `private.d.ts` as the final `prepack` step and
   validate the packed artifact semantically.

Stage 1 is complete on its own. While Stage 2 has not landed, generated
`private.d.ts` files ship in the package. That is safe: `types.ts` must not
depend on `private.ts`, so no shipped public declaration semantically depends
on a `private.d.ts` — the shipped file is declaration noise only, the same
leak the existing `_` tolerance policy
([`../fsc/README.md`](../fsc/README.md)) already covers, consolidated into one
file per module. Deleting it in Stage 2 is therefore not a breaking change.

Only the leak-tolerance **contract** survives Stage 1: consumers must not
depend on emitted `_` names or on a shipped `private.d.ts`, so removing them
later is not breaking. The **prescription** to create file-scope `_` typedefs
and the wait-for-`@internal`/`stripInternal` strategy contradict Stage 1 and
are rewritten as part of it.

The `_` half of that contract is permanent, not a Stage 2 leftover: `_`
helpers retained in `types.ts` by the public declaration closure and `_`
constants exported from `meta/module.f.mjs` for linkage keep shipping in
`types.d.ts` / `module.d.mts` after Stage 2. Stage 2 retires only the
`private.d.ts` tolerance.

A Stage 1 PR checks off the Stage 1 tasks and leaves this file in place; the
Stage 2 PR deletes it.

### Rules (Stage 1)

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

This section is Stage 2. It may land after Stage 1 as a separate change.

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

When Stage 1 is implemented:

- update root `AGENTS.md` with the repository-wide rule that authored `.mjs` files
  may not contain file-scope JSDoc `@typedef`;
- update `fjs/AGENTS.md` with the public-declaration-closure rule, optional
  `private.ts`, optional subordinate metaprogramming modules such as
  `meta/module.f.mjs`, and the dependency-order guidance;
- rewrite the "Private JSDoc typedefs" section of `fjs/fsc/README.md`: authors
  no longer create file-scope `_` typedefs; keep the leak-tolerance contract
  for emitted `_` names and shipped `private.d.ts` until Stage 2;
- **done** — `jsdoc-typedef-strip-internal` was deleted with Stage 1: this
  design supersedes waiting for `@internal`/`stripInternal`, so the repository
  does not keep two conflicting private-type strategies;
- sweep the remaining Markdown documents repo-wide — `todo/` issues, plans,
  and READMEs — for text that prescribes adding a file-scope JSDoc `@typedef`
  to an authored `.mjs` or defers private types to `@internal`/`stripInternal`,
  and retarget each to the Stage 1 forms: `types.ts`, optional `private.ts`,
  function-local typedefs. The sweep is defined by the search, not by a list;
  instances known at the time of writing are
  `todo/migrate-typescript-to-mjs.md` ("Preserve private type intent with `_`"
  and the typedef-visibility migration task),
  `fjs/ci/todo/f-mjs-package-support.md` (its declaration-emission narrative
  and its `_`-typedef fixture task), and
  `fjs/effects/memory/todo/sync-interpreter-owner.md` (its proposed
  `MemoryState` file-scope typedef belongs in `types.ts`).

When Stage 2 is implemented:

- narrow the `fjs/fsc/README.md` leak tolerance to what still ships by design:
  drop the tolerance for shipped `private.d.ts`, which no longer exists, and
  keep the permanent `_` contract — `_` names emitted into `types.d.ts` /
  `module.d.mts` are not API, and renaming or removing one is not by itself a
  breaking change.

Authored TypeScript type modules (`types.ts`, and `private.ts` when present) remain
type-only and use named `import type { ... }` imports.

### Tasks

#### Stage 1 — source restructuring

- [x] Document the repository-wide prohibition on file-scope JSDoc `@typedef` in
      authored `.mjs`; allow function-local typedefs.
- [x] Migrate existing violations, including authored `.mjs` outside `fjs/` such
      as `todo/proof.f.mjs`.
- [x] Keep `types.ts` as the public declaration closure; retain/in-line private
      helpers required by public declarations.
- [x] Use `private.ts` only where separating implementation-private file-scope
      types improves the design.
- [x] Preserve the intra-directory dependency direction shown above; move
      verification downstream when that is cleaner.
- [x] Move the `fjs/effects/types.ts` implementation-signature asserts into proof
      functions in `fjs/effects/proof.f.mjs`.
- [x] Review recursive cases individually, including `fjs/media/revision` and
      `fjs/edag`; keep recursive RTTI in `module.f.mjs` when required by layering
      and move consistency asserts into proof functions.
- [x] Where useful, split declarative compile-time/runtime constants into a normal
      subordinate module such as `meta/module.f.mjs`; do not require it. The
      migration warranted none: every recursive metaprogramming constant
      (`fjs/edag`, `fjs/media/json/schema`) reads best staying in its
      `module.f.mjs`; the option stays documented in `fjs/AGENTS.md` §3.2.
- [x] Preserve leading `_` for private types and private runtime constants.
- [x] Treat chosen public import-path moves as breaking changes with no
      compatibility re-exports.
- [x] Add fixtures/examples covering: public-declaration helpers, optional
      `private.ts`, function-local proof typedefs, recursive RTTI kept in
      `module.f.mjs`, optional `meta/module.f.mjs`, and authored `.mjs` outside
      `fjs/`. Live modules serve as the examples, cited from `fjs/AGENTS.md`
      §3.2: `fjs/types/byte_set/types.ts` (`_Byte` public-closure helper),
      `fjs/common/monoid/private.ts` and `fjs/rtti/data/private.ts`
      (`private.ts`), `fjs/edag/proof.f.mjs` and `fjs/effects/proof.f.mjs`
      (function-local proof typedefs), `fjs/edag/module.f.mjs` and
      `fjs/media/json/schema/module.f.mjs` (recursive RTTI kept in place),
      `todo/proof.f.mjs` (authored `.mjs` outside `fjs/`); `meta/module.f.mjs`
      remains a documented option with no current instance.
- [x] Update root and `fjs/` `AGENTS.md` policy documentation; rewrite the
      `fjs/fsc/README.md` typedef prescription; delete or narrow the blocked
      `@internal` TODO; sweep all remaining Markdown documents for file-scope
      typedef prescriptions and retarget each to the Stage 1 forms.

#### Stage 2 — packaging cleanup

- [ ] If `private.ts` is used, delete generated `private.d.ts` as the final
      `prepack` step.
- [ ] Do not text-postprocess emitted declarations; validate semantic private
      dependencies and clean-consumer type checking instead.
- [ ] Add fixtures covering packaging: retained non-semantic JSDoc `@import`
      comments in emitted declarations, absent private artifacts in the tarball,
      and a clean package consumer.
- [ ] Narrow the `fjs/fsc/README.md` leak tolerance: drop the `private.d.ts`
      tolerance, keep the permanent `_` contract for `_` declarations that
      still ship (`types.ts` helpers, exported `meta/module.f.mjs` constants).

### Acceptance criteria

#### Stage 1 — source restructuring

- The public declaration surface is self-contained; no public declaration
  semantically depends on `private.ts`. Generated `private.d.ts` files may
  still ship until Stage 2 — the leak is consolidated, not yet removed.
- No authored `.mjs` anywhere in the repository contains a file-scope JSDoc
  `@typedef`; function-local typedefs are allowed.
- `types.ts` contains the public declaration closure and does not depend on
  `private.ts`.
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
- Root `AGENTS.md` and `fjs/AGENTS.md` document the Stage 1 rules.
- No repository document prescribes creating file-scope JSDoc typedefs or
  waiting for `@internal`/`stripInternal` — verified by a repo-wide search,
  not by checking an enumerated list. The permanent `_` contract stays
  documented, and the shipped `private.d.ts` tolerance stays documented until
  Stage 2.

#### Stage 2 — packaging cleanup

- The public declaration/API surface is clean: no private type artifact that is
  intended to be unshipped is present in the tarball.
- If declaration emit creates `private.d.ts`, final-`prepack` cleanup removes it
  before packaging.
- Emitted declarations are not text-postprocessed; retained JSDoc `@import`
  comments are allowed when they are non-semantic.
- The packed artifact has no semantic dependency on an unshipped private type
  module, and a clean TypeScript consumer type-checks successfully.
- `fjs/fsc/README.md` no longer needs tolerance for a shipped `private.d.ts`,
  since none ships, and still documents the permanent `_` contract: `_` names
  emitted into shipped declarations are not API.

### Related

- [`../fsc/README.md`](../fsc/README.md) — current `_` leak-tolerance policy.
- [`../../AGENTS.md`](../../AGENTS.md) — root repository policy to update.
- [`../AGENTS.md`](../AGENTS.md) — `fjs/`-specific file/dependency policy.
- jsdoc-typedef-strip-internal (retired; deleted with Stage 1, which supersedes
  it) — the former wait-for-`@internal`/`stripInternal` strategy.
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
