## Recognize `.f.mjs` in test and coverage tooling

**Priority:** P1
**Status:** open

### Problem

The repository migration strategy uses `.f.mjs` for authored FunctionalScript
modules whose complete syntax is accepted by the current parser and compiler.
Before the first `.f.ts` module is renamed, the existing test and coverage
tooling must recognize the new extension.

Current behavior is incomplete:

- `fjs/dev/module.f.ts::shouldLoad` bulk-loads `.f.ts` and `.f.js`, but not
  `.f.mjs`;
- standalone `proof.mjs` files are already recognized, but an internal `proof`
  export in `module.f.mjs` would be skipped because the module itself is not
  loaded;
- `npm run cov` includes only `**/module.f.ts`, so a migrated implementation
  would disappear from Node coverage reporting;
- `deno task cov` in `deno.json` filters coverage with
  `.*module\.f\.ts`, so the same implementation would disappear from local
  Deno coverage reporting;
- the generated Deno CI step in `fjs/ci/deno/module.f.ts` uses the same
  `.f.ts`-only filter, so CI could pass while omitting every migrated
  implementation from Deno coverage;
- `AGENTS.md` defines mandatory proof coverage only for `.f.ts`, so the
  repository's authoritative development rules do not yet govern `.f.mjs`
  modules or describe mixed `module.f.mjs` / `proof.f.ts` pairs.

Without this task, renaming a covered module from `.f.ts` to `.f.mjs` could
silently reduce proof execution and coverage even though the implementation is
otherwise unchanged, and later contributors would not have an explicit
`.f.mjs` proof policy to follow.

### Proposal

Treat authored `.f.mjs` FunctionalScript modules consistently with `.f.ts`
modules in proof discovery, coverage, and repository policy.

Keep the Node and Deno inclusion rules semantically identical: both must select
FunctionalScript implementation modules ending in `module.f.ts` or
`module.f.mjs`. The CI generator is the source of truth for the generated
workflow, while `deno.json` defines the equivalent local command. Cover both
with proofs or validation so a later edit cannot restore extension drift.

The implementation and proof extensions are independent during incremental
migration. Renaming `module.f.ts` to `module.f.mjs` does not require renaming its
co-located `proof.f.ts`. The TypeScript proof may continue importing existing
`.f.ts` test helpers, including `fjs/asserts/module.f.ts`, while importing the
migrated implementation through its new `.f.mjs` path. Rename a proof to
`proof.f.mjs` only when that proof's own syntax and relative FunctionalScript
dependency closure are compiler-ready.

The dependency-closed `.f.mjs` migration rule applies to files that are actually
authored as `.f.mjs`; it does not prohibit a `.f.ts` proof from importing a
`.f.mjs` implementation. This lets implementation coverage grow without forcing
test infrastructure and its dependency graph to migrate first.

Keep the extension rules explicit: ordinary `.mjs` files remain opt-in through
the existing `proof.mjs` convention unless
[`664-emergent-testing-module-files.md`](./664-emergent-testing-module-files.md)
is implemented. This task adds the FunctionalScript-specific `.f.mjs` rule; it
does not replace or expand the ordinary `module.mjs` proposal.

### Tasks

- [ ] Extend `shouldLoad` to recognize `.f.mjs` as a FunctionalScript module.
- [ ] Update the `shouldLoad` documentation and proofs to cover `.f.mjs`.
- [ ] Extend `npm run cov` so both `module.f.ts` and `module.f.mjs`
      implementations are included.
- [ ] Extend the Deno coverage filter in `deno.json` so `deno task cov`
      includes both implementation extensions.
- [ ] Update the canonical Deno CI generator in `fjs/ci/deno/module.f.ts` with
      the same coverage rule and add a regression proof for the generated
      command.
- [ ] Regenerate the checked-in CI workflow from the updated generator.
- [ ] Add a fixture proving that an internal `proof` export from a `.f.mjs`
      module is executed.
- [ ] Add a fixture proving that a co-located `proof.f.ts` can import and test
      `module.f.mjs`.
- [ ] Verify that `.f.mjs` implementations remain represented in both Node and
      Deno coverage for the supported proof layouts.
- [ ] Update `AGENTS.md` so `.f.mjs` modules and functions have the same
      mandatory 100% proof-coverage policy and proof-writing rules as `.f.ts`,
      including the mixed `module.f.mjs` / `proof.f.ts` convention.

### Acceptance criteria

- `shouldLoad('module.f.mjs')` returns `true`.
- An internal exported `proof` from a `.f.mjs` module is executed by the normal
  test command.
- A `proof.f.ts` importing `module.f.mjs` is executed by the normal test command.
- `npm run cov` includes both `.f.ts` and `.f.mjs` implementation modules.
- `deno task cov` includes both `.f.ts` and `.f.mjs` implementation modules.
- The Deno CI generator emits a coverage command with the same two-extension
  inclusion rule, and its proof fails if `.f.mjs` support is removed.
- The checked-in CI workflow is regenerated from the updated generator.
- Renaming an otherwise equivalent module from `.f.ts` to `.f.mjs` does not
  remove its proofs or its implementation from Node or Deno coverage, even when
  the proof remains `proof.f.ts`.
- `AGENTS.md` explicitly applies mandatory proof coverage to both `.f.ts` and
  `.f.mjs` FunctionalScript source and documents that a migrated
  `module.f.mjs` may keep a `proof.f.ts`.
- A `proof.f.mjs` is required to satisfy the same dependency-closed migration
  rule as any other authored `.f.mjs` file.
- Existing `.f.ts`, generated `.f.js`, `proof.f.ts`, and standalone `proof.mjs`
  behavior is unchanged.

### Ordering

Complete this task before converting the first repository module from `.f.ts`
to `.f.mjs`. The discovery, Node coverage, Deno coverage, generated CI, and
`AGENTS.md` policy changes land together so the first migrated module is covered
consistently across supported runners and governed by the same proof
requirements. The proof itself may remain `.f.ts` and migrate separately. This
is infrastructure for the migration strategy, not part of each individual
module conversion.

### Related

- [`fjs/fsc/README.md`](../../fsc/README.md) — source-extension convention and
  incremental repository migration.
- [`664-emergent-testing-module-files.md`](./664-emergent-testing-module-files.md)
  — separate proposal to bulk-load ordinary `module.*` files for white-box
  testing.
