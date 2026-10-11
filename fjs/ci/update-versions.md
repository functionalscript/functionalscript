# Updating the pinned versions

The prompt of the daily version-update routine; a pin moved by hand follows it
too.

---

Check whether the versions pinned in `fjs/ci/config/module.f.js` are current,
and update any that aren't. The comments there say where each comes from;
Nix-provided tools follow the pinned Nixpkgs commit, not upstream.

During prerelease, each FunctionalScript release accepts one exact version of
Node, Deno, Bun, Rust, TypeScript/TSGO, Wasmtime and Wasmer. Choose recent stable
versions the project can build and test reliably; an accepted update replaces
the old pin for the next release. Keep the accepted pin, or restore it, when a
candidate fails. Preserve older release configurations, locks and tested
toolset records so a user needing an older tool can choose a release that
actually tested it. Additional supported versions after release remain a
decision for actual demand and the testing it needs.

Start from the latest `main`.

Use the repository's configured Nix environment and run checks as
`./dev.sh <command>`. For direct Nix commands on a stock install, pass
`--extra-experimental-features 'nix-command flakes'`. An earlier update
environment blocked GitHub's tarball API; where that restriction applies,
prefetch the pinned input before the first `./dev.sh` with
`nix flake prefetch "git+https://github.com/NixOS/nixpkgs?rev=<commit>&shallow=1"`.
Use the configured network route to run real Nix lock generation; availability
of the GitHub API depends on the environment.

**Pin only a Nixpkgs commit that `cache.nixos.org` fully covers.** Otherwise
the macOS jobs compile Node.js from source and time out. To check commit `C`:
prefetch it as above, then for every
system the shared `gen.nix/flake.nix` declares, run
`nix build --dry-run --no-write-lock-file --override-input nixpkgs "git+https://github.com/NixOS/nixpkgs?rev=C&shallow=1" ./gen.nix#devShells.<system>.default`.
Only our own derivations may be listed to build: `rust*`, `cargo*`, `clippy*`,
`bun*` and `nix-shell`. Anything else, `nodejs*` above all, means `C` fails.

Candidates are the releases of `nixos-26.05` and `nixpkgs-26.05-darwin`
(`https://nix-releases.s3.amazonaws.com/?delimiter=/&prefix=nixos/26.05/`,
`...&prefix=nixpkgs/26.05-darwin/`). Take the newest that passes. If none newer
than the current pin passes, keep the pin, unless the pin itself fails; then go
back to the newest commit that passes, even if a version goes down.

If anything changed:

1. Update the file. `node` is one exact patch pin; when it moves, synchronize
   `package.json`'s `engines.node`, the root metadata in `package-lock.json`
   and `.node-version` to that exact version. Ranges or a major alone advertise
   untested versions. `@types/node` is a separately pinned type package.
   Run `./dev.sh npm run gen` directly, without standalone `gen:clean`.
   If this environment's tarball API restriction makes the final
   `./gen.nix/lock-update.sh` fail after deleting the shared `flake.lock`,
   restore `gen.nix/flake.lock` before entering the shell again. This is
   recovery from incomplete generation, not permission to commit a missing lock.
2. If generation failed, resolve the input/network failure in the configured
   environment and rerun `./dev.sh npm run gen`, or run the generated
   `sh ./gen.nix/lock-update.sh` after the source outputs are complete.
   Real Nix must generate the lock for Nixpkgs and `rust-overlay`; do not
   synthesize lock metadata or edit the generated lock by hand.
3. Repeat the dry run on the shared flake for every declared system, without
   `--override-input`. Confirm Node metadata and all generated CI, publishing,
   website and clean-consumer selections match the accepted pins.
4. `./dev.sh npm ci` (or `npm install`, `deno install` and `bun install` if
   `package.json` changed), then run the AGENTS.md check set, all through
   `./dev.sh`, including selected-runtime coverage and clean Node, Deno and Bun
   packed-consumer checks. Record the observed versions used by those checks;
   the release procedure verifies its tested toolset record against them.
5. Commit and push. In the PR description, list each commit checked and what it
   would build per system.

If nothing changed, don't commit.
