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
  would disappear from coverage reporting;
- `AGENTS.md` defines mandatory proof coverage and the
  `module.f.ts`/`proof.f.ts` convention only for `.f.ts`, so the repository's
  authoritative development rules do not yet govern `.f.mjs` modules.

Without this task, renaming a covered module from `.f.ts` to `.f.mjs` could
silently reduce proof execution and coverage even though the implementation is
otherwise unchanged, and later contributors would not have an explicit
`.f.mjs` proof policy to follow.

### Proposal

Treat authored `.f.mjs` FunctionalScript modules consistently with `.f.ts`
modules in proof discovery, coverage, and repository policy:

1. Extend `shouldLoad` to recognize `.f.mjs` as a FunctionalScript module.
2. Update the `shouldLoad` documentation and proofs to cover `.f.mjs`.
3. Extend `npm run cov` so both `module.f.ts` and `module.f.mjs`
   implementations are included.
4. Add a regression fixture proving that an internal `proof` export from a
   `.f.mjs` module is executed.
5. Verify that the `.f.mjs` fixture remains represented in coverage output.
6. Update `AGENTS.md` so `.f.mjs` modules and functions have the same mandatory
   100% proof-coverage policy as `.f.ts`, including the
   `module.f.mjs`/`proof.f.mjs` convention and the existing proof-writing rules.

Keep the extension rules explicit: ordinary `.mjs` files remain opt-in through
the existing `proof.mjs` convention unless
[`664-emergent-testing-module-files.md`](./664-emergent-testing-module-files.md)
is implemented. This task adds the FunctionalScript-specific `.f.mjs` rule; it
does not replace or expand the ordinary `module.mjs` proposal.

### Acceptance criteria

- `shouldLoad('module.f.mjs')` returns `true`.
- An exported `proof` from a `.f.mjs` module is executed by the normal test
  command.
- `npm run cov` includes both `.f.ts` and `.f.mjs` implementation modules.
- Renaming an otherwise equivalent module from `.f.ts` to `.f.mjs` does not
  remove its proofs or its implementation from coverage.
- `AGENTS.md` explicitly applies mandatory proof coverage and proof-file naming
  rules to both `.f.ts` and `.f.mjs` FunctionalScript source.
- Existing `.f.ts`, generated `.f.js`, and standalone `proof.mjs` behavior is
  unchanged.

### Ordering

Complete this task before converting the first repository module from `.f.ts`
to `.f.mjs`. The tooling and `AGENTS.md` policy changes land together so the
first migrated module is both discovered correctly and governed by the same
proof requirements. This is infrastructure for the migration strategy, not part
of each individual module conversion.

### Related

- [`fjs/fsc/README.md`](../../fsc/README.md) — source-extension convention and
  incremental repository migration.
- [`664-emergent-testing-module-files.md`](./664-emergent-testing-module-files.md)
  — separate proposal to bulk-load ordinary `module.*` files for white-box
  testing.
