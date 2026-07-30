## 65Z-ci-nix-locks. Generate and commit Nix input lock files

**Priority:** P5
**Status:** blocked
**Phase:** 6
**Blocked by:** [Phase 2 — generated `flake.nix` files](65z-ci-nix.md)
**Does not block:** direct Nix CI, Linux OCI images, macOS cache research, or Phase 7 hardening

### Goal

Generate and commit `flake.lock` files for the generated Nix environments so
`nixpkgs` and other flake inputs resolve to precise revisions and transitive
input graphs.

This task locks Nix inputs. It does not select the versions of Node, Deno, Bun,
Rust, Wasmtime, Wasmer, Playwright, or other CI tools. Those versions remain
owned by `fjs/ci/config/module.f.ts` and are installed from upstream by the
generated `flake.nix` files.

It also does not provide fixed hashes for upstream tool binaries. Artifact
hashes belong to [Phase 7](65z-ci-nix-hardening.md).

### Dependency

```text
Phase 2: committed generated flake.nix files
        |
        v
Phase 6: generate and commit flake.lock files [this task]
```

Phase 6 may be implemented at any point after Phase 2, but it is lower priority
than getting the generated environments into CI and measuring their performance.

### Separate update command

Ordinary generation must remain unchanged and continue to work on native
Windows:

```sh
npm run update
npm run ci-update
```

Add a separate command, for example:

```sh
npm run ci-nix-lock-update
```

The lock-update command may require Nix and network access. It is supported on:

- Linux;
- macOS;
- Windows through WSL or another Nix-capable environment.

It is not required to run on native Windows.

The command should:

1. run ordinary generation so the current `flake.nix` files exist;
2. run the appropriate Nix lock command for every generated flake;
3. update or create the corresponding `flake.lock` files;
4. expose all generated lock changes for review;
5. fail if any generated flake cannot resolve its declared inputs.

### Generated-file ownership

Generated `flake.lock` files are committed build artifacts. They are not
maintained manually.

The ordinary regeneration check should include them after this phase is
implemented:

```sh
git add -A
git diff --cached --exit-code
```

Ordinary `npm run ci-update` may preserve or render committed lock data, but it
must not invoke Nix or contact the network on native Windows.

### Tasks

- [ ] Add a documented Nix-capable-host `ci-nix-lock-update` command.
- [ ] Discover every generated flake directory.
- [ ] Generate or update `flake.lock` for each generated flake.
- [ ] Commit generated lock files.
- [ ] Ensure ordinary native-Windows generation does not invoke Nix or refresh
      locks.
- [ ] Make CI fail when committed lock files drift unexpectedly.
- [ ] Prevent normal builds from silently rewriting committed locks after this
      phase is adopted.
- [ ] Document how intentionally changing `nixpkgs` or another flake input
      updates all affected locks.

### Completion criteria

- Every generated flake has a committed `flake.lock`.
- A separate Nix-capable command updates those files deliberately.
- Ordinary generation remains Nix-independent and works on native Windows.
- CI detects unintended lock-file changes.

### Out of scope

- exact CI tool version selection;
- fixed hashes for upstream tool and browser artifacts;
- comprehensive version, target, and runtime validation;
- blocking Phases 3, 4, or 5 on lock-file completion.

### Related

- [Phase 2 — generate Nix environments](65z-ci-nix.md).
- [Phase 7 — validation and fixed artifact hashes](65z-ci-nix-hardening.md).
- [66B rollout overview](66b-dockerfile-nix-integration.md).
