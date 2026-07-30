## dockerfile-nix-integration. Dependency-driven Nix CI and OCI rollout

**Priority:** P3
**Status:** open

### Goal

Move Linux and macOS CI to generated Nix environments, use OCI images where
they improve Linux performance, investigate caching for macOS, and add stronger
reproducibility only after the basic infrastructure is useful.

The plan is intentionally iterative:

```text
working generated environment
        before
comprehensive validation and content locking
```

Exact CI tool versions remain owned by `fjs/ci/config/module.f.ts`. Generated
Nix files install those upstream versions. `nixpkgs` supplies supporting build
tools and libraries, not the versions under test.

### Seven phases

```text
Phase 1: define exact versions in ci/config/module.f.ts [done]
Phase 2: generate and commit target-specific flake.nix files
Phase 3: run Linux and macOS CI through generated Nix environments
Phase 4: build OCI images and use them for selected Linux jobs
Phase 5: investigate GitHub caching for macOS Nix environments
Phase 6: generate and commit flake.lock files
Phase 7: add comprehensive validation and fixed artifact hashes
```

Phase numbers describe the roadmap, but they are not one strict linear gate.

### Dependency graph

```text
Phase 1: exact versions [done]
        |
        v
Phase 2: generated flake.nix files
        |
        +----------------------+----------------------+
        |                      |                      |
        v                      v                      v
Phase 3: direct Nix CI   Phase 6: flake.lock   Phase 7: validation
        |                 [low priority]        and fixed hashes
        |                                      [low priority]
        +----------------------+
        |                      |
        v                      v
Phase 4: Linux OCI       Phase 5: macOS cache
```

The critical path is only:

```text
Phase 1 -> Phase 2 -> Phase 3
```

As soon as generated `flake.nix` files are committed, Linux and macOS CI may use
them. Phase 3 does not wait for `flake.lock`, fixed hashes, or a separate
validation suite.

### Phase 1: exact versions

**Status:** done

`fjs/ci/config/module.f.ts` contains the exact versions used by the CI generator.
It is the maintained version authority for Node, Deno, Bun, Rust, Wasmtime,
Wasmer, Playwright, and other version-pinned tools.

Changing a version should remain a simple maintained-config change followed by
ordinary generation.

### Phase 2: generate Nix environments

**Task:** [ci-nix](ci-nix.md)

Generate committed target-specific `flake.nix` files from the CI configuration.
Use exact upstream binaries, sources, or installers for tested tools. Use
`nixpkgs` only for build tools, shells, runtime libraries, linkers, archive
utilities, and similar infrastructure.

The first implementation may use version-addressed downloads while preparing or
entering the environment. It does not require fixed artifact hashes,
comprehensive validation, or generated `flake.lock` files.

Ordinary `npm run update` and `npm run ci-update` must remain runnable on native
Windows without Nix.

### Phase 3: direct Linux and macOS Nix CI

**Task:** [ci-nix-ci](ci-nix-ci.md)
**Depends on:** Phase 2 only

Install Nix on Linux and macOS runners and execute each job's existing command
inside its committed generated environment.

The actual CI workload is the first operational test. Do not require a separate
validation phase before switching the jobs.

Windows remains on its native generated setup path.

### Phase 4: Linux OCI images

**Task:** [ci-scenario-docker](ci-scenario-docker.md)
**Depends on:** Phase 3

Build Linux OCI images from the same generated environment definitions and use
them for selected Linux jobs when pull and startup performance is better than
direct Nix preparation.

The first image iteration does not wait for Phase 6 or Phase 7. Later locks,
hashes, and validation can strengthen the same image path without redesigning
its version authority.

### Phase 5: macOS cache investigation

**Task:** [ci-nix-cache-macos](ci-nix-cache-macos.md)
**Depends on:** Phase 3

Investigate GitHub Actions cache or another Nix cache for macOS environment
reuse. Measure cold and warm preparation, cache restore/upload costs, eviction,
and Intel/ARM sharing.

This phase is independent of Linux OCI work.

### Phase 6: Nix input locks

**Task:** [ci-nix-locks](ci-nix-locks.md)
**Depends on:** Phase 2
**Priority:** low compared with CI migration and performance work

Add a separate Nix-capable command that generates and commits `flake.lock` files
for `nixpkgs` and other flake inputs.

The command is not required to work on native Windows. Ordinary generation must
remain Nix-independent.

`flake.lock` locks Nix inputs. It does not provide fixed hashes for upstream CI
tool binaries.

### Phase 7: validation and fixed hashes

**Task:** [ci-nix-hardening](ci-nix-hardening.md)
**Depends on:** Phase 2
**Priority:** low compared with getting the infrastructure into CI and measuring performance

Add comprehensive generated checks for exact versions, representative commands,
Playwright coordination, host architectures, Rust/WASM/32-bit targets, and OCI
contents where applicable.

Add a separate Nix-capable hash-update command that retrieves or computes fixed
hashes for platform-specific upstream binaries and browser artifacts. Replace
version-addressed runtime downloads with fixed-output Nix downloads when ready.

This is hardening, not a prerequisite for Phases 3, 4, or 5.

### Source-of-truth contract

```text
fjs/ci/config/module.f.ts
        |
        | exact tested tool versions
        v
generated target-specific flake.nix
        |
        | exact upstream installation logic
        +--> direct Linux/macOS CI
        +--> Linux OCI images
```

`nixpkgs` may select supporting infrastructure versions. It must not silently
replace the exact tested tool versions selected by the CI config.

### Update commands

Ordinary cross-platform generation:

```sh
npm run update
npm run ci-update
```

Later deliberate Nix-capable updates:

```sh
npm run ci-nix-lock-update # Phase 6
npm run ci-nix-hash-update # Phase 7
```

The later commands may require Linux, macOS, or Windows through WSL. They must
not become prerequisites for ordinary native-Windows generation.

### Tasks

- [x] Phase 1: centralize exact tool versions in CI configuration.
- [ ] Phase 2: generate committed target-specific `flake.nix` files.
- [ ] Phase 3: switch Linux and macOS jobs to generated Nix environments.
- [ ] Phase 4: build and use generated Linux OCI images where beneficial.
- [ ] Phase 5: investigate GitHub-backed macOS Nix caching.
- [ ] Phase 6: add deliberate committed `flake.lock` generation.
- [ ] Phase 7: add comprehensive validation and fixed artifact hashes.

### Non-blocking rules

- Phase 3 must not wait for Phase 6 or Phase 7.
- Phase 4 must not wait for Phase 6 or Phase 7.
- Phase 5 must not wait for Phase 6 or Phase 7.
- Phase 6 and Phase 7 may be implemented earlier if convenient, but their lower
  priority must not delay the critical path.
- A developer-oriented aggregate root `flake.nix` remains out of scope.

### Related

- [ci-nix](ci-nix.md) — Phase 2 generation.
- [ci-nix-ci](ci-nix-ci.md) — Phase 3 direct CI.
- [ci-scenario-docker](ci-scenario-docker.md) — Phase 4 Linux OCI.
- [ci-nix-cache-macos](ci-nix-cache-macos.md) — Phase 5 macOS cache.
- [ci-nix-locks](ci-nix-locks.md) — Phase 6 locks.
- [ci-nix-hardening](ci-nix-hardening.md) — Phase 7 validation and hashes.
- [GitHub issue #1034](https://github.com/functionalscript/functionalscript/issues/1034)
  — original Dockerfile/Nix proposal.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
- [i096](96.md) — CI caching.