# CI Integration Tests

**Priority:** P3
**Status:** open

Split the CI pipeline into two stages:

1. **Build stage** — a single, minimal job (e.g. Docker + Node 26) that runs unit tests (`fjs t`) and coverage, then publishes the package as a CI artifact. Platform coverage here is unimportant — FunctionalScript unit tests are platform-agnostic.
2. **Integration stage** — a broad matrix of jobs (multiple OS × architecture combinations) that each download the artifact, install it, and run scenarios. This is where platform-specific failures actually surface: a package that installs and runs correctly on Linux/x64 may fail on Windows/ARM or macOS/ARM.

The key insight: it matters far more that the *published package* works on every platform than that unit tests pass on every platform.

## Scenarios

Scenarios are expressed as FunctionalScript modules. A scenario module exports a `main` (a `NodeProgram`) that receives the environment and args and returns an effect. The CI generator reads a scenario list and emits one job per scenario.

Open questions:
- Where do scenario modules live? (`issues/demo/` style, or a dedicated `fs/ci/scenarios/` directory?)
- How does a scenario declare which runtime(s) it targets (Node, Deno, Bun)?
- Should the artifact be a `.tgz` from `npm pack`, or a published pre-release to a local registry?

## Plan

- [ ] Define the scenario interface (`export const main: NodeProgram` or similar).
- [ ] Implement the artifact publish step in the CI generator (run `npm pack`, upload as a GitHub Actions artifact).
- [ ] Implement scenario job generation: download artifact, install, run `main`.
- [ ] Port existing demo/smoke-test steps (`fjs t`, `deno run … t`, `bunx … t`) to the scenario model.
- [ ] Document the scenario authoring convention.
