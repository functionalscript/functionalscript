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
Node 22 because they cannot be upgraded, while the fully-supported general
baseline is Node 24. That general baseline is distinct from the narrower
threshold below at which `register` uses `node:test`'s *native*
`expectFailure` path rather than the fallback — see "Fallback threshold"
below.

`@types/node` should stay at its current/latest version (`26.1.2` today), not
be pinned down to `24.x`. Confirmed empirically: pinning `@types/node` to
`24` still fails `tsc`, because `expectFailure` is not in `@types/node@24`'s
`TestOptions` type — even though `node --test` itself accepts and honors
`expectFailure` correctly at runtime on Node 24 (it's undocumented/untyped
there, not unsupported). `@types/node@26` does carry the up-to-date typing.
So the `@types/node` version is decoupled from the runtime Node-version
fallback below: keep `@types/node` on latest for correct typechecking, and
gate the `register` fallback purely on the detected runtime `nodeVersion`, not
on which `@types/node` is installed.

**The exact feature gap: Node's `expectFailure` test option.** `node:test`'s
`test()` gained a real `expectFailure` option — inverting pass/fail for a
flagged test/suite — added in Node `24.14.0` (and `25.5.0`); it does not exist
on Node 22 or on Node `24.x` below `24.14.0`. `fjs/effects/node/module.ts:297-298`
already calls `ctx.test(name, { expectFailure }, ...)`, i.e. the native
`node:test` path this codebase relies on. This matches the existing caveat
documented in `AGENTS.md:47-57` ("Node's built-in test runner... needs Node 24
or later. On Node 22 it runs to completion but reports every `throw`-tagged
test... as a failure"). (Correction to an earlier note on this PR:
`expectFailure` **is** a real, versioned `node:test` option — not an ignored
key — which is exactly why this gap is version-dependent rather than always
broken.)

That technical floor (`24.14.0`) is *not* what the fallback threshold below
uses, though. `@types/node` only publishes major versions that track Node's
majors — currently `25.x` and `26.x`, with no `@types/node@24.14`-shaped
release to typecheck against — and there is no intention of running CI
against the narrow `24.14`–`25.x` range just to exercise the native path
there. Gating on major `26` instead means the native
`ctx.test(name, { expectFailure }, ...)` path is only ever exercised on a Node
major we actually typecheck and run in CI; every other supported runtime (22
through 25) uses the fallback uniformly, which is one well-tested code path
instead of a version matrix nobody is going to test.

**Fallback threshold: Node `26.0.0`.** Below that, `register` should **fall
back** to the same inline, flattened test-registration strategy the runner
already uses for Bun and Playwright (`inlineTest`/`wrapInlineTest`,
`fjs/effects/node/module.ts:307-325`) instead of the native
`ctx.test(name, { expectFailure }, ...)` path — `inlineTest` implements the
pass/fail inversion itself in plain code (`fjs/effects/node/module.ts:307-314`),
so it does not depend on `node:test`'s native `expectFailure` support at all.
This makes `node --test` (and `npm run cov`, which wraps it) work correctly on
Node 22, satisfying the constraint that Codex's Docker containers cannot be
upgraded off Node 22 — rather than throwing/failing the whole test register,
which would make `register` unusable there.

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
   constructed, compare `nodeVersion` against the fixed floor `26.0.0` using a
   proper semver-order comparison (major, then minor, then patch) — not a
   hardcoded major-`22` (or major-`23`) special case. When `engine === 'node'`
   and `nodeVersion < 26.0.0`, build `testContext` from the same
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
5. Keep `@types/node` in `package.json` (`package.json:47`) on its
   current/latest version (`26.1.2`) rather than pinning it down to `24.x` or
   `22.x`. `@types/node@24` was tried and still fails `tsc`, because
   `expectFailure` is absent from its `TestOptions` type even though
   `node --test` supports it correctly at runtime on Node 24 — the type
   package lags the runtime here. Since the typings version doesn't need to
   track the runtime-version fallback (step 3), there is no downgrade to make;
   the earlier "pin to 24.X.Y" plan is dropped. No lockfile regeneration is
   needed for this item, since `@types/node` is not changing.
6. Cover every new branch with co-located proofs, per the repository's
   mandatory 100% line/branch coverage: `nodeVersion` at/above `26.0.0` keeps
   the native `testContext`, `nodeVersion` below `26.0.0` swaps in the inline
   context, and Bun/Deno/Playwright are unaffected by the comparison entirely.
7. Update `AGENTS.md` to reflect that `node --test` (and `npm run cov`, which
   wraps it) now work correctly on Node 22, since the fallback removes the
   inversion bug the current text warns about:
   - `AGENTS.md:32` (§1.1 table) — drop the "Node 24+ for `node --test`"
     caveat from the Node.js row; `node --test` now works from the stated
     22-minimum.
   - `AGENTS.md:47-57` (§1.3 "The Node version caveat") — replace the
     "needs Node 24 or later" warning with a short note that `register`
     automatically falls back to an inline test-registration strategy below
     Node `26.0.0`, so `node --test`/`npm run cov` report correctly on Node
     22 too; keep noting that Node `26.0.0`+ is still the fully-supported,
     native-`expectFailure` baseline.
   - `AGENTS.md:68-69` (§1.4 table) — change the `node --test` and `npm run
     cov` rows' `Runtime` column from `Node 24+` to `Node 22+`.
   - Section numbering/title in §1.3 may need adjusting once the caveat is
     gone (e.g. rename to describe the fallback rather than a limitation).

### Tasks

- [ ] Add `'deno'` to `Engine` and detect it explicitly in
      `fjs/effects/node/module.ts:335` (before falling through to `'node'`).
- [ ] Add an optional Node-version field to `NodeProgramOptions` in
      `fjs/effects/node/module.f.ts`.
- [ ] Populate it from `process.version` in the Node runner, only when
      `engine === 'node'`.
- [ ] In `fjs/effects/node/module.ts`, when `engine === 'node'` and
      `nodeVersion < 26.0.0` (semver order), construct `testContext` via
      `wrapInlineTest(testContext.test)` instead of the raw `node:test`
      export, reusing the existing Bun/Playwright fallback path rather than
      adding a new failure path.
- [ ] Add proofs covering: Node `>= 26.0.0` uses the native context, Node
      `< 26.0.0` uses the inline context, and Bun/Deno/Playwright are
      unaffected — 100% line/branch coverage of the new code.
- [ ] Leave `@types/node` in `package.json:47` at its current/latest version
      (`26.1.2`) — do not pin it to `24.x` or `22.x`; confirmed `24` fails
      `tsc` on the missing `expectFailure` type despite working at runtime.
- [ ] Document the supported-Node-version policy and the inline-context
      fallback (README or JSDoc near `register`/`NodeProgramOptions`),
      including that Deno is exempt from the Node-version comparison.
- [ ] Update `AGENTS.md`: drop the "Node 24+ for `node --test`" caveat from
      the §1.1 table (`AGENTS.md:32`), rewrite §1.3 "The Node version caveat"
      (`AGENTS.md:47-57`) to describe the automatic inline-context fallback
      instead of a limitation, and change the `node --test` / `npm run cov`
      rows in the §1.4 table (`AGENTS.md:68-69`) from `Node 24+` to
      `Node 22+`.

### Related

- `fjs/effects/node/module.f.ts:524` — `NodeProgramOptions`.
- `fjs/effects/node/module.ts:307-325` — `inlineTest` / `wrapInlineTest` /
  `bunTestContext`.
- `fjs/emergent_testing/module.f.ts:409` — `register`.
- `package.json:20` — `engines.node: ">=22"`.
- `package.json:47` — `@types/node` version (staying on latest; not tied to
  the runtime fallback threshold).
- `AGENTS.md:30-77` — §1.1/§1.3/§1.4 Node-version documentation to update.
