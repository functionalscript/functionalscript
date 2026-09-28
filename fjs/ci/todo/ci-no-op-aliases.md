## No-op indirections in `fjs/ci`

**Priority:** P4
**Status:** open

### Problem

Two names in `fjs/ci` are exact aliases of the thing they wrap, so a reader
follows a hop to arrive where they started:

- `nodeJob` in `fjs/ci/node/module.f.mjs` — `const nodeJob = steps => ubuntuArm(steps)`,
  an eta-expansion of `ubuntuArm`;
- `nodeMainSteps` in the same module — `export const nodeMainSteps = platformNodeSteps`,
  imported under that name by `fjs/ci/module.f.mjs` while `platformNodeSteps` is
  exported too, so the same function is public twice.

`nixJobs` was a third and is not one any more: `fjs/ci/module.f.mjs` composes
`[...nodeNixJobs, devNixJob]` — the Node flakes and the shared developer shell
every other job enters — and its comment describes what it holds.

### Proposal

Drop `nodeJob` and `nodeMainSteps`; call `ubuntuArm` and `platformNodeSteps`
directly.

### Tasks

- [ ] Remove the `nodeJob` and `nodeMainSteps` aliases
- [x] Decide `nixJobs`: kept, and no longer an alias — it composes the Node
      flakes and the shared shell

### Related

- [669-ci-ubuntu-job-factory](669-ci-ubuntu-job-factory.md) — the
  `ubuntu`/`ubuntuArm` factory `nodeJob` wraps

### History

This issue was `dead-nix-flake-job.md`, reporting that `nodeNixFlakeJob` and
the private `nixFlakeJob` were the same expression with two different rationale
comments and only one of them reachable. Both are gone: CI no longer runs a job
that instantiates the generated flakes to check them, so the duplicated pair
went with the job. The aliases above are what is left of that report.
