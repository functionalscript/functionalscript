## Node version check. `register` should fall back to the inline test context below the minimum supported Node version

**Priority:** P3
**Status:** open

### Problem

`register` (`fjs/emergent_testing/module.f.ts:409`) is the entry point used by
external test frameworks (Node `--test`, Bun, Playwright). It currently has no
way to know which Node.js version it is running under — `NodeProgramOptions`
(`fjs/effects/node/module.f.ts:524`) carries `engine: Engine` (`'node' |
'bun' | 'playwright'`) but no version information.

`package.json`'s `engines.node` field says `">=22"`, but the codebase only
partly supports Node 22 in practice — CI/Codex containers are pinned to
Node 22 because they cannot be upgraded, while the fully-supported baseline
is Node 24. `@types/node` in `package.json` is currently `26.1.2`, which is
ahead of the real baseline and should be pinned down to an exact `24.X.Y`.
Node 22 does **not** get `@types/node` pinned to match it: Node 22's
`node:test` `TestContext` typings differ from Node 24's, and the
test-framework code this task touches is written against Node 24's shape.
The test framework is not being downgraded to satisfy an environment
(Codex's Docker containers) that simply cannot upgrade its Node binary.

**Minimum fully-supported version: Node `24.0.0`.** This is the floor stated
by the maintainer; Node 22 is kept *working* only because Codex's Docker
containers cannot be upgraded off it, not because it is a target.

Rather than throwing/failing the whole test register on an unsupported Node
version — which would make `register` unusable in the very environment (Codex
containers) it needs to keep working in — `register` should **fall back** to
the same inline, flattened test-registration strategy the runner already uses
for Bun and Playwright (`inlineTest`/`wrapInlineTest`,
`fjs/effects/node/module.ts:307-325`) whenever it detects a Node version below
the floor. That strategy does not rely on nested `TestContext.test()` calls or
Node-24-shaped `TestContext` typings the way the native `ctx.test(name, {
expectFailure }, ...)` path does (`fjs/effects/node/module.ts:297-298`), so it
sidesteps whatever gap exists in Node 22's `node:test` API/typings without
needing register itself to fail.

This issue spans `fjs/emergent_testing`, `fjs/effects/node`, and the root
`package.json`, so it is filed at the top level rather than under a single
module's `todo/`.

The guard must not misfire on Deno. `fjs/emergent_testing/README.md:64-84`
documents Deno as a supported external runner (`deno test`), but
`fjs/effects/node/module.ts:335` currently classifies every runtime that is
neither Bun nor Playwright as `engine: 'node'` — Deno included, since it also
shims `node:process`. Populating `nodeVersion` from that shim and gating on
`engine === 'node'` alone would apply the Node-only version fallback to Deno
as well, which is wrong.

### Proposal

1. Add explicit Deno detection to `Engine` (`fjs/effects/node/module.f.ts:509`,
   e.g. `'node' | 'bun' | 'playwright' | 'deno'`) and to the detection logic
   in `fjs/effects/node/module.ts:335`, which currently falls through to
   `'node'` for anything that isn't Bun or Playwright. Deno exposes its own
   global (`'Deno' in globalThis`) that must be checked before the `node:process`
   shim is trusted.
2. Add an optional `nodeVersion` parameter to the Node effects layer so the
   runner can report the detected Node version alongside `engine`. Likely
   `NodeProgramOptions.nodeVersion?: string` (or a parsed `{ major: number,
   minor: number, patch: number }`) in `fjs/effects/node/module.f.ts:524`,
   populated from `process.version` only when `engine === 'node'`, and left
   `undefined` on Bun/Deno/Playwright/virtual runners.
3. In `fjs/effects/node/module.ts:327-336`, where `NodeProgramOptions` is
   constructed, compare `nodeVersion` against the fixed floor `24.0.0` using a
   proper semver-order comparison (major, then minor, then patch) — not a
   hardcoded major-`22` (or major-`23`) special case. When `engine === 'node'`
   and `nodeVersion < 24.0.0`, build `testContext` from the same
   `wrapInlineTest(testContext.test)` helper already used for
   `bunTestContext` (`fjs/effects/node/module.ts:324`) instead of the raw
   `node:test` module export, so `register` (`fjs/emergent_testing/module.f.ts:409`)
   picks the inline/flattened strategy for old Node the same way it already
   does for Bun/Playwright.
4. `register` itself needs no new branching: it already selects `testContext`
   for `engine === 'node'` (`fjs/emergent_testing/module.f.ts:411-413`); step 3
   makes that selected context be the compatible one under the hood. No
   version check or failure path is needed inside `register` — the fallback
   happens once, at context-construction time.
5. Pin `@types/node` in `package.json` (`package.json:47`) to an exact
   `24.X.Y` (not a `22.x` floor, and not left at `26.1.2`). Node 22's
   `node:test` `TestContext`/`TestFn` typings differ from Node 24's — the
   `register` test-framework plumbing (`fjs/effects/node/module.ts:297-314`,
   `fjs/effects/node/module.f.ts:448-468`) is written and typechecked against
   the Node 24 shape, so compiling against `@types/node@22` would fight the
   very code this task adds. We are **not** downgrading the test framework to
   accommodate Node 22 — Node 22 stays only as a partially-supported floor for
   environments (Codex's Docker containers) that cannot upgrade their Node
   binary; it does not get to hold back `@types/node` or the test-framework
   typings package-wide. `package-lock.json`, `deno.lock`, and `bun.lock` all
   currently also pin `@types/node` `26.1.2` and must be regenerated together
   with `package.json`, not edited by hand — run `npm run update`
   (`package.json:16`, which chains `ci-update`, `npm install`, `deno
   install`, and `bun install`) and commit the resulting lockfile diffs.
6. Cover every new branch with co-located proofs, per the repository's
   mandatory 100% line/branch coverage: `nodeVersion` at/above `24.0.0` keeps
   the native `testContext`, `nodeVersion` below `24.0.0` swaps in the inline
   context, and Bun/Deno/Playwright are unaffected by the comparison entirely.

### Tasks

- [ ] Add `'deno'` to `Engine` and detect it explicitly in
      `fjs/effects/node/module.ts:335` (before falling through to `'node'`).
- [ ] Add an optional Node-version field to `NodeProgramOptions` in
      `fjs/effects/node/module.f.ts`.
- [ ] Populate it from `process.version` in the Node runner, only when
      `engine === 'node'`.
- [ ] In `fjs/effects/node/module.ts`, when `engine === 'node'` and
      `nodeVersion < 24.0.0` (semver order), construct `testContext` via
      `wrapInlineTest(testContext.test)` instead of the raw `node:test`
      export, reusing the existing Bun/Playwright fallback path rather than
      adding a new failure path.
- [ ] Add proofs covering: Node `>= 24.0.0` uses the native context, Node
      `< 24.0.0` uses the inline context, and Bun/Deno/Playwright are
      unaffected — 100% line/branch coverage of the new code.
- [ ] Pin `@types/node` in `package.json:47` to an exact `24.X.Y` (down from
      `26.1.2`, not to `22.x` — Node 22's `node:test` `TestContext` typings
      differ and would break the register's test-framework plumbing).
- [ ] Run `npm run update` and commit the regenerated `package-lock.json`,
      `deno.lock`, and `bun.lock`.
- [ ] Document the supported-Node-version policy and the inline-context
      fallback (README or JSDoc near `register`/`NodeProgramOptions`),
      including that Deno is exempt from the Node-version comparison.

### Related

- `fjs/effects/node/module.f.ts:524` — `NodeProgramOptions`.
- `fjs/effects/node/module.ts:307-325` — `inlineTest` / `wrapInlineTest` /
  `bunTestContext`.
- `fjs/emergent_testing/module.f.ts:409` — `register`.
- `package.json:20` — `engines.node: ">=22"`.
- `package.json:47` — `@types/node` version.
