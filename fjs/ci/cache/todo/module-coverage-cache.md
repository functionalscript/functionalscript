## Cache coverage by module dependencies

**Priority:** P2
**Status:** wip

### Problem

The CI success cache keys coverage over the conservative `js` input group.
A change to an unrelated module invalidates the whole coverage check. The
dependency graph and isolated coverage runner now provide the foundations for
checking and caching each module independently.

This issue tracks the CI integration. The existing
[per-module coverage issue](../../../emergent_testing/todo/per-module-coverage.md)
owns proof isolation, runner behavior and closing the proof gaps it exposes.

### Proposal

Deliver this in stages, starting with a dedicated `cov` CI job. The first PR
records this plan only; each implementation stage follows in a separate PR.

#### 1. Dedicated coverage job

Move the existing Node coverage check into a dedicated `cov` job, initially
without cache skipping. Use the existing mise setup and pinned Node version,
retain the current proof discovery and 100% thresholds, and generate the
workflow through `fjs/ci`. Keep ordinary runtime tests in their existing jobs.

This stage can use today's `npm run cov` combined-suite check. It separates
coverage execution from cache behavior without waiting for the remaining
isolated-proof gaps. Do not silently replace it with an isolated check that
is known to fail, lower thresholds or remove the existing demo coverage.

#### 2. Per-module runs and dependency manifests

Discover every `module.f.js` and `module.f.mjs` independently of its proofs.
For each, select all immediate sibling files matching `*proof.f.js` or
`*proof.f.mjs`, including `proof.f.js` and `proof.f.mjs`. Descendant proofs
do not belong to the module's suite.

Run each module's suite in a fresh Node coverage process, reusing the existing
isolated runner rather than creating a second runner. Measure the selected
implementation file with 100% lines, branches and functions. A missing proof,
empty suite, failed test or missing coverage result cannot pass. Close the
remaining isolation rollout tasks before making this the replacement CI gate;
preserve a full FJS test pass and the existing demo coverage obligation.

Construct one manifest per implementation file. Start with the module and all
selected proofs, then include every file reachable from any of those roots.
Reuse the AST-based dependency extraction and resolver behind `fjs deps`.
Include roots, shared dependencies, helpers and JSON leaves once each; traverse
cycles without losing files. Keep `_deps.json`'s public graph format unchanged.

The manifest maps paths to file hashes instead of direct dependency arrays:

```json
{
  "contract": "<coverage-contract-key>",
  "module": "fjs/example/module.f.js",
  "files": {
    "fjs/example/module.f.js": "<file-hash>",
    "fjs/example/proof.f.mjs": "<file-hash>",
    "fjs/shared/module.f.js": "<file-hash>"
  }
}
```

Use normalized repository-relative paths and deterministic ordering. Reuse
the committed file identities already enumerated by `ci init`, plus canonical
JSON and the existing SHA-256/CBase32 cache keys. Graph resolution and file
identities must describe the same checked-out commit. Missing files or hashes
and incomplete dependency scans must never produce a cache hit.

The manifest must describe what the coverage process actually loads. The
current shallow runner can also load sibling implementation files, demos and
inline proofs; include those files and their dependency closures if it keeps
loading them. Record the selected proof inventory so adding, deleting or
renaming a sibling proof invalidates the key.

Audit inputs outside the static runtime-import graph before enabling reuse:
runner/reporter code, coverage configuration, dynamically loaded code, fixtures
and generated inputs. Include every relevant input or leave the affected run
uncached. The contract includes the coverage command, target, thresholds,
execution settings, platform and pinned runtime/tool versions. Another check
or a previous contract cannot certify this result.

Initially generate manifests and run every module without consulting the cache.
The all-source dependency scan still has parsing gaps tracked by the
[dependency graph issue](../../../todo/module-dependency-graph-command.md);
do not reuse a stale `_deps.json` after a failed scan.

#### 3. Reuse successful coverage from build-cache

Look up each canonical manifest by its content key in the existing
`build-cache` Git CAS. Skip only that module's coverage when the exact manifest
has already been recorded after a successful isolated coverage run. A newly
prepared manifest in a temporary directory is not evidence of success.

On a miss, run coverage and record the manifest only after both proof execution
and coverage validation pass. Failed or interrupted runs record no success.
Reuse the existing cache publication and concurrent-update handling, including
the restrictions on publication from forks and Dependabot. The old whole-check
coverage entry must not bypass the per-module lookup.

Report hits, executed modules and failures, then fail the job if any required
module fails. If a combined coverage report is retained, store and restore each
module's validated report alongside its success entry so cache hits still
contribute to that report.

### Acceptance criteria

- Changing a module, sibling proof or transitive dependency reruns its coverage.
  Adding, deleting or renaming a proof also invalidates its manifest.
- Changing an unrelated file leaves the module's key unchanged unless the file
  is an explicitly shared coverage input.
- Shared dependencies appear once, cycles terminate, and both implementation
  and proof filename extensions participate in discovery.
- Changing the coverage contract invalidates prior successes. Aggregate-suite
  success cannot stand in for isolated per-module success.
- Missing or incomplete dependency information never permits a skip; failed or
  interrupted coverage is rerun on the next attempt.
- Cold runs check every selected module; warm runs skip only exact successes.
  One module's failure does not prevent independent successes being recorded.

### Tasks

- [ ] Add the dedicated, initially uncached `cov` CI job through the generator,
      retaining the combined coverage command and its thresholds.
- [ ] Complete the isolated coverage rollout, then generate deterministic
      manifests for modules and sibling proofs; audit extra coverage inputs.
      Run coverage unconditionally while validating manifests.
- [ ] Add per-module cache lookup, successful-result recording and publication;
      verify cold/warm runs and invalidation, and update CI/cache documentation.

### Related

- [CI success cache](../README.md) — existing committed identities, contracts
  and `build-cache` publication.
- [Module dependencies](../../../deps/README.md) — graph extraction and
  its current syntax limitations.
- [Smart build epic](../../../todo/smart-build-epic.md) — parent task.
