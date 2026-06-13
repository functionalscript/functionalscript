# Release 0.31.0 — Add main Entry Point for Deno npm:functionalscript Support

**Priority:** P1
**Status:** open

## Problem

The `package.json` is missing a `"main"` entry point, which prevents `deno run npm:functionalscript` from working in the CI and as documented in `fs/emergent_testing/README.md`. Without a main entry point, Deno doesn't know which file to execute when running the npm package directly.

This became critical when the Deno CI job was added (June 9, 2026, PR #1009), which includes the smoke test step:
```
deno run -A npm:functionalscript@0.30.0 t
```

The bug went unnoticed until Deno 2.8.3 (June 11, 2026) introduced stricter npm package resolution that exposed this pre-existing issue.

## Solution

Add `"main": "fs/fjs/module.js"` to `package.json`. This points to the CLI entry point (`fs/fjs/module.f.ts`) which exports the `main` handler for FunctionalScript commands including the test command (`t`).

This enables:
- `deno run -A npm:functionalscript t` (CI smoke test)
- `deno run -A npm:functionalscript@0.31.0 t` (pinned version)
- All other fjs commands (`compile`, `cas`, `ci`, `run`)

## Rationale

The `main` field is standard npm package configuration. It:
1. Makes the package compliant with npm standards
2. Aligns with the documented usage in `fs/emergent_testing/README.md`
3. Allows Deno (and other tools) to discover and execute the package as a CLI
4. Doesn't break existing usage via the `fjs` binary or imports

## Implementation

- Add `"main": "fs/fjs/module.js"` field to `package.json`
- Bump version to 0.31.0
- Update `fs/ci/config/module.f.ts` to pin `functionalscript = '0.31.0'`
- Regenerate CI workflow via `npm run ci-update`
- Create GitHub release for 0.31.0
- Publish to npm

## Related

- [#1009](https://github.com/functionalscript/functionalscript/pull/1009) — Added Deno CI job
- [#1058](https://github.com/functionalscript/functionalscript/pull/1058) — Fixed Deno version and TypeScript Go version in CI
- [fs/emergent_testing/README.md](../fs/emergent_testing/README.md) — Documents `deno run npm:functionalscript t`
