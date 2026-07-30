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
Without a precise runtime check, a feature the register relies on (e.g. the
`expectFailure` test option) silently misbehaves — or throws a confusing
low-level error — on an unsupported Node version instead of failing the test
register with a clear message.

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
3. Define the actual minimum supported Node version precisely — the first
   version (major, and minor/patch if relevant) under which every feature
   `register` depends on (including the `expectFailure` test option) is
   available. Do not special-case major `22`; compare `nodeVersion` against
   this defined minimum using a proper semver-order comparison, so Node 23 or
   any other version below the floor is also rejected.
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
   what's needed and should come down to `22.x`.

### Tasks

- [ ] Add `'deno'` to `Engine` and detect it explicitly in
      `fjs/effects/node/module.ts:335` (before falling through to `'node'`).
- [ ] Add an optional Node-version field to `NodeProgramOptions` in
      `fjs/effects/node/module.f.ts`.
- [ ] Populate it from `process.version` in the Node runner, only when
      `engine === 'node'`.
- [ ] Define the precise minimum supported Node version (including any
      required minor/patch floor) and confirm which features (e.g.
      `expectFailure`) require it.
- [ ] Add a version check in `register`
      (`fjs/emergent_testing/module.f.ts:409`) that only applies when
      `engine === 'node'`, comparing against that minimum via semver order
      (not a hardcoded major-22 special case), and leaves Bun/Deno/Playwright
      unaffected.
- [ ] Update `@types/node` in `package.json:47` from `26.1.2` down to `22.x`
      (package-wide baseline unchanged).
- [ ] Document the supported-Node-version policy (README or JSDoc near
      `register`/`NodeProgramOptions`), including that Deno is exempt from the
      Node-version guard.

### Related

- `fjs/effects/node/module.f.ts:524` — `NodeProgramOptions`.
- `fjs/emergent_testing/module.f.ts:409` — `register`.
- `package.json:20` — `engines.node: ">=22"`.
- `package.json:47` — `@types/node` version.
