## Migrate authored TypeScript to `.mjs`

**Priority:** P1
**Status:** open

### Goal

Remove authored TypeScript from the FunctionalScript repository before using a
file extension as a marker for source accepted by the current FunctionalScript
compiler.

The migration has two separate concerns:

1. **Source-language migration:** translate authored TypeScript to native ESM
   JavaScript with JSDoc types.
2. **Compiler-compatibility migration:** after stage 1 is complete, mark the
   subset of FunctionalScript source accepted by the compiler available in the
   same repository revision.

This task is stage 1 only. The existing compiler-compatibility migration is
**blocked by** completion of this task.

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

After all authored `.ts` and `.f.ts` files are gone, the compiler-compatibility
migration can use:

```text
module.f.mjs -> module.f.js
```

At that point `.f.js` means authored FunctionalScript source that the current
FunctionalScript compiler must parse and compile. The package is ESM
(`"type": "module"`), so `.f.js` remains an ESM module.

### Gradual migration strategy

Stage 1 is intentionally gradual. It does not require converting the whole
repository in one PR.

Migrate dependency leaves first: start with authored `.ts` / `.f.ts` files that
do not depend on other authored TypeScript files. After those dependencies are
`.mjs` / `.f.mjs`, migrate their callers, and continue upward through the
repository dependency graph.

A file or coherent group is eligible when every relative authored source
runtime dependency and every declaration-retained type dependency outside that
group is already JavaScript (`.mjs` / `.f.mjs`). Cyclic files may be migrated as
one coherent group.

This direction is intentionally asymmetric during the transition:

- remaining `.ts` / `.f.ts` source may depend on already migrated `.mjs` /
  `.f.mjs` source;
- migrated `.mjs` / `.f.mjs` source must not depend on remaining authored
  `.ts` / `.f.ts` source.

This allows the migration to proceed incrementally without import rewriting or a
staging tree. FunctionalScript parser support is irrelevant to stage-1
eligibility: a `.f.ts` file should move to `.f.mjs` as soon as its TypeScript
source dependencies are migrated, even when the FunctionalScript compiler does
not yet support all of its syntax.

For each migration group:

- rename `.ts` to `.mjs` and `.f.ts` to `.f.mjs`;
- replace TypeScript-only syntax with equivalent JavaScript plus JSDoc types;
- update relative runtime imports, JSDoc type imports, tests, proofs, scripts,
  configuration, and documentation that reference the renamed paths;
- preserve TypeScript checking and declaration generation for authored `.mjs`;
- preserve runtime behavior, proofs, coverage, and package behavior.

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
- [ ] Identify dependency-leaf `.ts` / `.f.ts` files whose authored runtime and
      type dependencies are already JavaScript, and migrate those first.
- [ ] Continue the migration upward through the dependency graph in reviewable
      groups until no authored TypeScript remains.
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
- [ ] Update the compiler-compatibility migration documentation so it is
      `.f.mjs` -> `.f.js` and explicitly **blocked by** this task.

### Acceptance criteria

- No authored `.ts` or `.f.ts` source files remain in the repository.
- The migration was able to proceed incrementally from dependency leaves toward
  callers; it did not require a repository-wide atomic rename.
- Authored JavaScript uses `.mjs` / `.f.mjs` and JSDoc where static type
  information is needed.
- Migrated `.mjs` / `.f.mjs` source does not depend on remaining authored
  `.ts` / `.f.ts` source during the transition.
- Generated declaration files are not treated as authored source.
- Package-owned `.mjs` source and generated declarations work from a clean NPM
  consumer.
- Tests, proofs, coverage, and supported runtimes continue to pass.
- The migration does not depend on the current FunctionalScript parser feature
  set.
- `.f.mjs` no longer promises current-compiler compatibility.
- `.f.js` is not authored until TypeScript source emission can no longer produce
  that extension.
- The existing compiler-compatibility migration is explicitly **blocked by**
  this task and starts only after all authored TypeScript is gone.

### Follow-up: compiler compatibility

After this task is complete, migrate compiler-supported FunctionalScript modules
incrementally from `.f.mjs` to `.f.js`. A file may move only when its complete
syntax and required dependency graph are accepted by the current compiler.
Unsupported FunctionalScript modules remain `.f.mjs` until the corresponding
compiler features land.

### Related

- [`f-mjs-package-support.md`](./f-mjs-package-support.md) — authored `.mjs`
  validation and package support that must be generalized to the new meaning.
- [`publishing-packages.md`](./publishing-packages.md) — current authored vs.
  generated JavaScript packaging convention.
- [`fjs/fsc/README.md`](../../fsc/README.md) — current compiler extension and
  incremental migration plan to revise for stage 2.
- [`todo/plan/roadmap.md`](../../../todo/plan/roadmap.md) — compiler roadmap.
- [`todo/fjs-nanvm-integration.md`](../../../todo/fjs-nanvm-integration.md) —
  compiler integration and repository compatibility migration.
