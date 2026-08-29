## No-op indirections in `fjs/ci`

**Priority:** P4
**Status:** open

### Problem

Two names in `fjs/ci` are exact aliases of the thing they wrap, so a reader
follows a hop to arrive where they started:

- `fjs/ci/node/module.f.mjs:129` — `const nodeJob = steps => ubuntuArm(steps)`,
  an eta-expansion of `ubuntuArm`;
- `:155` — `export const nodeMainSteps = platformNodeSteps`, imported under
  that name by `fjs/ci/module.f.mjs:28` while `platformNodeSteps` is exported
  too, so the same function is public twice.

`nixJobs` was a third and is not one any more: `deno` and `bun` own flakes now, so
`fjs/ci/module.f.mjs` composes `[...nodeNixJobs, denoNixJob, bunNixJob]` and its
comment — "every generated flake, across all job families that own one" — describes
what it holds. The spidermonkey runner was expected to be the first second family;
the runtime migration got there first.

`basicNode` (`fjs/ci/node/module.f.mjs:44`) is exported but reached only by its
own proof.

### Proposal

Drop `nodeJob` and `nodeMainSteps`; call `ubuntuArm` and `platformNodeSteps`
directly. Either use `basicNode` from `nodeInstall`'s callers or make it private.

### Tasks

- [ ] Remove the `nodeJob` and `nodeMainSteps` aliases
- [x] Decide `nixJobs`: kept, and no longer an alias — it composes three families
- [ ] Use `basicNode` or make it private

### Related

- [669-ci-ubuntu-job-factory](669-ci-ubuntu-job-factory.md) — the
  `ubuntu`/`ubuntuArm` factory `nodeJob` wraps

### History

This issue was `dead-nix-flake-job.md`, reporting that `nodeNixFlakeJob` and
the private `nixFlakeJob` were the same expression with two different rationale
comments and only one of them reachable. Both are gone: CI no longer runs a job
that instantiates the generated flakes to check them, so the duplicated pair
went with the job. The aliases above are what is left of that report.
