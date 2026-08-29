## bun-nix-blocked-on-nixpkgs. Migrate the `bun` job to a generated flake

**Priority:** P3
**Status:** blocked — Nixpkgs has no Bun this repository's proofs pass on

### Problem

Every canonical **runtime** job but this one runs through a generated Nix flake.
`bun` still installs its runtime with `oven-sh/setup-bun`, so
`fjs/ci/config/module.f.mjs`'s `bun` is a released version rather than a packaged
one and `nixJobs` in `../module.f.mjs` has no entry for it. Two other jobs have no
flake either — `wasm`, blocked on a different Nixpkgs gap, and `package-check`,
which has no checkout to hold a flake — and
[65Z-ci-nix](65z-ci-nix.md) keeps that whole picture.

The migration itself is written and works: a `bunNixJob` declaring
`packages: ['bun']` on `aarch64-linux`, `nixInstall`, a
`test "$(nix develop … --command bun --version)" = <version>` check, and the
job's commands one `nix develop` step each. It was reverted for one reason: the
Bun that Nixpkgs provides fails this repository's suite.

### What the attempt found

Bun **1.3.13** is what the pinned snapshot
(`062346a6d85bc4b49dfaa61c986e9c5be21217d1`) offers. It is also what Nixpkgs
`master` offers, so this is not a matter of moving the pin forward — 1.4.0 is
not packaged anywhere yet. On 1.3.13, `bun test --coverage` fails two proofs
that pass on the 1.4.0 `setup-bun` installs:

- **`fjs/emergent_testing/browser/proof.mjs` `customSpeciesThatFailsIsReported`**
  fails in 1ms with `error: species` escaping from the `Symbol.species` getter
  at `proof.mjs:283`. The proof asserts that a throwing species getter is
  *reported* rather than swallowed; on 1.3.13 the throw leaves the proof
  entirely and reaches Bun's own runner. That is a real difference in when
  JavaScriptCore reads `Symbol.species` while resolving a promise, not a slow
  machine, and it is the blocker: no timeout or configuration change addresses
  it.
- **`fjs/djs/parser/proof.f.mjs` `containerStackCost[1]`** times out at 5228ms
  against Bun's default 5000ms. This one is marginal rather than semantic —
  `containerStackCost[0]` passes at 4979ms, 20ms inside the limit, so these four
  proofs sit on the edge under *any* Bun and 1.3.13 is merely slower than 1.4.0.

### What has to happen first

Any one of these unblocks it; the first is the cheap one:

- **Nixpkgs packages a Bun the suite passes on.** Watch
  `pkgs/by-name/bu/bun/package.nix`. Confirm by running the suite, not by
  reading a version number — 1.4.0 is the version known to pass, but the failing
  proof is about engine behavior, so a later 1.3.x could equally fix it.
- **The species difference turns out to be a Bun bug that is fixed**, or the
  proof turns out to be asserting something Bun is not obliged to do. Read
  `customSpeciesThatFailsIsReported` and decide which; if the proof is wrong,
  that is a change to `fjs/emergent_testing`, not to CI, and it lands
  separately. Do **not** relax the proof merely to let this job move to Nix.
- **`containerStackCost` gains headroom.** Independent of the above and worth
  doing on its own: a proof passing 20ms inside a 5s limit will eventually fail
  for reasons nobody caused. Either the four cases get smaller inputs that still
  exercise the stack path, or the job raises Bun's timeout deliberately, with
  the reason recorded. This does not unblock the migration by itself.

### Tasks

- [ ] Re-check the Nixpkgs Bun version, and run the suite on it rather than
      trusting the number
- [ ] Decide whether `customSpeciesThatFailsIsReported` is asserting Bun's
      obligation or this repository's preference
- [ ] Give `containerStackCost` headroom, separately from this issue
- [ ] Declare `bunNixJob`, add it to `nixJobs`, and replace `setup-bun` with
      `nixInstall` plus a version check, as `deno` did
- [ ] Move `bun` in `fjs/ci/config/module.f.mjs` to the snapshot's version, with
      the comment the `deno` pin has
- [ ] Drop `oven-sh/setup-bun` from the action table once nothing uses it

### Related

- [65Z-ci-nix](65z-ci-nix.md) — the flake generation this job is a holdout
  from, and where every job's Nix status is recorded
- [wasm-nix-blocked-on-rust-targets](wasm-nix-blocked-on-rust-targets.md) — the
  other canonical job Nixpkgs cannot serve yet
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — the Node
  milestone that set the shape every migrated job follows
- [built-package-checks](built-package-checks.md) — why the `bun` job no longer
  installs a published `functionalscript`, and where that check is going
