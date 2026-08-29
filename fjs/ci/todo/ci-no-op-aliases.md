## No-op indirections in `fjs/ci`

**Priority:** P4
**Status:** open

### Problem

Three names in `fjs/ci` are exact aliases of the thing they wrap, so a reader
follows a hop to arrive where they started:

- `fjs/ci/node/module.f.mjs:112` — `const nodeJob = steps => ubuntuArm(steps)`,
  an eta-expansion of `ubuntuArm`;
- `:147` — `export const nodeMainSteps = platformNodeSteps`, imported under
  that name by `fjs/ci/module.f.mjs:28` while `platformNodeSteps` is exported
  too, so the same function is public twice;
- `fjs/ci/module.f.mjs:49` — `const nixJobs = nodeNixJobs`. Its comment ("every
  generated flake, across all job families that own one") is the one thing the
  alias adds, and it will stop being an alias as soon as a second family owns a
  flake — the spidermonkey runner would be the first.

`basicNode` (`fjs/ci/node/module.f.mjs:44`) is exported but reached only by its
own proof.

### Proposal

Drop `nodeJob` and `nodeMainSteps`; call `ubuntuArm` and `platformNodeSteps`
directly. Keep `nixJobs` only if its comment is worth the hop — otherwise inline
it and move the comment to `nodeNixJobs`. Either use `basicNode` from
`nodeInstall`'s callers or make it private.

### Tasks

- [ ] Remove the `nodeJob` and `nodeMainSteps` aliases
- [ ] Decide `nixJobs`: keep with its comment, or inline
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
