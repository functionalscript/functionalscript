## Node 22 version check. `register` should fail on Node 22

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

Without a runtime check, a feature that only works on Node 24+ silently
misbehaves (or throws a confusing low-level error) when run on Node 22
instead of failing the test register with a clear message.

### Proposal

1. Add an optional `nodeVersion` parameter to the Node effects layer so the
   runner can report the detected Node version alongside `engine`. Likely
   `NodeProgramOptions.nodeVersion?: string` (or a parsed `{ major: number }`)
   in `fjs/effects/node/module.f.ts:524`, populated from `process.version` by
   the Node runner (`fjs/dev/` or wherever `NodeProgramOptions` is
   constructed) and left `undefined` on Bun/Playwright/virtual runners.
2. In `register` (`fjs/emergent_testing/module.f.ts:409`), check
   `nodeVersion`/`engine` and fail fast (throw or register a single failing
   test) when running under Node 22, since Node 22 is only partially
   supported. The check should be explicit about *why* it fails, so CI logs
   make the version gap obvious rather than surfacing a downstream failure.
3. Downgrade `@types/node` in `package.json` (`package.json:47`) from
   `26.1.2` to either:
   - `24.x` — the minimal Node version that supports all features we rely on
     (recommended), or
   - `22.x` — the version we only partly support, kept only because Codex's
     Docker containers can't have their Node version updated.

### Tasks

- [ ] Add an optional Node-version field to `NodeProgramOptions` in
      `fjs/effects/node/module.f.ts`.
- [ ] Populate it from `process.version` in the Node runner.
- [ ] Add a version check in `register`
      (`fjs/emergent_testing/module.f.ts:409`) that fails the test register on
      Node 22.
- [ ] Decide between `@types/node` `24.x` vs `22.x` and update
      `package.json:47` accordingly.
- [ ] Document the supported-Node-version policy (README or JSDoc near
      `register`/`NodeProgramOptions`).

### Related

- `fjs/effects/node/module.f.ts:524` — `NodeProgramOptions`.
- `fjs/emergent_testing/module.f.ts:409` — `register`.
- `package.json:20` — `engines.node: ">=22"`.
- `package.json:47` — `@types/node` version.
