## 96. CI shell from a binary cache

**Priority:** P2
**Status:** open

### Problem

Every Nix job starts from an empty store, and its first step realises its
whole shell: the shared one through `sh ./gen.nix/run` (`../nix/module.f.mjs`),
or, for `node22` and `node24`, their own flakes. That is only fast while every
package in it is substituted from `cache.nixos.org`. Nothing
checks that it is, and nothing in the log says when it is not.

**What the shell costs when it is cached.** Over eight merge-queue runs from
`1c59449f` to `2e1540e4`, all on Node 26.10.0 and Nixpkgs `b2530993`, the
first shell step (`node --version`) took:

| job           | min   | median | max   |
| ------------- | ----- | ------ | ----- |
| `ubuntu-arm`  | 23 s  | 26 s   | 39 s  |
| `macos-arm`   | 54 s  | 72 s   | 86 s  |
| `macos-intel` | 92 s  | 136 s  | 221 s |

The jobs it belonged to took between about 4 and 14 minutes.

**What it costs when it is not.** `bb2648dbb`
([#2684](https://github.com/functionalscript/functionalscript/pull/2684))
moved Nixpkgs to `7c8764b7` for Node 26.11.0. At that commit
`cache.nixos.org` holds `nodejs-slim-26.11.0` for `x86_64-linux` and
`aarch64-linux` and for neither Darwin system. A dry run of the macOS shells
there lists it among the derivations to build:

```sh
nix build --dry-run ./gen.nix#devShells.aarch64-darwin.default
```

So every macOS job compiles Node.js from source. In merge-queue run
[37860827110](https://github.com/functionalscript/functionalscript/actions/runs/37860827110)
both macOS jobs printed the `rust-overlay` fetch, then nothing for about
fourteen minutes, until the job timeout cancelled them. The Linux jobs of
the same run entered the same shell in about 25 seconds. Raising the timeout
does not fix this: it only lets the compile run longer.

Three things let this through:

- **The pin follows a Linux channel.** `nixpkgs.ref` in
  `../config/module.f.js` is `nixos-26.05`, which advances when the NixOS
  tests pass. Those tests are Linux only. Hydra evaluates the Darwin jobset
  (`nixpkgs-26.05-darwin`) less often and skips commits. It has built
  `nodejs-slim-26.11.1` for both Darwin systems, and it never built
  26.11.0 at `7c8764b7`.
- **`--quiet` hides the miss.** `runText` in `../nix/module.f.mjs` takes
  this cost knowingly: "a cache miss looks like a cache hit: Nix compiles
  from source in silence". It calls that cost bounded because only the first
  step substitutes. A Node.js compile is bounded only by the job timeout.
- **Pull requests did not run macOS.** The macOS and Windows jobs ran only
  in the merge queue (`Setup.mergeQueueOnly`), so a pin that broke them
  passed review and failed only once queued.
  [#2705](https://github.com/functionalscript/functionalscript/pull/2705)
  runs them on pull requests again.

**Our own cache is harder than it looks.** CI runs on `pull_request` and
`merge_group` only. A GitHub Actions cache entry is readable from the ref
that saved it and from the default branch. Each merge-queue entry gets its own
`gh-readonly-queue/...` ref, and nothing runs on `main`, so an
`actions/cache` of the store would never hit for the macOS jobs. It would
also hit only after one run had built Node.js, and that run cannot finish
within the job timeout.

### Proposal

In order. Each step is its own pull request.

1. **Pin a commit the binary cache covers on all four systems.** Done in
   [#2702](https://github.com/functionalscript/functionalscript/pull/2702),
   which moved back to `b2530993` (Node 26.10.0) after a dry run per system
   left only our own derivations to build: the shell, the `rust-overlay`
   components and the pinned `bun`. The procedure for later pins is
   [#2703](https://github.com/functionalscript/functionalscript/pull/2703).
2. **Check coverage whenever the pin moves.** `lock-update` is the one
   command that runs on every pin change, and it already runs real Nix. A
   per-system `nix path-info --recursive --store https://cache.nixos.org`
   over the Nixpkgs packages of every generated flake, the `node22` and
   `node24` ones included, which covers their whole closure,
   fails on the miss itself, and needs no text
   matching. This adds an external command, so it needs approval before it is
   written.
3. **Make a miss visible in CI.** Drop `--quiet` from each job's first shell
   step, the one that substitutes, so that a build names itself as
   `building '…nodejs-slim…'`. The later steps keep it.
4. **Our own binary cache, only if the measurements above still justify
   one** once steps 1 to 3 have landed. The cached shell costs Linux about 26
   seconds and macOS about one to two minutes, and a cache would only reduce
   that part. The options, each needing approval as a new external action
   or service:
   - **A store cache in GitHub Actions** (for example
     `nix-community/cache-nix-action`). Needs no external service and no
     secret. Needs a run on `main`, on `push` or a `schedule`, to save
     entries the queue can read. At `b2530993` each Darwin closure was about
     2 GiB unpacked, against the repository's cache quota.
   - **A hosted binary cache** (for example Cachix, which is free for open
     source). Every ref reads it. Pushing to it needs a secret, which
     `merge_group` runs have and fork pull requests do not. It also covers a
     package Hydra has not built yet, after one run has built it, if that
     run finishes.

   Either one is best filled by a **prebuild workflow** of its own, not by
   the test jobs. It builds `devShells.<system>.default` on one runner per
   system and pushes the closure to the cache. It runs when the pin moves and
   can be started by hand (`workflow_dispatch`), and it carries its own long
   timeout, so a source build there is slow rather than fatal. The test jobs
   then only read. This separates the two jobs that are mixed today: making
   the shell, which is rare and may be slow, and testing in it, which is
   frequent and must be fast.

   A workflow in this repository is enough; a separate repository or branch
   adds a second place to maintain and buys nothing more. Two limits remain.
   With the Actions cache it has to run on `main`, so the pull request that
   moves the pin goes through the queue cold. With a hosted cache it can run
   on that pull request's branch before the pull request is queued. And a
   source build of Node.js for macOS costs macOS runner time on every pin
   move, which is why step 1 comes first: a pin Hydra has already built
   needs no build of ours.

### Tasks

- [x] Move the Nixpkgs pin to a commit with Darwin binaries for the whole
      shell ([#2702](https://github.com/functionalscript/functionalscript/pull/2702)).
- [ ] Propose the `lock-update` coverage check and get it approved.
- [ ] Drop `--quiet` from the first shell step of each Nix job.
- [ ] Measure again. Decide whether an own binary cache, filled by a
      prebuild workflow, still earns its place, and which cache it uses.

### Related

- [65z-ci-nix](./65z-ci-nix.md): the shared shell this caches, and where
  the cost of per-job download was first noted.
- `jobTimeout` in [`../config/module.f.js`](../config/module.f.js): the
  limit a source build runs into.
