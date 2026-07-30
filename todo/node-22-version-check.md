## Node version check. `register` should fail below the minimum supported Node version

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
ahead of both: it should track whichever Node version FunctionalScript
actually commits to supporting, not an arbitrary newer major.

A check that only special-cases major `22` is insufficient: `engines.node`
also accepts Node 23, and any other version below the real minimum (including
a minor/patch floor within the minimum major) would be silently accepted too.
Without a precise runtime check, an unsupported Node version silently
misbehaves — or throws a confusing low-level error — instead of failing the
test register with a clear message.

**Minimum supported version: Node `24.0.0`.** This is the floor stated by the
maintainer as the fully-supported baseline; Node 22 is kept working only
because Codex's Docker containers cannot be upgraded off it, not because it is
a target. Before implementation, audit `register` and the `Test`/`TestFn`
plumbing (`fjs/effects/node/module.ts:297-314`) for any concrete Node 24-only
API dependency (none is currently confirmed — the earlier reference to an
`expectFailure` *native* `node:test` option was incorrect: `node:test`'s
`test()` has no `expectFailure` option, so `{ expectFailure }`
(`fjs/effects/node/module.ts:298`) is currently just an ignored extra key, not
a version-gated feature). If no concrete Node 24-only dependency is found, the
guard still enforces `24.0.0` as the declared support floor, independent of
any single API trigger.

This issue spans `fjs/emergent_testing`, `fjs/effects/node`, and the root
`package.json`, so it is filed at the top level rather than under a single
module's `todo/`.

The guard must not misfire on Deno. `fjs/emergent_testing/README.md:64-84`
documents Deno as a supported external runner (`deno test`), but
`fjs/effects/node/module.ts:335` currently classifies every runtime that is
neither Bun nor Playwright as `engine: 'node'` — Deno included, since it also
shims `node:process`. Populating `nodeVersion` from that shim and gating on
`engine === 'node'` alone would apply the Node-only minimum-version floor to
Deno as well, which is wrong.

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
3. Compare `nodeVersion` against the fixed floor `24.0.0` using a proper
   semver-order comparison (major, then minor, then patch) — not a hardcoded
   major-`22` (or major-`23`) special case, so every version below `24.0.0`
   is rejected uniformly.
4. In `register` (`fjs/emergent_testing/module.f.ts:409`), check
   `nodeVersion` only when `engine === 'node'` and fail fast (throw or
   register a single failing test) when running under an unsupported Node
   version. Bun, Deno, and Playwright must be unaffected by this guard. The
   check should be explicit about *why* it fails, so CI logs make the version
   gap obvious rather than surfacing a downstream failure.
5. Keep `@types/node` in `package.json` (`package.json:47`) at a `22.x`
   typings baseline rather than bumping it to `24.x`. `package.json:20`
   (`engines.node: ">=22"`) commits the ordinary CLI and repo runner (`fjs t`,
   `fjs/module.ts`) to Node 22 support package-wide; compiling everything
   against `24.x` typings would let Node 23/24-only APIs compile in code paths
   outside `register`, breaking supported Node 22 consumers at runtime. Only
   revisit this if the task also drops package-wide Node 22 support and
   updates the `engines` policy accordingly. `26.1.2` is in any case ahead of
   what's needed and should come down to `22.x`. `package-lock.json`,
   `deno.lock`, and `bun.lock` all currently also pin `@types/node` `26.1.2`
   and must be regenerated together with `package.json`, not edited by hand —
   run `npm run update` (`package.json:16`, which chains `ci-update`, `npm
   install`, `deno install`, and `bun install`) and commit the resulting
   lockfile diffs.
6. Cover every new branch with co-located proofs, per the repository's
   mandatory 100% line/branch coverage: a passing case at/above `24.0.0`, a
   failing case below `24.0.0` (asserted via a `throw`-key test, matching the
   convention in `fjs/emergent_testing/proof.f.ts:279,332-339`), and an
   unaffected case for each of Bun/Deno/Playwright showing the guard does not
   run when `engine !== 'node'`.

### Tasks

- [ ] Add `'deno'` to `Engine` and detect it explicitly in
      `fjs/effects/node/module.ts:335` (before falling through to `'node'`).
- [ ] Add an optional Node-version field to `NodeProgramOptions` in
      `fjs/effects/node/module.f.ts`.
- [ ] Populate it from `process.version` in the Node runner, only when
      `engine === 'node'`.
- [ ] Audit `register`/`Test`/`TestFn` for any concrete Node `24.0.0`-only API
      dependency; record the finding (confirms or drops the rationale, the
      `24.0.0` floor itself stays either way).
- [ ] Add a version check in `register`
      (`fjs/emergent_testing/module.f.ts:409`) that only applies when
      `engine === 'node'`, comparing `nodeVersion` against the fixed `24.0.0`
      floor via semver order (not a hardcoded major-22 or major-23 special
      case), and leaves Bun/Deno/Playwright unaffected.
- [ ] Add proofs covering: Node `>= 24.0.0` passes, Node `< 24.0.0` fails
      (`throw`-key test), and Bun/Deno/Playwright are unaffected — 100%
      line/branch coverage of the new code.
- [ ] Update `@types/node` in `package.json:47` from `26.1.2` down to `22.x`
      (package-wide baseline unchanged).
- [ ] Run `npm run update` and commit the regenerated `package-lock.json`,
      `deno.lock`, and `bun.lock`.
- [ ] Document the supported-Node-version policy (README or JSDoc near
      `register`/`NodeProgramOptions`), including that Deno is exempt from the
      Node-version guard.

### Related

- `fjs/effects/node/module.f.ts:524` — `NodeProgramOptions`.
- `fjs/emergent_testing/module.f.ts:409` — `register`.
- `package.json:20` — `engines.node: ">=22"`.
- `package.json:47` — `@types/node` version.
