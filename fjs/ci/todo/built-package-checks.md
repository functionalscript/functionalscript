## Create a package test repository

**Priority:** P3
**Status:** open

### Problem

The [six-job CI proposal](./six-ci-jobs.md) temporarily removes the installed
`fjs` runner check and the npm package-consumer check until a better solution
is selected. Source tests still exercise the repository's own runner, but do
not establish that the distributed package installs, exposes its CLI and
imports, and ships usable declarations in a consumer project.

The existing checks also have different subjects. `platformNodeSteps` in
[`../node/module.f.mjs`](../node/module.f.mjs) installs a pinned published
FunctionalScript release, then runs it against the current source proofs.
`packageCheckSteps` in [`../package/module.f.mjs`](../package/module.f.mjs)
checks a tarball packed from the revision under test. Passing the former does
not prove the CLI produced by the current revision works.

The replacement belongs in a separate test repository in a different GitHub
organization. The earlier plan to move package checks into the main CI jobs
is superseded by the explicit deferral. Its
rationale and prior installation findings remain available in
[the prior revision](https://github.com/functionalscript/functionalscript/blob/4da35235c90519104738044ca4b7a9e9f7dea1c1/fjs/ci/todo/built-package-checks.md).

### Proposal

Create a separate repository in a different GitHub organization whose CI
tests the FunctionalScript package as a consumer would. Its CI can build a
package from Git, including `main`, or install a package from npm. The separate
repository and organization are part of the requested plan; their names,
triggers, installation modes and test matrix remain to be selected.

Keep the following distinctions explicit:

- **Revision:** for a Git run, resolve the requested ref (including `main`) to
  an exact commit and report it. For an npm run, report the exact package
  version. Checks of `main` give feedback after integration; they do not gate
  a PR's proposed revision unless explicitly connected to that revision later.
- **Installation source:** a Git dependency from `main`, an npm tarball packed
  from that commit, and a published registry version test different delivery
  paths. Choose which contract the pipeline establishes and verify the actual
  package lifecycle. Installing source alone must not be reported as checking
  a published registry artifact.
- **Consumer environment:** run consumer checks outside the source checkout,
  with imports and CLI invocation resolving to the installed package. Avoid
  silently borrowing source files, declarations, dependencies or binaries from
  the producer checkout.
- **Coverage:** investigate CLI invocation and `fjs t`, package imports and
  declarations, and relevant installation behavior across OSes and supported
  runtimes. Select the useful matrix rather than reproducing every source
  test on every platform by default.
- **Feedback:** decide how failures identify the tested commit or package
  version and reach maintainers.

The current `package.json` emits declarations in `prepack`, so the chosen
installation path must account for package preparation. The existing
[consumer validation notes](../packed-consumer-validation.md) describe useful
isolation and declaration checks to evaluate for reuse.

Packing and releasing npm packages may continue in the source repository.
Installed-package tests run in the separate test repository. The source CI
continues to use its own FJS runner for Bun and SpiderMonkey; its source tests
do not establish package correctness.

### Tasks

- [ ] Record the installation checks disabled by the six-job migration and the
      coverage they leave deferred.
- [ ] Select the names and create a package-test repository in a different
      GitHub organization.
- [ ] Investigate Git installation from `main`, installing a tarball packed from
      that revision, and checking a published npm version; state what each proves.
- [ ] Define a small consumer suite for the installed CLI, imports and emitted
      declarations, using an isolated consumer environment.
- [ ] Choose the installation modes, OS/runtime coverage, triggers and failure
      reporting from the investigation results.
- [ ] Implement the package-testing pipeline in that repository and verify that
      it exercises the installed package in an isolated consumer environment.
- [ ] Reconcile the package and integration-testing TODOs with that decision so
      they describe one installation-testing plan.

### Related

- [Six CI jobs](./six-ci-jobs.md) — owns removal from the main CI layout.
- [Consumer validation](../packed-consumer-validation.md) — existing isolation
  and declaration-validation behavior to assess for reuse.
- [Package-check limitations](./package-check-unsupported-package-shapes.md) —
  existing constraints on the consumer checks.
- [CI integration tests](./ci-integration-tests.md) — related consumer scenarios
  whose execution location must follow the replacement decision.
- [Publishing packages](./publishing-packages.md) — publishing remains separate
  from this investigation.
- [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/) and
  [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) — installation
  sources and package creation.
