# Updating the pinned versions

The procedure the daily version-update routine follows, written as its prompt.
A maintainer moving a pin by hand follows the same rules
([CONTRIBUTING.md](../../CONTRIBUTING.md#updating-dependencies)).

---

Check whether the versions pinned in `fjs/ci/config/module.f.js` are current,
and update any that aren't. The comments in that file say where each version
comes from; Nix-provided tools follow the pinned Nixpkgs snapshot, not
upstream.

Start from the latest `main`: fetch it on its own, before anything else.

The container has no Nix, so install it yourself: `apt-get install nix-bin`,
run in single-user mode (`NIX_REMOTE=local`). Everything else comes from the
repository's shell, at the versions CI uses: run every later command that is
not itself `nix` as `./dev.sh <command>` (`./dev.sh tsc`, `./dev.sh npm run gen`
and so on), and install nothing else by hand
([AGENTS.md §2](../../AGENTS.md#2-environment-and-running-tests)). The shell's
`github:` Nixpkgs input can't be downloaded here, so first put the pinned
commit's tree in the store as step 1 of *To check a commit* below does; Nix then
finds it by the `narHash` in `gen.nix/flake.lock` and downloads nothing from
GitHub.

**Every Nix shell must come from the binary cache.** A Nixpkgs commit is usable
only if `cache.nixos.org` holds every Nixpkgs package of every generated shell,
on every system that shell declares: all four systems for `gen.nix`, and those
of `gen.nix/node22` and `gen.nix/node24`. The `nixos-26.05` channel advances on
Linux tests alone, and Hydra skips commits for Darwin, so the channel head is
often not usable. A miss makes the macOS jobs compile Node.js from source until
they time out, and pull requests don't run macOS, so CI won't show it before the
merge queue. Never pin a commit you haven't checked. An older version that is
cached beats a newer one that isn't, even if that means a version goes down.

To check a commit `C`:

1. Put its tree in the Nix store without GitHub's tarball API:
   `nix flake prefetch --json "git+https://github.com/NixOS/nixpkgs?rev=C&shallow=1"`.
   The `narHash` and store path it reports are the ones the
   `github:NixOS/nixpkgs/C` input resolves to, and `lastModified` is the
   commit time.
2. For each generated flake and each system it declares, run
   `nix build --dry-run --no-write-lock-file --override-input nixpkgs "git+https://github.com/NixOS/nixpkgs?rev=C&shallow=1" <flake>#devShells.<system>.default`,
   and read the list of derivations it says will be built. Only our own may
   appear: the `rust-overlay` toolchain (`rust-*`, `rustc-*`, `cargo-*`,
   `clippy-*`, `rustfmt-*`), the pinned Bun (`bun-*`), and `nix-shell` itself.
   Anything else, `nodejs-*` above all, is a miss, and `C` is unusable.
3. If every commit you check, the current pin included, has Nixpkgs packages to
   build, suspect the cache, not the commits: check
   `curl -sS https://cache.nixos.org/nix-cache-info` before concluding
   anything.

To choose the commit:

- The candidates are the releases of `nixos-26.05` and of
  `nixpkgs-26.05-darwin`. List them with
  `https://nix-releases.s3.amazonaws.com/?delimiter=/&prefix=nixos/26.05/` and
  `...&prefix=nixpkgs/26.05-darwin/`. Each release name ends in a release
  number and the 12-digit short commit;
  `https://releases.nixos.org/<release>/git-revision` gives the full one.
- In each channel, check releases newest first (highest release number),
  stopping at the first usable one or at the current pin. Of the two channels'
  winners, take the one with the later `lastModified`. Linux and Darwin
  binaries for a commit often arrive hours apart, so the newest releases
  failing is normal.
- Check the current pin too. If it is not usable, the pin must move even when no
  newer commit is: walk further back (the previous pins are in
  `git log -p fjs/ci/config/module.f.js`) to the newest usable one.
- If nothing newer is usable and the current pin is, leave the pin alone.

If anything changed:

1. Update the file and run `./dev.sh npm run gen`. Read each Nix-provided
   version from the chosen commit (`nix eval`), not from upstream. Generation
   writes every generated file, deleting the `flake.lock` files with the rest
   of `gen.nix/`, and its last step runs `gen.nix/lock-update.sh`, whose
   `nix flake lock` can't download from GitHub here. Expect exactly that step
   to fail, as `./gen.nix/lock-update.sh: exit code 1`; any other failure is
   real. Then put the lock files back with
   `git restore $(git ls-files 'gen.nix/*flake.lock')`.
2. If a Nix input commit changed, refresh the `flake.lock` files by hand, since
   `lock-update.sh` couldn't: `git` can fetch from GitHub where `nix flake lock`
   can't, so take `narHash` and `lastModified` from the prefetch above. First
   confirm this reproduces the current lock entries, then write the new ones.
3. Run the dry run again on the generated flakes as committed, with no
   override, for every system. This also checks the lock: a wrong `narHash`
   makes Nix try GitHub and fail.
4. If `package.json` changed, run `./dev.sh npm install`,
   `./dev.sh deno install` and `./dev.sh bun install`.
5. Run `./dev.sh tsc` and `./dev.sh node --test`, then commit, push, and fix
   any CI failures. Put
   the coverage check in the PR description: each commit checked, and for each
   system whether it passed or what it would build. The PR's own CI doesn't run
   macOS, so this is the only evidence before the merge queue.

If nothing changed, don't commit.
