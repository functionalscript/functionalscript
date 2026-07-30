## ci-nix-hardening. Add comprehensive validation and fixed artifact hashes

**Priority:** P5
**Status:** blocked
**Phase:** 7
**Blocked by:** [Phase 2 — generated `flake.nix` files](ci-nix.md)
**Does not block:** direct Nix CI, Linux OCI images, macOS cache research, or committed `flake.lock` files

### Goal

After the simple generated Nix environments are useful in CI, strengthen them
with:

1. comprehensive validation of installed tools, targets, browsers, and runtime
   behavior;
2. fixed hashes for externally downloaded upstream binaries and browser
   artifacts.

These are important improvements, but retrieving and maintaining the correct
platform-specific hashes is not trivial. They should not delay the first or
second iteration of the Nix CI infrastructure.

### Dependency

```text
Phase 2: committed generated flake.nix files
        |
        +--> Phase 3: direct Nix CI
        +--> Phase 6: flake.lock files
        +--> Phase 7: validation and fixed hashes [this task]
```

Phase 7 can be implemented after Phases 3, 4, and 5 have already delivered CI
or performance improvements. It is not a gate for them.

### Validation workstream

Add generated checks derived from the same maintained CI configuration.
Validation should eventually cover:

- every installed executable reports the expected exact version;
- representative commands run for Node, Deno, Bun, Rust, Wasmtime, Wasmer, and
  other configured tools;
- all required Rust and WASM compilation targets are installed and usable;
- the 32-bit Linux target has the required linker and runtime libraries;
- Playwright package, driver, browser revisions, browser paths, and native
  dependencies are coordinated correctly;
- every supported Linux and macOS host architecture can prepare and use its
  generated environment;
- OCI images, when present, contain the same expected tools as their source Nix
  environments.

A failure should identify the exact generated flake and the specific tool or
target that failed.

### Artifact-hash workstream

For every externally downloaded artifact, maintained or generated metadata
should identify:

- tool and exact version;
- host OS and architecture;
- upstream URL and archive format;
- expected fixed content hash;
- package-specific revisions, such as Playwright browser revisions.

Once hashes are available, generated Nix files should replace version-addressed
runtime downloads with fixed-output derivations or an equivalent immutable Nix
mechanism.

Artifact hashes verify upstream tool bytes. They are separate from
`flake.lock`, which locks Nix inputs such as `nixpkgs`.

### Hash update command

Do not require developers to find and edit hashes manually during an ordinary
version update.

Add a deliberate command, for example:

```sh
npm run ci-nix-hash-update
```

The command may require Nix, network access, Linux or macOS, or Windows through
WSL. Native-Windows support is not required.

It should:

1. read exact tool versions and supported targets from maintained CI config;
2. construct or discover every required upstream artifact;
3. obtain an upstream checksum when available;
4. download and compute the Nix-compatible hash when necessary;
5. update normalized maintained metadata or generated Nix inputs;
6. run ordinary generation;
7. expose all resulting changes for review.

Ordinary commands remain Nix-independent:

```sh
npm run update
npm run ci-update
```

They must not discover hashes or contact Nix merely to regenerate committed
files.

### Tasks

#### Validation

- [ ] Generate exact installed-version checks from `ci/config/module.f.ts`.
- [ ] Add representative execution checks for every configured tool.
- [ ] Validate required Rust, WASM, and 32-bit targets.
- [ ] Validate Playwright package, driver, browsers, paths, and native libraries
      as one coordinated bundle.
- [ ] Validate every supported Linux and macOS host architecture.
- [ ] Reuse the same checks for Linux OCI image contents when images exist.
- [ ] Make failures identify the exact generated flake and failed component.

#### Fixed artifact hashes

- [ ] Design normalized metadata for platform-specific artifact hashes.
- [ ] Add a documented Nix-capable `ci-nix-hash-update` command.
- [ ] Resolve every required upstream artifact from exact configured versions.
- [ ] Obtain or compute hashes without manual per-file editing.
- [ ] Verify upstream-provided checksums when available.
- [ ] Handle Playwright browser revisions and artifacts as a coordinated bundle.
- [ ] Generate fixed-output or equivalent content-verified Nix downloads.
- [ ] Keep ordinary generation runnable on native Windows without Nix, network
      access, or hash computation.
- [ ] Fail CI on unexpected artifact-hash drift after fixed hashes are adopted.

### Completion criteria

- Every configured environment has systematic generated validation.
- Every externally downloaded CI artifact is content-verified.
- Hash updates are automated through a deliberate Nix-capable command.
- Ordinary generation remains simple and cross-platform.

### Out of scope

- selecting tool versions from `nixpkgs`;
- making this phase a prerequisite for direct Nix CI or Linux OCI adoption;
- generating `flake.lock` files — covered by [Phase 6](ci-nix-locks.md).

### Related

- [Phase 2 — generate Nix environments](ci-nix.md).
- [Phase 3 — direct Nix CI](ci-nix-ci.md).
- [Phase 4 — Linux OCI images](ci-scenario-docker.md).
- [Phase 6 — Nix input locks](ci-nix-locks.md).
- [rollout overview](dockerfile-nix-integration.md).