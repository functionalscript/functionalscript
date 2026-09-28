## Available bump: nixpkgs snapshot, Node 26/22, rust-overlay — blocked on a Nix-capable environment

**Priority:** P3
**Status:** open

As of 2026-09-28, newer values are available for several pins in
`fjs/ci/config/module.f.mjs`:

- `nixpkgs.commit`: `6d663c0533ff269008fb84e45930151e37c99db9` ->
  `cf5e76507c6e23b59f7e0ffcc7baa2a39ddd8442` (latest `nixos-26.05` channel
  commit, per https://channels.nixos.org/nixos-26.05/git-revision).
- `node.default`: `26.8.2` -> `26.10.0` (from that snapshot's
  `pkgs/development/web/nodejs/v26.nix`).
- `node.node22`: `22.23.2` -> `22.23.3` (from that snapshot's
  `pkgs/development/web/nodejs/v22.nix`; `node24` stays `24.21.0`, unchanged
  at the new commit).
- `rustOverlay.commit`: `2776e42828203ec89511699c8dcdedec69ab98e1` ->
  `3f4df219c0d9aa82710232324856755d51ef0b69` (latest `master` commit of
  https://github.com/oxalica/rust-overlay as of this check).

Everything else this file pins (runner images, Bun, Deno, TypeScript-go,
Rust, Wasmtime, Wasmer versus what the snapshot itself provides, and the
GitHub Action versions) was already current against the same snapshot and
against upstream at the time of this check.

**Why this wasn't applied:** per this file's own comment, moving `nixpkgs` or
`rustOverlay`'s `commit` needs `npm run lock-update` (real Nix) to refresh the
matching `flake.lock` (`nix/flake.lock`, `nix/node22/flake.lock`,
`nix/node24/flake.lock`) afterward, or every Nix job fails loudly on the
mismatch. The sandbox this check ran in has no working Nix installation, and
outbound access to `nixos.org` / `install.determinate.systems` (needed to
install one) is blocked by the environment's egress policy, so
`nix flake lock` could not be run. Committing the commit/version bump alone,
without a matching lock refresh, would be a regression (CI red) with no way
to fix it from here, so it was left unapplied.

**To finish this:** from an environment with real Nix, bump the four values
above in `fjs/ci/config/module.f.mjs`, run `npm run gen` (regenerates
`.github/workflows/*.yml` and the `flake.nix` files), then `npm run
lock-update` (regenerates the three `flake.lock` files, plus `npm install`,
`deno install`, `bun install`, `cargo update`), and run the full check set in
[AGENTS.md](../../../AGENTS.md#2-environment-and-running-tests) before
opening the PR. Re-check all the other pins too, since more time will have
passed.
