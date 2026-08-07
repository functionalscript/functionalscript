## Migrate authored TypeScript to `.mjs`

**Priority:** P1
**Status:** open

### Goal

Remove authored TypeScript from the FunctionalScript repository before using a
file extension as a marker for source accepted by the current FunctionalScript
compiler.

The migration has two separate concerns that should not be coupled:

1. **Source-language migration:** translate authored TypeScript to native ESM
   JavaScript with JSDoc types.
2. **Compiler-coverage migration:** mark the subset of FunctionalScript source
   accepted by the compiler available in the same repository revision.

This task is stage 1 only. The existing compiler migration becomes stage 2 and
is **blocked by** completion of this task.

### Extension plan

During stage 1, replace authored TypeScript extensions without making any claim
about compiler support:

```text
module.ts   -> module.mjs
module.f.ts -> module.f.mjs
```

Types that are needed by TypeScript checking or declaration generation move to
JSDoc. The runtime source remains ordinary ESM JavaScript.

The `.f.mjs` extension means authored FunctionalScript-intent JavaScript, but it
does **not** mean that the current FunctionalScript parser/compiler already
accepts the complete module.

Do not author `.f.js` during stage 1. While authored `.f.ts` files still exist,
TypeScript compilation can generate `.f.js` files from them, so the extension is
not yet available as an unambiguous source marker.

After all authored `.ts` and `.f.ts` files are gone, the compiler migration can
use:

```text
module.f.mjs -> module.f.js
```

as the capability transition. At that point `.f.js` means authored
FunctionalScript source that the current FunctionalScript compiler must parse
and compile. The package is ESM (`"type": "module"`), so `.f.js` remains an ESM
module.

The existing incremental compiler migration should therefore change from
`.f.ts` -> `.f.mjs` to `.f.mjs` -> `.f.js` after this task is complete.

### Migration strategy

The TypeScript-to-JavaScript migration is independent of FunctionalScript parser
coverage. A file must not stay `.ts` merely because the new compiler does not
support some syntax that the file uses yet.

The work may be split into reviewable dependency-safe groups. For each group:

- rename `.ts` to `.mjs` and `.f.ts` to `.f.mjs`;
- replace TypeScript-only syntax with equivalent JavaScript plus JSDoc types;
- update relative runtime imports, JSDoc type imports, tests, proofs, scripts,
  configuration, and documentation that reference the renamed paths;
- preserve TypeScript checking and declaration generation for authored `.mjs`;
- preserve runtime behavior, proofs, coverage, and package behavior;
- ensure authored `.mjs` runtime/declaration references do not point to source
  files omitted from the packed package.

Dependency ordering may still be needed for package/runtime correctness, but it
must not be tied to FunctionalScript parser feature support.

### Package/tooling prerequisite

Before the first package-owned source file is migrated, authored `.mjs` must be
a first-class checked and published source extension. Reuse and generalize the
work in [`f-mjs-package-support.md`](./f-mjs-package-support.md):

- TypeScript validates `.mjs` with `allowJs` / `checkJs`;
- declaration emission produces `.d.mts` for authored `.mjs`;
- NPM includes package-owned `.mjs` and `.d.mts`;
- repeated packing is safe;
- runtime and declaration references resolve from a clean packed consumer.

That task currently describes `.f.mjs` as compiler-ready source. Update that
wording to the new extension meaning before implementation: `.f.mjs` is authored
FunctionalScript-intent JavaScript; compiler readiness is represented later by
`.f.js`.

### Tasks

- [ ] Generalize authored-`.mjs` validation, declaration emission, packaging,
      and clean-consumer tests from
      [`f-mjs-package-support.md`](./f-mjs-package-support.md).
- [ ] Document the stage-1 extension invariant in `AGENTS.md`,
      `CONTRIBUTING.md`, and the relevant compiler/package documentation.
- [ ] Translate repository `.ts` source to `.mjs`, preserving runtime behavior
      and moving TypeScript type syntax to JSDoc.
- [ ] Translate repository `.f.ts` source to `.f.mjs` without requiring support
      from the current FunctionalScript compiler.
- [ ] Update runtime imports and JSDoc type imports to the renamed source paths.
- [ ] Update tests, proofs, coverage globs, scripts, generated CI configuration,
      documentation, and other path-sensitive tooling.
- [ ] Keep TypeScript checking enabled for the authored `.mjs` source until a
      replacement type checker is intentionally chosen.
- [ ] Keep generated declarations out of the authored-source set.
- [ ] Verify tests, proofs, coverage, Node/Deno/Bun execution, and NPM packing
      continue to work during and after the migration.
- [ ] Add the required changelog entry for public runtime import paths that move
      from generated `.js` to authored `.mjs`, using the repository's
      `**BREAKING CHANGES:**` convention where applicable.
- [ ] Remove the TypeScript-to-JavaScript emission path after the last authored
      `.ts` / `.f.ts` source file is migrated.
- [ ] Update the compiler migration plan in `fjs/fsc/README.md`,
      `todo/plan/roadmap.md`, and `todo/fjs-nanvm-integration.md` so compiler
      coverage is represented by `.f.mjs` -> `.f.js`.
- [ ] Update `.f.mjs` compiler fixtures/tests to `.f.js` when stage 2 starts.

### Acceptance criteria

- No authored `.ts` or `.f.ts` source files remain in the repository.
- Authored JavaScript uses `.mjs` / `.f.mjs` and JSDoc where static type
  information is needed.
- Generated declaration files are not treated as authored source.
- Package-owned `.mjs` source and generated declarations work from a clean NPM
  consumer.
- Tests, proofs, coverage, and supported runtimes continue to pass.
- The migration does not depend on the current FunctionalScript parser feature
  set.
- `.f.mjs` no longer promises current-compiler compatibility.
- `.f.js` is not authored until TypeScript source emission can no longer produce
  that extension.
- The follow-up compiler migration is explicitly documented as
  `.f.mjs` -> `.f.js` and **blocked by** this task.

### Follow-up: compiler coverage

After this task is complete, migrate compiler-supported FunctionalScript modules
incrementally from `.f.mjs` to `.f.js`. A file may move only when its complete
syntax and required dependency graph are accepted by the current compiler.
Unsupported FunctionalScript modules remain `.f.mjs` until the corresponding
compiler features land.

This keeps source-language migration independent from compiler implementation
progress while preserving a simple, visible compatibility marker once the
`.f.js` namespace is no longer occupied by generated TypeScript output.

### Related

- [`f-mjs-package-support.md`](./f-mjs-package-support.md) — authored `.mjs`
  validation and package support that must be generalized to the new meaning.
- [`publishing-packages.md`](./publishing-packages.md) — current authored vs.
  generated JavaScript packaging convention.
- [`fjs/fsc/README.md`](../../fsc/README.md) — current compiler extension and
  incremental migration plan to revise for stage 2.
- [`todo/plan/roadmap.md`](../../../todo/plan/roadmap.md) — compiler roadmap.
- [`todo/fjs-nanvm-integration.md`](../../../todo/fjs-nanvm-integration.md) —
  current repository compiler-coverage integration plan.
