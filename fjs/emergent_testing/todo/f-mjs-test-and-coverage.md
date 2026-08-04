## Add the `.f.mjs` runtime fixtures for test and coverage

**Priority:** P1
**Status:** blocked
**Blocked by:** [authored `.f.mjs` package support](../../ci/todo/f-mjs-package-support.md)

### Problem

Tooling recognition of `.f.mjs` has landed: `shouldLoad` in
`fjs/dev/module.f.ts` matches `.f.mjs`, `npm run cov` and `deno task cov`
include `module.f.mjs`, the canonical Deno CI generator
(`fjs/ci/deno/module.f.ts`) exports `coverageInclude` with a regression proof,
the checked-in workflow is regenerated from it, and `AGENTS.md` §3.2 plus the
`CONTRIBUTING.md` summary state the proof policy for both authored extensions
including the mixed `module.f.mjs` / `proof.f.ts` layout.

What is still missing is the end-to-end evidence: no `.f.mjs` file exists in the
repository, so nothing yet proves at runtime that a migrated module keeps its
proofs and its coverage rows. The current proofs cover discovery and the
generated command; they do not cover an actual loaded `.f.mjs` module.

Adding those fixtures is not just a matter of writing two files. Two concrete
obstacles were found while implementing the tooling half:

1. **A `proof.f.ts` cannot import a `module.f.mjs` today.** With `allowJs`
   off, `npx tsc` reports `TS7016: Could not find a declaration file for module
   './module.f.mjs'`. Turning `allowJs`/`checkJs` on makes `npx tsc` pass, but
   then `npm run prepack` (`tsc --NoEmit false`) fails with
   `TS5055: Cannot write file '…/benchmark.mjs' because it would overwrite input
   file` — authored `.mjs` becomes both an input and a JavaScript emit target.
   Making that work is exactly the repeatable-emission and package-content work
   owned by
   [`f-mjs-package-support.md`](../../ci/todo/f-mjs-package-support.md); it must
   not be duplicated here.
2. **An internal `proof` export inside a `.f.mjs` module has no assert helper
   it is allowed to import.** `AGENTS.md` §3.3 requires `assert`/`assertEq`
   from `fjs/asserts/module.f.ts` rather than a hand-written `if`/`throw`, but
   the dependency-closure rule forbids authored `.f.mjs` from importing a
   relative `.f.ts` module. A fixture written with `if`/`throw` would also leave
   a permanently-uncovered branch in a `module.f.mjs` that the new coverage
   filter now includes.

### Proposal

Land the fixtures once package support makes authored `.f.mjs` a first-class,
type-checked, packable source extension.

Decide obstacle 2 explicitly before writing the fixture, and record the decision
in `AGENTS.md` §3.3. The options are:

- migrate `fjs/asserts/module.f.ts` to `fjs/asserts/module.f.mjs` as the first
  real conversion, so every `.f.mjs` proof — fixture or not — has a compliant
  assert helper (`.f.ts` callers may keep importing it under the asymmetric
  import policy); or
- state that a `.f.mjs` module keeps its proofs in a co-located `proof.f.ts`
  until `fjs/asserts` migrates, and drop the internal-`proof`-in-`.f.mjs`
  fixture in favour of the mixed-layout one.

The first option is preferable: it is a real migration step the plan needs
anyway, and it removes the fixture's special case instead of documenting one.

### Tasks

- [ ] Decide and document how an internal `proof` inside a `.f.mjs` module
      asserts (see the two options above), updating `AGENTS.md` §3.3.
- [ ] Add a fixture proving that an internal `proof` export from a `.f.mjs`
      module is executed by the normal test command.
- [ ] Add a fixture proving that a co-located `proof.f.ts` can import and test
      `module.f.mjs`.
- [ ] Verify that `.f.mjs` implementations appear in both Node and Deno coverage
      output for the supported proof layouts.

### Acceptance criteria

- An internal exported `proof` from a `.f.mjs` module is executed by the normal
  test command.
- A `proof.f.ts` importing `module.f.mjs` is executed by the normal test command
  and type-checks under `npx tsc`.
- The `.f.mjs` fixture appears as a covered file in `npm run cov` and in
  `deno task cov`.
- Existing `.f.ts`, generated `.f.js`, `proof.f.ts`, and standalone `proof.mjs`
  behavior is unchanged.

### Ordering

Complete this task before converting the first repository module from `.f.ts` to
`.f.mjs`, and after
[`f-mjs-package-support.md`](../../ci/todo/f-mjs-package-support.md). The
tooling half already shipped, so a synthetic compiler fixture that does not
enter the published runtime graph is not blocked by this issue.

### Related

- [`fjs/fsc/README.md`](../../fsc/README.md) — source-extension convention and
  incremental repository migration.
- [`664-emergent-testing-module-files.md`](./664-emergent-testing-module-files.md)
  — separate proposal to bulk-load ordinary `module.*` files for white-box
  testing. Ordinary `.mjs` files stay opt-in through the `proof.mjs` convention
  until then; this issue does not expand that rule.
