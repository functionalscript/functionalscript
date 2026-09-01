## CI Integration Tests

**Priority:** P3
**Status:** open

Split the CI pipeline into two stages:

1. **Build stage** — a single, minimal job (e.g. the Nix shell + Node 26) that runs unit tests (`fjs t`) and coverage, then publishes the package as a CI artifact. Platform coverage here is unimportant — FunctionalScript unit tests are platform-agnostic.
2. **Integration stage** — a broad matrix of jobs (multiple OS × architecture combinations) that each download the artifact, install it, and run scenarios. This is where platform-specific failures actually surface: a package that installs and runs correctly on Linux/x64 may fail on Windows/ARM or macOS/ARM.

The key insight: it matters far more that the *published package* works on every platform than that unit tests pass on every platform.

### Scenarios

Scenarios are expressed as FunctionalScript modules. A scenario module exports a `main` (a `NodeProgram`) that receives the environment and args and returns an effect. The CI generator reads a scenario list and emits one job per scenario.

Each scenario is a declarative description of initial state, an effect, and an expected result that can be run as either a unit test (mock interpreter) or a real CI job. (The `669-scenario-testing.md` design doc this used to reference no longer exists; issue number 669 has since been reused for unrelated files, e.g. [669-ci-ubuntu-job-factory.md](669-ci-ubuntu-job-factory.md).)

Open questions:
- Where do scenario modules live? (`todo/demo/` style, or a dedicated `fjs/ci/scenarios/` directory?)
- How does a scenario declare which runtime(s) it targets (Node, Deno, Bun)?
- Should the artifact be a `.tgz` from `npm pack`, or a published pre-release to a local registry?

### Plan

- [ ] Define the scenario interface (`export const main: NodeProgram` or similar).
- [ ] Implement the artifact publish step in the CI generator (run `npm pack`, upload as a GitHub Actions artifact).
- [ ] Teach the CI generator to express job ordering, so a consuming job cannot
      start before the artifact is uploaded. `jobSchema` in
      `fjs/ci/common/module.f.mjs` is deliberately **closed** and names only
      `runs-on` and `steps`, and it is the same schema `parseGitHubAction`
      reads the generated workflow back through (`fjs/ci/proof.f.mjs`), so a
      bare `needs:` key would fail that round-trip rather than merely being
      unmodelled. Add `needs: or(option, array(string))` — the optional-field
      idiom already used in `stepSchema` — which widens `Job` in
      `fjs/ci/common/types.ts`, and cover the new field in the proof. Without
      it the two stages race and the consumer fails at `download-artifact`:
      red for the wrong reason, which is the one failure mode that trains
      people to re-run a check instead of reading it. This blocked the stage
      split below and the packed-declaration check alike, so it is owned here
      rather than by either consumer. The `needs` field landed in
      [#1762](https://github.com/functionalscript/functionalscript/pull/1762)
      and its first consumer in
      [#1767](https://github.com/functionalscript/functionalscript/pull/1767).
- [ ] Implement scenario job generation: download artifact, install, run `main`.
- [ ] Port existing demo/smoke-test steps (`fjs t`, `deno run … t`, `bunx … t`) to the scenario model.
- [ ] Document the scenario authoring convention.
