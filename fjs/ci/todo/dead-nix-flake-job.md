## `nodeNixFlakeJob` is a dead duplicate

**Priority:** P4
**Status:** open

### Problem

`fjs/ci/node/module.f.mjs:134-137` and `fjs/ci/module.f.mjs:49` are the same
expression:

```js
export const nodeNixFlakeJob = ubuntuArm([nixInstall, ...nodeNixVersionSteps])
const nixFlakeJob = ubuntuArm([nixInstall, ...nodeNixVersionSteps])
```

Nothing imports `nodeNixFlakeJob` — the exported copy (with a 12-line
rationale comment) is dead, and the live private copy carries a shorter,
differently-worded comment. Two descriptions of one job that must be deleted
together when the flakes are adopted.

The same ~100 lines hold three no-op indirections:

- `fjs/ci/node/module.f.mjs:73` — `const nodeJob = steps => ubuntuArm(steps)`,
  an eta-expansion of `ubuntuArm`;
- `:139` — `export const nodeMainSteps = platformNodeSteps`, an alias
  imported by `fjs/ci/module.f.mjs` while `platformNodeSteps` is also
  exported;
- `fjs/ci/module.f.mjs:44` — `const nixJobs = nodeNixJobs`.

`basicNode` (`:32-35`) is exported but referenced only by its own proof.

### Proposal

Delete `nodeNixFlakeJob` (moving its rationale comment onto the surviving
`nixFlakeJob`), drop the three aliases, and either use `basicNode` from
`nodeInstall`'s callers or make it private.

### Tasks

- [ ] Delete the dead export, keep the better comment
- [ ] Remove the `nodeJob` / `nodeMainSteps` / `nixJobs` aliases

### Related

- [669-ci-ubuntu-job-factory](669-ci-ubuntu-job-factory.md) — the
  `ubuntu`/`ubuntuArm` factory; the flake-job pair is a separate duplication
  its factory does not remove
