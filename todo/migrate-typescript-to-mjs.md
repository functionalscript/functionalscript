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

#### Enable JavaScript checking first

Before the first `.ts` / `.f.ts` source file moves to `.mjs` / `.f.mjs`, enable
`allowJs` and `checkJs` in the root `tsconfig.json`. TypeScript remains the
repository type checker during this migration; JSDoc replaces TypeScript syntax
without creating an unchecked intermediate source set.

The focused package prerequisite is
[`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md).
It must make authored `.mjs` a checked, declaration-emitting, packable source
extension before the first package-owned source migration.

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
should move to `.f.mjs` once its TypeScript dependencies can move, even if the
current FunctionalScript compiler does not yet support all syntax in that file.

For each migration group:

- replace TypeScript-only syntax with equivalent JavaScript plus JSDoc types;
- update runtime imports and JSDoc type imports to the new source paths;
- update proofs, tests, scripts, generated CI configuration, documentation, and
  other path-sensitive tooling;
- preserve type checking, declaration generation, runtime behavior, proofs,
  coverage, and package behavior.

#### End of stage 1

Keep `**/*.js` ignored while TypeScript can still generate `.js`. After the last
authored `.ts` / `.f.ts` source file is removed:

1. remove the TypeScript-to-JavaScript emission path;
2. remove obsolete generated `.js` output from the working tree when performing
   that transition;
3. remove the blanket `**/*.js` rule from `.gitignore` so authored `.js` can be
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
      including `allowJs` / `checkJs`, before the first source migration.
- [ ] Update contributor, compiler, language, package, test, and roadmap
      documentation to the stage-1 extension meanings.
- [ ] Identify dependency-leaf `.ts` / `.f.ts` files and migrate those first.
- [ ] Continue upward through the dependency graph in reviewable groups until no
      authored TypeScript remains.
- [ ] Translate `.ts` to `.mjs` and `.f.ts` to `.f.mjs`, moving static type
      information to JSDoc.
- [ ] Keep migrated JavaScript free of runtime and declaration-retained
      dependencies on remaining authored TypeScript.
- [ ] Update imports, proofs, tests, coverage globs, scripts, generated CI, and
      documentation for every migrated group.
- [ ] Preserve Node, Deno, Bun, proof, coverage, type-checking, declaration, and
      CI package behavior throughout the migration.
- [ ] Add required `**BREAKING CHANGES:**` changelog entries for public runtime
      import paths that change.
- [ ] After the last authored TypeScript file is gone, remove the TS-to-JS emit
      path and obsolete generated `.js` outputs.
- [ ] Then remove `**/*.js` from `.gitignore` so authored `.js` is trackable.
- [ ] Keep the compiler-compatibility migration explicitly **blocked by** this
      task.

### Acceptance criteria

- `allowJs` and `checkJs` are enabled before the first authored TypeScript source
  is converted to JavaScript.
- No authored `.ts` or `.f.ts` source files remain in the repository.
- Migration can proceed incrementally from dependency leaves toward callers.
- Authored JavaScript uses `.mjs` / `.f.mjs` with JSDoc where static type
  information is needed.
- `.f.mjs` means FunctionalScript-intent JavaScript, not current-compiler
  compatibility.
- Migrated JavaScript never depends on remaining authored TypeScript during the
  transition.
- Package-owned `.mjs` and generated declarations work from a clean CI package
  build and clean NPM consumer.
- Tests, proofs, coverage, supported runtimes, and type checking continue to
  pass.
- TypeScript-to-JavaScript emission is removed after the last authored
  TypeScript source is removed.
- `.gitignore` no longer blanket-ignores `.js` at the end of this task.
- The compiler-compatibility migration starts only after this task and the
  authored-`.f.js` package/tooling prerequisite are complete.

### Related

- [`../fjs/ci/todo/f-mjs-package-support.md`](../fjs/ci/todo/f-mjs-package-support.md)
  — stage-1 authored `.mjs` validation, declarations, and package support.
- [`../fjs/ci/todo/f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md)
  — stage-2 authored `.f.js` package/tooling prerequisite.
- [`../fjs/ci/todo/publishing-packages.md`](../fjs/ci/todo/publishing-packages.md)
  — broader package-publishing plan.
- [`../fjs/fsc/README.md`](../fjs/fsc/README.md) — authoritative FunctionalScript
  extension and migration contract.
- [`fjs-nanvm-integration.md`](./fjs-nanvm-integration.md) — existing compiler
  integration and compiler-compatibility migration.
- [`plan/roadmap.md`](./plan/roadmap.md) — project roadmap.
