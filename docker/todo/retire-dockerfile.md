## retire-dockerfile. Decide whether the Dockerfile still earns its place

**Priority:** P4
**Status:** open

### Problem

[`docker/Dockerfile`](../Dockerfile) predates the Nix development shell. Both
now set up the same thing — a contributor environment with the pinned toolchain
— and [CONTRIBUTING.md](../../CONTRIBUTING.md) offers them side by side, so a
contributor has two ways to get an environment and no statement of which is
current.

They are not maintained alike. The Nix flakes under `nix/` are **generated**
from the pinned Nixpkgs commit in `fjs/ci/config/module.f.mjs` and a drift check
in CI fails when the tree disagrees
([66B](../../fjs/ci/todo/66b-dockerfile-nix-integration.md)); every canonical CI
job runs on the runtime that snapshot provides. The Dockerfile is hand-written,
pins its versions separately, and nothing verifies it — so it can silently
describe a toolchain the project no longer uses, which is the failure mode a
second environment definition always has.

### Proposal

Retire it, unless something it does has no Nix equivalent.

Deleting is not just removing the file. `CONTRIBUTING.md:64` points at it, so
that paragraph goes with it, leaving the Nix shell as the one documented
environment. The `docker/README.md` goes too.

The counter-case worth checking before deleting: Docker is available on machines
where Nix is not, so the Dockerfile may be the only entry point for a
contributor on such a machine. If that turns out to be real, the answer is not
to keep it hand-written — it is to generate it from the same pinned config that
produces the flakes, so one snapshot stays the single source of truth and the
same drift check covers both.

### Tasks

- [ ] Establish whether any contributor path needs Docker and has no Nix
      equivalent.
- [ ] If not: delete `docker/`, drop the `CONTRIBUTING.md` paragraph that offers
      it, and note the removal in the changelog if the published contract changes.
- [ ] If so: generate the Dockerfile from `fjs/ci/config/module.f.mjs` and put it
      under the existing drift check rather than leaving it hand-maintained.

### Related

- [66B-dockerfile-nix-integration](../../fjs/ci/todo/66b-dockerfile-nix-integration.md)
  — generates the Nix flakes from the pinned snapshot and runs the drift check
  this issue would extend or make unnecessary.
- [65Z-ci-scenario-docker](../../fjs/ci/todo/65z-ci-scenario-docker.md) — "do not
  introduce a Dockerfile unless the reviewed design requires one", the same
  preference applied to CI scenarios.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — offers both environments today.
