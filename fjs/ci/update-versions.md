# Updating the pinned versions

The prompt of the daily version-update routine; a pin moved by hand follows it
too.

---

Check whether the versions pinned in `fjs/ci/config/module.f.js` are current,
and update any that aren't. The comments there say where each comes from;
Nix-provided tools follow the pinned Nixpkgs commit, not upstream.

Start from the latest `main`.

Setup: `apt-get install nix-bin`, and pass
`--extra-experimental-features 'nix-command flakes'` to every `nix` command.
Run everything else as `./dev.sh <command>`. GitHub's tarball API is blocked
here, so before the first `./dev.sh`, fetch the pinned Nixpkgs with
`nix flake prefetch "git+https://github.com/NixOS/nixpkgs?rev=<commit>&shallow=1"`.

**Pin only a Nixpkgs commit that `cache.nixos.org` fully covers.** Otherwise
the macOS jobs compile Node.js from source and time out, and pull requests
don't run macOS. To check commit `C`: prefetch it as above, then for every
`gen.nix` flake and every system it declares, run
`nix build --dry-run --no-write-lock-file --override-input nixpkgs "git+https://github.com/NixOS/nixpkgs?rev=C&shallow=1" <flake>#devShells.<system>.default`.
Only our own derivations may be listed to build: `rust*`, `cargo*`, `clippy*`,
`bun*` and `nix-shell`. Anything else, `nodejs*` above all, means `C` fails.

Candidates are the releases of `nixos-26.05` and `nixpkgs-26.05-darwin`
(`https://nix-releases.s3.amazonaws.com/?delimiter=/&prefix=nixos/26.05/`,
`...&prefix=nixpkgs/26.05-darwin/`). Take the newest that passes. If none newer
than the current pin passes, keep the pin, unless the pin itself fails; then go
back to the newest commit that passes, even if a version goes down.

If anything changed:

1. Update the file and run `./dev.sh npm run gen`. Its last step,
   `./gen.nix/lock-update.sh`, fails here and deletes the `flake.lock` files;
   restore them with `git restore $(git ls-files 'gen.nix/*flake.lock')`.
2. If Nixpkgs moved, write its new lock entries by hand, taking `narHash` and
   `lastModified` from `locked` in
   `nix flake metadata --json "git+https://github.com/NixOS/nixpkgs?rev=C&shallow=1"`. Then run
   `sh ./gen.nix/lock-update.sh`, which now succeeds and locks `rust-overlay`.
3. Repeat the dry run on the committed flakes, without `--override-input`.
4. `./dev.sh npm ci` (or `npm install`, `deno install` and `bun install` if
   `package.json` changed), then run the AGENTS.md check set, all through
   `./dev.sh`.
5. Commit and push. In the PR description, list each commit checked and what it
   would build per system.

If nothing changed, don't commit.
