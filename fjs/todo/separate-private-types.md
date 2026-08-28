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
   rules: exclude generated `private.d.ts` from the package and validate the
   packed artifact semantically.

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

Do not try to exclude `private.ts` from *checking*. Exclude the generated
`private.d.ts` from *packing* instead, by a negation in `package.json`'s `files`:

```json
"files": ["**/*.js", "**/*.d.ts", "**/*.mjs", "**/*.d.mts", "!**/private.d.ts"]
```

Measured with `npm pack --dry-run --json`: 675 packed files become 659, and the
16 that disappear are exactly the 16 emitted `private.d.ts`.

Prefer this to a deletion step in `prepack`. It needs no script, no directory
walk, and no proof for a path predicate; `prepack` keeps doing exactly what it
does now (emit declarations, then re-check with them present); and it leaves the
working tree alone, so a contributor who runs `npm pack` does not silently lose
the declarations a following `npx tsc` expects. It also states the intent where
the rest of the package contents are declared, rather than in a build step that
has to be read to be discovered.

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
- every declaration in the tarball, installed as a clean TypeScript dependency,
  type-checks successfully.

#### The check has to run in CI, on the packed artifact, without the repository

Excluding `private.d.ts` from the package is invisible to every check the
repository has. `npx tsc` reads the *source* `private.ts`, so it stays green
whatever the tarball omits; `node26` runs `npm pack` but nothing installs or
type-checks the result, and the `npm install -g functionalscript@<version>`
steps install the *published* CLI, not the artifact just built. Stage 2 would
therefore ship a claim that nothing could falsify — the same "a sweep, not a
check" gap the Stage 1 grep guard closes. Only a consumer that reads the packed
declarations can catch a declaration left pointing at a file the package no
longer carries.

The shape that makes it a real check:

1. a job that packs (`npm pack`) and uploads the tarball as a CI artifact;
2. a **second job with no repository checkout**, ordered after the first by an
   explicit `needs`, that downloads that artifact, installs it
   (`npm install ./functionalscript-*.tgz typescript`), and type-checks
   **every declaration the package ships**.

The missing checkout is the point, and it is stronger than merely working in a
directory outside the repository: with no repository on the runner, there is no
`tsconfig.json` up the tree to inherit, no `node_modules` to resolve into, and
no source file that could stand in for a declaration the tarball omits. The
check can only see what a real consumer sees.

Three details decide whether that job can fail at all:

- **Check every packed declaration, not a hand-written consumer.** The
  temptation is a small `consumer.mts` importing the surfaces known to carry
  private types. That check is only as current as its import list: a module
  that gains a `private.ts` *later* is not in the program, so its dangling
  declaration passes unseen while the job stays green. Enumerate the packed
  `.d.ts` / `.d.mts` from the installed package and pass them all to `tsc` as
  root files instead — the set is derived from the artifact, so it cannot go
  stale.
- **Do not set `skipLibCheck`.** It defaults to `false`, which is what makes
  TypeScript open the packed declarations and report a dangling private
  reference. `tsc --init` writes `"skipLibCheck": true`; if that creeps in, the
  job silently stops checking the thing it exists for. (This matters even with
  the declarations as root files: `skipLibCheck` suppresses checking of
  declaration files however they entered the program.)
- **Install the tarball as a dependency; do not unpack it into `node_modules`
  by hand.** A later `npm install` prunes anything not in `package.json` and
  removes it, which turns the whole job into a no-op on an empty file list.

Because a red required check blocks the merge queue, a reintroduced dependency
becomes the author's problem at the moment it is introduced, which is the whole
point of preferring a check to a sweep.

Measured on the tree at the time of writing, with the tarball installed into a
scratch consumer and the 16 `private.d.ts` removed from it:

- the remaining 377 declarations type-check with `skipLibCheck: false` — exit
  `0`, so the exclusion is safe today (the `private.ts` mentions that survive
  emit are JSDoc `@import` comments, which are inert);
- appending a real `import type { … } from './private.js'` to one packed
  declaration turns that exit `2` with `TS2307`, so the check is falsifiable;
- and the gap the first bullet describes is not hypothetical: with that
  injection placed in `fjs/emergent_testing` — a module with no `private.ts`
  today, standing in for a future one — a consumer importing all 16 of today's
  private-carrying surfaces still exits `0`, while the exhaustive form exits
  `2`. A fixed import list would have shipped a check that cannot see the case
  it exists to catch.

The job is added through the CI generator (`fjs/ci/**`, composed in
`fjs/ci/module.f.mjs`), never by editing `.github/workflows/ci.yml`, which
`npm run ci-update` regenerates.

This fixture is already scoped in
[`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md),
where the clean packed-consumer validation was performed **manually** in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520) and the
committed CI fixture is the remaining work. Stage 2 completes that fixture and
adds the private-declaration assertion to it rather than standing up a second
package-validation path.

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
- delete or narrow `todo/blocked/jsdoc-typedef-strip-internal.md`: this design
  supersedes waiting for `@internal`/`stripInternal`, so the repository does not
  keep two conflicting private-type strategies;
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

- [ ] Exclude generated `private.d.ts` from the package with a `!**/private.d.ts`
      negation in `package.json`'s `files`; leave `prepack` unchanged.
- [ ] Do not text-postprocess emitted declarations; validate semantic private
      dependencies and clean-consumer type checking instead.
- [ ] Upload the `npm pack` tarball as a CI artifact, and add a **second job
      with no repository checkout** that downloads it, installs it as a real
      dependency (`npm install ./functionalscript-*.tgz typescript` — hand-
      unpacking into `node_modules` is pruned by the next `npm install`), and
      type-checks **every declaration the package ships**, enumerated from the
      installed artifact rather than from a hand-written import list: a module
      that gains a `private.ts` later would never enter a fixed consumer's
      program. Leave `skipLibCheck` unset — it defaults to `false`, which is
      what makes the check able to fail. Add both through the CI generator
      (`fjs/ci/**`, composed in `fjs/ci/module.f.mjs`), not by editing
      `.github/workflows/ci.yml`. Complete the fixture already scoped in
      [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md)
      rather than adding a second package-validation path.
- [ ] Give the second job an explicit `needs` edge on the pack job. Without it
      GitHub Actions starts the two in parallel and `download-artifact` fails
      before the check has run — a red required check for the wrong reason.
      This is a prerequisite, not a detail: `jobSchema` in
      `fjs/ci/common/module.f.mjs` is **closed** and names only `runs-on` and
      `steps`, and it is the same schema `parseGitHubAction` reads the
      generated workflow back through, so emitting a bare `needs:` key would
      fail that round-trip in `fjs/ci/proof.f.mjs`. Extend the schema
      (`needs: or(option, array(string))`, matching the existing optional-field
      idiom in `stepSchema`), which widens `Job` in `fjs/ci/common/types.ts`,
      and cover the new field in the proof.
- [ ] Make that job a required check, so a reintroduced private dependency
      blocks the merge queue rather than landing.
- [ ] Assert the tarball's contents (no `private.d.ts` inside) alongside that
      job — a cheap complement to the semantic declaration check, never its
      replacement.
- [ ] Prove each half can fail, with its own negative control — they fail on
      opposite inputs, so one control cannot stand for both. Dropping the
      `files` negation leaves `private.d.ts` *in* the tarball, where every
      reference to it resolves: that reddens the contents assertion and leaves
      the type-check green. The type-check's control is the reverse — a packed
      declaration that references a private module the tarball does not carry
      (a shipped declaration made to depend on `private.ts`, with the negation
      still in place), which resolves in-repo and dangles once packed. Place
      that control in a module with **no** `private.ts` today, so it also
      proves the check is exhaustive rather than pinned to today's surfaces.
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
- Generated `private.d.ts` files are excluded from the package by
  `package.json`'s `files`, with `prepack` unchanged.
- Emitted declarations are not text-postprocessed; retained JSDoc `@import`
  comments are allowed when they are non-semantic.
- The packed artifact has no semantic dependency on an unshipped private type
  module, and every declaration it ships type-checks successfully.
- That check runs **in CI**, from the packed tarball handed over as an
  artifact, in a job with **no repository checkout** and with `skipLibCheck`
  left at its `false` default — the only arrangement in which a declaration
  pointing at an omitted `private.d.ts` is an error rather than a silently
  skipped library file or a resolution into the source tree.
- Its file set is derived from the installed artifact, so a module that gains a
  `private.ts` after the job is written is checked without the job being
  edited.
- That job `needs` the pack job, so it never races the upload, and the closed
  `jobSchema` / `Job` / proof in `fjs/ci/common` are extended to express it
  rather than the key being emitted past the schema.
- That job is a required check, so the failure blocks the merge queue.
- Both halves are demonstrably falsifiable, each by the input that actually
  breaks it: dropping the `files` negation reddens the contents assertion, and
  a packed declaration depending on a private module the tarball does not carry
  — placed in a module that has no `private.ts` today — reddens the
  declaration type-check.
- The CI job is generated from `fjs/ci/**`, so `npm run ci-update` reproduces
  `.github/workflows/ci.yml` byte-identically.
- `fjs/fsc/README.md` no longer needs tolerance for a shipped `private.d.ts`,
  since none ships, and still documents the permanent `_` contract: `_` names
  emitted into shipped declarations are not API.

### Related

- [`../fsc/README.md`](../fsc/README.md) — the `_` contract and the remaining
  `private.d.ts` tolerance Stage 2 retires.
- [`../../AGENTS.md`](../../AGENTS.md) — root repository policy.
- [`../AGENTS.md`](../AGENTS.md) — `fjs/`-specific file/dependency policy.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md)
  — the packed-consumer CI fixture Stage 2 completes.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream JSDoc typedef stripping limitation; superseded as this design's
  strategy, since no authored `.mjs` declares a typedef to strip.
- [`detect-unexported-types-referenced-by-exported-types.md`](./detect-unexported-types-referenced-by-exported-types.md)
  — related declaration-leak detection.
- [`document-file-type-naming-conventions.md`](./document-file-type-naming-conventions.md)
  — repository source-file roles.
- [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md)
  — current JavaScript/JSDoc migration and `_` convention.
- [`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md)
  — declaration emission and clean package validation.
