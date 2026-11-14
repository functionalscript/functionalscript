## CI Integration Tests

**Priority:** P3
**Status:** open

Extend the existing package artifact pipeline with broader integration scenarios.
The current smoke check already has two stages:

1. **Build stage** — `node` runs source checks, packs the revision and uploads
   the `package-tarball` artifact. Coverage runs independently in `cov`.
2. **Consumer stage** — `package` waits for `node`, downloads the artifact and
   checks installation, declarations and a runtime import in a clean directory.
   It uses pinned Node and npm-installed TypeScript without a checkout or mise.

A broader OS × architecture/runtime matrix remains proposed: installing and
running the package on Linux/ARM does not establish Windows or macOS behavior.

### Scenarios

Scenarios are expressed as FunctionalScript modules. A scenario module exports a `main` (a `NodeProgram`) that receives the environment and args and returns an effect. The CI generator reads a scenario list and emits one job per scenario.

Each scenario is a declarative description of initial state, an effect, and an expected result that can be run as either a unit test (mock interpreter) or a real CI job. That design lives on as [scenario-testing](../../emergent_testing/todo/scenario-testing.md), formerly `669-scenario-testing.md`.

Open questions:
- Where do scenario modules live? (`todo/demo/` style, or a dedicated `fjs/ci/scenarios/` directory?)
- How does a scenario declare which runtime(s) it targets (Node, Deno, Bun)?
- Should broader scenarios also test registry delivery? The existing smoke
  check consumes the `.tgz` built from the tested revision.
- What runner-queue and execution cost would a broader consumer matrix add to
  the existing `needs: ['node']` pipeline?

### Tasks

- [ ] Define the scenario interface (`export const main: NodeProgram` or similar).
- [x] Hand the packed tarball to the consumer stage: `node` uploads
      `package-tarball`, and `package` downloads it after `node` succeeds.
- [x] Teach the CI generator to express job ordering, so a consuming job cannot
      start before the artifact is uploaded. The closed `jobSchema` in
      `fjs/ci/common/module.f.js` admits optional `needs` as an array of job
      names; `parseGitHubAction` reads it back in the workflow proofs.
      The `needs` field landed in
      [#1762](https://github.com/functionalscript/functionalscript/pull/1762)
      and its first consumer in
      [#1767](https://github.com/functionalscript/functionalscript/pull/1767).
      The current `package` job uses `needs: ['node']` for the restored
      artifact handoff.
- [ ] Implement scenario job generation: obtain the tarball (per the task
      above), install, run `main`.
- [ ] Document the scenario authoring convention.

The Windows jobs now test host-JS proofs from the checkout with Node; the former
installed-CLI smoke step has been removed. Installed-package scenarios remain
part of this integration-test proposal.

### Related

- [scenario-testing](../../emergent_testing/todo/scenario-testing.md) — the
  scenario type this issue's integration stage runs.
- [built-package-checks](./built-package-checks.md) — proposes broader CLI,
  registry and platform coverage in a separate test repository. Reconcile the
  scenario matrix with that investigation before expanding the smoke check.
