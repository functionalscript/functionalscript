## Test the packed npm package in a separate job

**Priority:** P3
**Status:** wip

### Problem

The `node` job builds and consumes the npm tarball alongside source checks.
Consumer failures need their own job and a runner without the source checkout.

### Approved design

`node` always installs the packing prerequisites, runs `npm pack` and uploads
the resulting tarball as `package-tarball`. A `package` job needs `node`,
downloads that artifact into a clean runner-temporary consumer directory,
installs pinned Node through `setup-node` and pinned TypeScript through npm,
and runs the existing declaration, runtime-import and negative type checks.
The consumer has no checkout or mise setup. Packing and consumer validation
run without successful-check caching; the existing source checks keep theirs.

### Tasks

- [ ] Separate producer and consumer job assembly and pin the artifact actions.
- [ ] Keep packing prerequisites and artifact production unconditional.
- [ ] Prove ordering, isolation, artifact availability and consumer controls.
- [ ] Update current CI documentation and reconcile related proposals.
- [ ] Regenerate workflows and run scoped checks and a clean consumer check.
