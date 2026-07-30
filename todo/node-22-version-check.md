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

### Proposal

1. Add an optional `nodeVersion` parameter to the Node effects layer so the
   runner can report the detected Node version alongside `engine`. Likely
   `NodeProgramOptions.nodeVersion?: string` (or a parsed `{ major: number,
   minor: number, patch: number }`) in `fjs/effects/node/module.f.ts:524`,
   populated from `process.version` by the Node runner (`fjs/dev/` or wherever
   `NodeProgramOptions` is constructed) and left `undefined` on
   Bun/Playwright/virtual runners.
2. Define the actual minimum supported Node version precisely — the first
   version (major, and minor/patch if relevant) under which every feature
   `register` depends on (including the `expectFailure` test option) is
   available. Do not special-case major `22`; compare `nodeVersion` against
   this defined minimum using a proper semver-order comparison, so Node 23 or
   any other version below the floor is also rejected.
3. In `register` (`fjs/emergent_testing/module.f.ts:409`), check
   `nodeVersion`/`engine` against that minimum and fail fast (throw or
   register a single failing test) when running under an unsupported Node
   version. The check should be explicit about *why* it fails, so CI logs make
   the version gap obvious rather than surfacing a downstream failure.
4. Downgrade `@types/node` in `package.json` (`package.json:47`) from
   `26.1.2` to either:
   - `24.x` — the minimal Node version that supports all features we rely on
     (recommended), or
   - `22.x` — the version we only partly support, kept only because Codex's
     Docker containers can't have their Node version updated.

### Tasks

- [ ] Add an optional Node-version field to `NodeProgramOptions` in
      `fjs/effects/node/module.f.ts`.
- [ ] Populate it from `process.version` in the Node runner.
- [ ] Define the precise minimum supported Node version (including any
      required minor/patch floor) and confirm which features (e.g.
      `expectFailure`) require it.
- [ ] Add a version check in `register`
      (`fjs/emergent_testing/module.f.ts:409`) that compares against that
      minimum via semver order (not a hardcoded major-22 special case).
- [ ] Decide between `@types/node` `24.x` vs `22.x` and update
      `package.json:47` accordingly.
- [ ] Document the supported-Node-version policy (README or JSDoc near
      `register`/`NodeProgramOptions`).

### Related

- `fjs/effects/node/module.f.ts:524` — `NodeProgramOptions`.
- `fjs/emergent_testing/module.f.ts:409` — `register`.
- `package.json:20` — `engines.node: ">=22"`.
- `package.json:47` — `@types/node` version.
