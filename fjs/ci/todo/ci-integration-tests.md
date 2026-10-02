## CI Integration Tests

**Priority:** P3
**Status:** open

Split the CI pipeline into two stages:

1. **Build stage** — a single, minimal job (e.g. the Nix shell + Node 26) that runs unit tests (`fjs t`) and coverage, then publishes the package as a CI artifact. Platform coverage here is unimportant — FunctionalScript unit tests are platform-agnostic.
2. **Integration stage** — a broad matrix of jobs (multiple OS × architecture combinations) that each download the artifact, install it, and run scenarios. This is where platform-specific failures actually surface: a package that installs and runs correctly on Linux/x64 may fail on Windows/ARM or macOS/ARM.

The key insight: it matters far more that the *published package* works on every platform than that unit tests pass on every platform.

### Scenarios

Scenarios are expressed as FunctionalScript modules. A scenario module exports a `main` (a `NodeProgram`) that receives the environment and args and returns an effect. The CI generator reads a scenario list and emits one job per scenario.

Each scenario is a declarative description of initial state, an effect, and an expected result that can be run as either a unit test (mock interpreter) or a real CI job. That design lives on as [scenario-testing](../../emergent_testing/todo/scenario-testing.md), formerly `669-scenario-testing.md`.

Open questions:
- Where do scenario modules live? (`todo/demo/` style, or a dedicated `fjs/ci/scenarios/` directory?)
- How does a scenario declare which runtime(s) it targets (Node, Deno, Bun)?
- Should the artifact be a `.tgz` from `npm pack`, or a published pre-release to a local registry?
- Should the integration stage wait on the build stage at all? A job behind `needs` is created only when the job it waits for finishes, so behind a full runner queue it waits a second time — what moved the packed-package check into `node26` (see [built-package-checks](./built-package-checks.md)). Each integration job could pack its own tarball instead.

### Tasks

- [ ] Define the scenario interface (`export const main: NodeProgram` or similar).
- [ ] Hand the packed tarball to the integration stage: an uploaded artifact
      behind `needs`, or each integration job running `npm pack` itself.
      Decide with the open question above. An upload existed once: `node26`
      packed and uploaded a `package-tarball` artifact for the separate
      `package-check` job to download, until that check moved into `node26`
      and the upload went with it.
- [x] Teach the CI generator to express job ordering, so a consuming job cannot
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
      That consumer is gone — the packed-package check is the last steps of
      `node26`, for the queue cost in the open questions above — so no job
      orders itself, and `jobNeeds` in `fjs/ci/proof.f.mjs` pins that count
      at 0.
- [ ] Implement scenario job generation: obtain the tarball (per the task
      above), install, run `main`.
- [ ] Port the remaining published-CLI smoke step (`fjs test` on the two Windows
      jobs) to the scenario model. The `deno run … t` and `bunx … t` steps are
      already gone.
- [ ] Document the scenario authoring convention.

### Related

- [scenario-testing](../../emergent_testing/todo/scenario-testing.md) — the
  scenario type this issue's integration stage runs.
- [built-package-checks](./built-package-checks.md) — also proposes installing
  the packed tarball per platform, where it is packed or in a job that packs
  its own rather than behind `needs`. Open question: which of the two owns the
  per-platform install of the tarball.
