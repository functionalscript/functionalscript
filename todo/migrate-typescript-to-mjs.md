## Migrate authored TypeScript to `.mjs`

**Priority:** P1
**Status:** open

### Problem

FunctionalScript currently uses authored `.ts` / `.f.ts` source and generated
`.js` output. The compiler migration also used `.f.mjs` as a marker for modules
accepted by the current FunctionalScript compiler. Those two migrations should
not be coupled: removing TypeScript is a repository-wide source-language
migration, while compiler compatibility depends on the feature set implemented
by the FunctionalScript parser/compiler.

Keeping unsupported modules as `.f.ts` until the FunctionalScript compiler can
parse them would unnecessarily block the TypeScript removal. It also prevents us
from eventually using `.f.js` as the simple compiler-compatibility marker,
because TypeScript currently generates `.f.js` from `.f.ts` and `.gitignore`
blanket-ignores `**/*.js`.

The repository therefore needs two ordered stages:

1. migrate all authored TypeScript to JavaScript with JSDoc, independently of
   FunctionalScript compiler support;
2. after TypeScript is gone, migrate compiler-supported FunctionalScript modules
   from `.f.mjs` to authored `.f.js`.

The existing compiler-compatibility migration in
[`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md) is **blocked by** this
stage-1 task.

### Proposal

#### Stage 1 extension meaning

During this task:

```text
module.ts   -> module.mjs
module.f.ts -> module.f.mjs
```

- `.ts` / `.f.ts` are authored TypeScript that still remains to migrate;
- `.mjs` is authored ESM JavaScript with JSDoc types;
- `.f.mjs` is authored FunctionalScript-intent JavaScript with JSDoc types;
- `.f.mjs` does **not** promise that the current FunctionalScript compiler can
  parse the module;
- `.js` remains generated output and must not be authored while any TypeScript
  source remains;
- `.d.ts` / `.d.mts` remain generated declarations.

The authoritative extension contract in [`../fjs/fsc/README.md`](../fjs/fsc/README.md)
and the package plans must use these meanings throughout stage 1.

#### Enable JavaScript checking and `.f.mjs` validation first

Before the first `.ts` / `.f.ts` source file moves to `.mjs` / `.f.mjs`, enable
`allowJs` and `checkJs` in the root `tsconfig.json`. TypeScript remains the
repository type checker during this migration; JSDoc replaces TypeScript syntax
without creating an unchecked intermediate source set.

Stage 1 is **blocked by** both of these prerequisites before the first real
repository `.f.ts` -> `.f.mjs` conversion:

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  makes authored `.mjs` a checked, declaration-emitting, packable source
  extension;
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  is **blocked by** that package-support task and adds an actual `.f.mjs`
  runtime fixture proving proof execution plus Node and Deno coverage.

Package and publish jobs run only in CI from a clean checkout. The migration does
not need to preserve packability of arbitrary developer working trees or track
ignored generated outputs across source renames; a later CI package job starts
without those stale files.

#### Migrate gradually from dependency leaves

Stage 1 is incremental, not a repository-wide atomic rename. Start with authored
`.ts` / `.f.ts` files that do not depend on other authored TypeScript files, then
migrate their callers and continue upward through the dependency graph.

A file or coherent group is eligible when every relative authored runtime
source dependency and every declaration-retained type dependency outside the
group is already JavaScript (`.mjs` / `.f.mjs`). Cycles may migrate as one
coherent group.

The transition is intentionally asymmetric:

- remaining `.ts` / `.f.ts` may depend on already migrated `.mjs` / `.f.mjs`;
- migrated `.mjs` / `.f.mjs` must not depend on remaining authored `.ts` /
  `.f.ts`.

FunctionalScript parser support is not an eligibility condition. A `.f.ts` file
may move to `.f.mjs` even if the current FunctionalScript compiler does not yet
support all syntax in that file.

Proof files follow the same source-language rule. A migrated `module.f.mjs` may
keep its existing `proof.f.ts` temporarily, but `proof.f.mjs` is allowed as soon
as that proof can be expressed as JavaScript with JSDoc and every authored
runtime or declaration-retained type dependency outside its migration group is
already `.f.mjs`. Compiler support for the proof is not required. By the end of
stage 1, all remaining `proof.f.ts` files must therefore have migrated to
`proof.f.mjs` along with the rest of authored TypeScript.

Preserve TypeScript type semantics when translating to JSDoc. TypeScript 7
supports variance annotations on JSDoc type aliases through modifiers on
`@template`. For example:

```ts
export type Cont<out O extends Operation, T> =
    (_: Pr<O, O[0]>[1]) => Effect<O, T>
```

becomes:

```js
/**
 * @template {Operation} out O
 * @template T
 * @typedef {(_: Pr<O, O[0]>[1]) => Effect<O, T>} Cont
 */
```

Use `@template out T`, `@template in T`, or constrained forms such as
`@template {Operation} out O`. Variance modifiers belong to a JSDoc type alias
(`@typedef`), not to an ordinary function's `@template`.

#### Preserve private type intent with `_`

A non-exported TypeScript type can become externally visible merely by being
translated to a JSDoc `@typedef`: TypeScript currently emits JSDoc typedefs as
exported aliases in generated declarations. The upstream request to make
`@internal` plus `stripInternal` work for JSDoc typedefs is
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407).

Until that support is available, prefix implementation-only typedef names with
`_` during migration. For example:

```ts
type Node = number
export type Tree = readonly Node[]
```

becomes conceptually:

```js
/** @typedef {number} _Node */
/** @typedef {readonly _Node[]} Tree */
```

The leading `_` is the FunctionalScript API visibility convention. It does not
prevent declaration emission, so generated declarations may contain
`export type _Node = number`. `_Node` is still private by contract: consumers
must not depend on that emitted name directly, so renaming or removing `_Node`
is not a breaking change solely because TypeScript exposed the alias.

The public contract still governs transitive effects. In the example above,
`Tree` is public and depends on `_Node`; changing `_Node` from `number` to
`string` changes `Tree`'s public assignability and is therefore a breaking
change. The underscore exempts only the private alias itself, never a change to
the expanded public API. Public typedefs keep ordinary names without a leading
`_`.

Which typedefs are public is an API design decision made at the migration
boundary, not a mechanical copy of what the `.f.ts` happened to export. The
`.f.ts` -> `.f.mjs` rename is already a breaking change — importers must update
the specifier — so it is the one moment where a module's visibility contract can
be corrected at no extra cost to consumers: a former export whose only role was
an implementation detail may become `_`, and a module-private helper that belongs
to the module's public vocabulary may be published under an ordinary name. Such
a correction rides along with the migration's own `**BREAKING CHANGES:**` entry
and does not need a second one.

After a module is `.mjs` its visibility contract is settled, and the convention
then runs in one direction only. Moving a published public typedef to a `_` name
is an ordinary breaking API change from that point on: it needs its own
`**BREAKING CHANGES:**` entry and importer updates, exactly like removing any
other public declaration. Only the migration itself gets the free correction.

A pending refactor is not a reason to pre-privatize. Visibility follows what the
module should offer consumers today, not what a future task plans to delete:
`Concat` and `NotLazy` in `fjs/types/list` stay public even though
[`../fjs/types/list/todo/simplify-list-type.md`](../fjs/types/list/todo/simplify-list-type.md)
plans to remove both. Hiding a type behind `_` to make its eventual removal
cheaper gives up a real present-day API in exchange for a discount on a breaking
change that should simply be documented when it happens.

This convention is temporary. Once TypeScript can strip `@internal` JSDoc
typedefs correctly, replace the underscore workaround as tracked by
[`blocked/jsdoc-typedef-strip-internal.md`](./blocked/jsdoc-typedef-strip-internal.md).

#### Typedef documentation does not survive declaration emit

The same upstream gap has a second, opposite-facing symptom: declaration emit
drops the documentation written on a JSDoc `@typedef`. A TypeScript
`/** 8-word SHA-2 state vector. */ export type V8 = …` keeps its comment in the
emitted `.d.ts`; the equivalent `@typedef` in a `.mjs` emits as a bare
`export type V8 = …`, and the prose — including any `@example` — is gone from the
published declaration. Documentation on `export const` declarations is
unaffected, so a migrated module loses exactly its *type* documentation.

`fjs/crypto/sha2` is the clearest case so far: `V8`, `V16`, `State` and `Sha2`
were documented types, and `Sha2` carried the module's `@example` walkthrough.
All of it survives in the source and none of it reaches `module.f.d.mts`. The
loss is therefore invisible to anyone reading the repository and visible only to
a consumer of the published package.

Related upstream behavior: TypeScript sometimes re-emits a bare `@typedef`
comment attached to the *following* declaration instead
([microsoft/TypeScript#43534](https://github.com/microsoft/TypeScript/issues/43534),
fixed for the services layer), and
[microsoft/TypeScript#61664](https://github.com/microsoft/TypeScript/issues/61664)
proposes stripping redundant JSDoc type directives from declaration emit while
keeping documentation. Neither tracks this loss directly; no upstream issue for
it has been identified yet.

This does not block any migration group — it is a documentation-fidelity
regression, not a type-contract one. Record it, keep writing the documentation in
the source, and file an upstream issue so the gap is tracked rather than
rediscovered by each migration.

#### Separate the `@module` header from the first import with a blank line

A module's `@module` header can disappear from the emitted declaration too, but
that one is **not** an upstream gap — it is a source-formatting requirement, and
a blank line fixes it:

```js
/**
 * ...
 * @module
 */
                                    // <- this blank line is load-bearing
/** @import { Tuple } from '...' */
import { mask } from '...'
```

Without the blank line, the header is the leading comment of the first `import`
*statement* (an `@import` tag is a comment, not a statement, so it does not
separate them). Declaration emit rewrites the import list — dropping
runtime-only imports and synthesizing `import type` for what the declarations
actually reference — and when the statement carrying the header is not among the
survivors, the header goes with it. With the blank line the header detaches from
that statement and is emitted as the file's own leading comment.

Checked against every `.mjs` in the repository carrying an `@module` header — 24
modules, no exceptions:

| header separated from first `import` statement | header kept | count |
| ---------------------------------------------- | ----------- | ----- |
| yes                                             | yes         | 13    |
| no `import` statement at all                    | yes         | 8     |
| no                                              | **no**      | 3     |

A module with no `import` statement keeps its header unconditionally: there is no
statement for the comment to attach to, so it is already the file's own leading
comment. That is why the loss looks intermittent rather than systematic — most
migrated modules are in one of the two safe categories by accident, not by
intent.

`fjs/types/list`, `fjs/types/nullable` and `fjs/common/monoid` are the three that
currently lose their header and want the same one-line fix.

#### Known TypeScript-to-JSDoc hard cases

Do not require the migration plan to pre-design every TypeScript-only type
construct before Stage 1 starts. Instead, identify hard cases as they are found,
record them explicitly, and block only the affected migration group until its
focused design is resolved. Unrelated dependency leaves should continue to
migrate.

One known case is `fjs/types/phantom/module.f.ts`, whose public `Phantom` type
uses a type-only `declare const phantomKey: unique symbol`. `declare` is not
valid JavaScript, and replacing it with a runtime `Symbol()` would change the
module's current zero-runtime-representation design. The exact JSDoc/runtime
representation is intentionally deferred; that module and dependents that need
its declaration identity must not migrate until the focused design is decided.

The same rule applies to future TypeScript constructs without an obvious
semantics-preserving JSDoc translation: identify the issue, keep the affected
module in TypeScript temporarily, and resolve it before that group crosses the
Stage-1 boundary. Stage 1 still ends only when every such case has been resolved
and no authored `.ts` / `.f.ts` remains.

For each migration group:

- replace TypeScript-only syntax with equivalent JavaScript plus JSDoc types;
- preserve public assignability semantics, not only runtime behavior;
- preserve type visibility intent: public typedefs retain public names and
  implementation-only typedefs use the `_` prefix;
- if a TypeScript-only construct has no established semantics-preserving JSDoc
  translation, record it as a focused hard case and postpone that group rather
  than inventing a redesign inside the mechanical migration;
- update runtime imports and JSDoc type imports to the new source paths;
- update proofs, tests, scripts, generated CI configuration, documentation, and
  other path-sensitive tooling;
- preserve type checking, declaration generation, runtime behavior, proofs,
  coverage, and package behavior.

#### End of stage 1

Keep `**/*.js` ignored while TypeScript can still generate `.js`. After the last
authored `.ts` / `.f.ts` source file is removed:

1. simplify `prepack` from
   `tsc --noEmit false --emitDeclarationOnly && tsc --noEmit false --declaration false`
   to declaration-only `tsc --noEmit false --emitDeclarationOnly`;
2. remove the TypeScript-to-JavaScript emission path;
3. remove obsolete generated `.js` output from the working tree when performing
   that transition;
4. remove the blanket `**/*.js` rule from `.gitignore` so authored `.js` can be
   tracked again.

Generated declaration ignores are independent and may remain.

Only after this boundary may stage 2 use:

```text
module.f.mjs -> module.f.js
```

Stage 2 additionally requires
[`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
so authored `.f.js` is directly type-checked, receives `.d.ts` declarations, is
packed, and works for a clean package consumer before the first
compiler-compatibility rename.

### Tasks

- [ ] Complete
      [`f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md),
      including `allowJs` / `checkJs`.
- [ ] Then complete
      [`f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
      before the first real repository `.f.ts` -> `.f.mjs` conversion.
- [ ] Update contributor, compiler, language, package, test, and roadmap
      documentation to the stage-1 extension meanings.
- [ ] Identify dependency-leaf `.ts` / `.f.ts` files and migrate those first.
- [ ] Identify TypeScript-only type constructs that do not yet have a proven
      semantics-preserving JSDoc translation; record them as focused hard cases
      and postpone only the affected migration groups.
- [ ] Resolve the known `Phantom` / `unique symbol` hard case before migrating
      `fjs/types/phantom/module.f.ts` or dependent groups that require it.
- [ ] Migrate `proof.f.ts` to `proof.f.mjs` when the proof is JavaScript/JSDoc
      ready and its authored dependencies are migrated; do not gate this on
      compiler support.
- [ ] Translate TypeScript generic constraints and `in` / `out` variance to
      JSDoc `@template` syntax without changing assignability.
- [ ] Decide each typedef's visibility at the migration boundary: prefix
      implementation-only typedefs with `_` and leave publicly useful ones
      unprefixed, judged by what the module should offer its consumers rather
      than by what the `.f.ts` happened to export or by what a pending refactor
      plans to delete.
- [ ] Keep a blank line between a module's `@module` header and its first
      `import` statement so the header survives declaration emit; fix the
      modules that already lost theirs (`fjs/types/list`, `fjs/types/nullable`,
      `fjs/common/monoid`).
- [ ] File an upstream issue for typedef documentation being dropped from
      declaration emit, and keep writing type documentation in the source
      meanwhile — the loss is a published-package regression only, and blocks no
      migration group.
- [ ] Treat `_`-prefixed typedef names as private even when declarations emit
      them as exports, but still require `**BREAKING CHANGES:**` whenever a
      change to one alters the assignability of a public declaration.
- [ ] Once a module is `.mjs`, treat any later move of a public typedef to a `_`
      name as an ordinary breaking API change with its own changelog entry and
      importer updates, not as a visibility cleanup.
- [ ] Continue upward through the dependency graph in reviewable groups until no
      authored TypeScript remains.
- [ ] Translate `.ts` to `.mjs` and `.f.ts` to `.f.mjs`, moving static type
      information to JSDoc without weakening public type semantics.
- [ ] Keep migrated JavaScript free of runtime and declaration-retained
      dependencies on remaining authored TypeScript.
- [ ] Update imports, proofs, tests, coverage globs, scripts, generated CI, and
      documentation for every migrated group.
- [ ] Sweep prose references to already-migrated modules: `AGENTS.md`, README
      files, and `todo/*.md` still name `.f.ts` paths that no longer exist, so
      snippets copied from them produce broken imports and links. The sweep
      covers typedefs a migration renamed as well — `balanced-fold.md` still
      calls `bit_vec`'s accumulator state `ListToVecState`, now
      `_ListToVecState`. Per-group updates miss both kinds because prose files
      are not importers; run a repository-wide `.f.ts`-reference and
      renamed-typedef check at least at the end of stage 1.
- [ ] Preserve Node, Deno, Bun, proof, coverage, type-checking, declaration, and
      CI package behavior throughout the migration.
- [ ] Add required `**BREAKING CHANGES:**` changelog entries for every public
      runtime or type-contract change; direct changes to an emitted `_` alias
      are exempt only when the expanded public contract is unchanged.
- [ ] After the last authored TypeScript file is gone, simplify `prepack` to its
      declaration-only command and remove the TS-to-JS emit path and obsolete
      generated `.js` outputs.
- [ ] Then remove `**/*.js` from `.gitignore` so authored `.js` is trackable.
- [ ] Keep the compiler-compatibility migration explicitly **blocked by** this
      task.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first authored TypeScript source
  is converted to JavaScript.
- The `.f.mjs` runtime test/coverage fixture is complete before the first real
  repository `.f.ts` -> `.f.mjs` conversion.
- No authored `.ts` or `.f.ts` source files remain in the repository, including
  proof files.
- Migration can proceed incrementally from dependency leaves toward callers.
- Authored JavaScript uses `.mjs` / `.f.mjs` with JSDoc where static type
  information is needed.
- Known TypeScript-to-JSDoc hard cases are explicitly identified; each affected
  group remains in TypeScript until its focused design preserves the required
  public/runtime semantics, without blocking unrelated migration groups.
- `proof.f.mjs` migration is gated by JavaScript/JSDoc and dependency readiness,
  never by current FunctionalScript compiler support.
- TypeScript generic constraints and variance annotations are preserved with
  their JSDoc `@template` equivalents; public assignability is not weakened.
- Implementation-only JSDoc typedefs use `_`-prefixed names and are treated as
  private API even when TypeScript emits them as exported declaration aliases.
- Documentation lost from emitted declarations because it was attached to a
  JSDoc `@typedef` is recorded as a known upstream gap, not treated as a reason
  to keep a module in TypeScript or to stop documenting its types.
- Every migrated module's `@module` header survives into its emitted
  declaration, which requires a blank line between that header and the first
  `import` statement.
- Renaming or removing an emitted `_`-prefixed alias is not breaking solely due
  to that alias being emitted; any resulting change to a public declaration's
  assignability is still a breaking change.
- Each migrated module's typedef visibility is justified by the public
  vocabulary that module should offer; pre-migration export status is evidence
  for that decision, not the decision itself.
- Reclassifying a public typedef as `_` after its module has migrated is treated
  as a breaking API change, so the free correction is available only at the
  `.f.ts` -> `.f.mjs` boundary.
- `.f.mjs` means FunctionalScript-intent JavaScript, not current-compiler
  compatibility.
- Migrated JavaScript never depends on remaining authored TypeScript during the
  transition.
- Package-owned `.mjs` and generated declarations work from a clean CI package
  build and clean NPM consumer.
- Tests, proofs, coverage, supported runtimes, and type checking continue to
  pass.
- After the last authored TypeScript source is removed, `prepack` performs only
  declaration emission and no TypeScript-to-JavaScript emission remains.
- `.gitignore` no longer blanket-ignores `.js` at the end of this task.
- The compiler-compatibility migration starts only after this task and the
  authored-`.f.js` package/tooling prerequisite are complete.

### Related

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  — stage-1 authored `.mjs` validation, declarations, and package support.
- [`../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md`](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  — stage-1 end-to-end `.f.mjs` proof and coverage prerequisite.
- [`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
  — stage-2 authored `.f.js` package/tooling prerequisite.
- [`../fjs/ci/todo/publishing-packages.md`](../fjs/ci/todo/publishing-packages.md)
  — broader package-publishing plan.
- [`../fjs/fsc/README.md`](../fjs/fsc/README.md) — authoritative FunctionalScript
  extension and migration contract.
- [`blocked/jsdoc-typedef-strip-internal.md`](./blocked/jsdoc-typedef-strip-internal.md)
  — replace the temporary `_` convention with `@internal` when upstream
  declaration emit supports it.
- [microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407)
  — upstream request for `stripInternal` support on JSDoc typedefs.
- [`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md) — existing compiler
  integration and compiler-compatibility migration.
- [`plan/roadmap.md`](./plan/roadmap.md) — project roadmap.
