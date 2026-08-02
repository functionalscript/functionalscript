## 65Z-ci-scenario-docker. Package a Nix CI environment as an OCI image

**Priority:** P3
**Status:** wip

### Progress

The design below was written against one proven direct-Nix job — `playwright`,
migrated in [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — and is now
**implemented for that job**. `fjs/ci/nix/module.f.ts` generates
`packages.<system>.oci` next to the job's development shell, and the job builds
that image, loads it into the runner's Docker daemon, and runs its whole command
sequence in a container instead of `nix develop`.

What is not done is the part that would make the image pay for itself: it is
built by the job that uses it, so every run still pays for building and loading
it. Publishing the image, and measuring both paths, are the open tasks below.

### Problem

We did not know whether packaging a Nix CI environment as an OCI image improves
total CI behavior. Selecting a builder, image layout, runtime model, identity,
caching, or publication workflow before a direct-Nix job worked would have turned
an optimization experiment into speculative implementation — so the first
direct-Nix milestone stayed independent of OCI work.

Direct Nix remains the reference behavior and the fallback: the flake keeps its
development shell, and moving a job back to `nix develop` is a one-line change in
its CI module.

### Design

Decided for the `playwright` job, and generated from its existing declaration.

**Builder.** `pkgs.dockerTools.streamLayeredImage` from the pinned Nixpkgs
snapshot. No Dockerfile and no external builder: the image is another output of
the flake the job already has, so it cannot drift from the shell. `stream…`
rather than `build…` writes the archive to standard output instead of storing a
second copy of every layer.

**Contents.** The job's `packages` and environment variables, unchanged, plus
what a shell inherits from the runner and a container has to carry itself: an
interactive shell, the core utilities, `/bin/sh` and `/usr/bin/env`, the
certificate bundle, `/etc/passwd` and `/etc/group`, a writable `/tmp`, and `PATH`
and `HOME`. Everything else follows from the closure — the browsers reach the
image because `Env` interpolates `pkgs.playwright-driver.browsers` and
`streamLayeredImage` treats the image configuration as a closure root.

**Execution model.** No entry point of its own. The image's `Cmd` is a shell for
someone opening it by hand; CI passes the job's command sequence as one
`bash -euo pipefail -c '…'` argument, exactly as the `nix develop` invocation
did, with the checkout bind-mounted at the image's `WorkingDir`.

**Identity.** `name:<nixpkgs-commit>`. The pinned snapshot and this repository's
generated flake together determine the image, and the job builds it rather than
resolving a tag, so a mutable-tag race cannot happen. A published image needs a
stronger identity — see the open tasks.

**Architecture.** `aarch64-linux`, the job's runner. One system per job, like the
flake's development shell.

**Credentials.** None. Nothing is pushed, so no package-write credential is ever
exposed to pull-request code.

### Remaining work

- **Measure both paths.** The job's `nix develop` runs took roughly three
  minutes, nearly all of it the browser runs themselves. Record the image build,
  `docker load`, and total time now, and compare: building an image in the job
  that consumes it is strictly more work than entering a shell, and it is only
  worth keeping if the difference is small enough to be paid back by publishing.
- **Decide on publication.** Pushing to a registry is what turns the build into a
  pull, but it needs an immutable identity (content-addressed tag or digest), a
  workflow with package-write permission that pull-request code cannot reach, and
  a rule for how a job pins the image it uses. A first pull request cannot
  validate an image that only exists after it merges, so the pinning rule has to
  answer that too. Design it only if the measurements say a pull would win.
- **Decide whether other jobs get images.** The Node jobs have no browser bundle
  and little to gain; do not generalize until one of them asks for it.

### Tasks

- [x] Complete Phase 1 through Phase 3 of
      [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) for one
      selected Linux job.
- [x] Write the job-specific OCI design covering every item in the design
      deliverable.
- [x] Generate the image from the job's existing Nix declaration.
- [x] Run the job's complete command sequence in a container of that image.
- [ ] Record build, load, and total wall-clock time, and compare with the
      `nix develop` runs of the same job.
- [ ] Decide whether to publish the image, and design the identity, permission
      boundary, and pinning rule if so.
- [ ] Keep direct Nix as the documented fallback when a job moves to an image.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — declarative per-job Nix architecture.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — the job this image was
  designed for and is used by.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — direct
  Nix implementation and prerequisite.
- [i096](96.md) — CI caching.
