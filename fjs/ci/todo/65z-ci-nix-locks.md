## 65Z-ci-nix-locks. Add content hashes and Nix lock files

**Priority:** P5
**Status:** open

### Problem

The initial generated Nix environments pin the exact published versions used by
CI. This keeps version updates simple and is enough to prove that generated Nix
files can define, validate, and run the Linux and macOS CI environments.

Exact versions do not provide complete content-addressed reproducibility. An
upstream publisher could replace an artifact associated with an existing
version, and an unlocked Nix input could resolve to a different content graph.

Adding stronger locking immediately would significantly increase the scope of
the initial Nix work:

- every supported OS and architecture may use a different upstream artifact;
- artifact names and release layouts differ between tools;
- Playwright coordinates several browser downloads per platform;
- Nix hashes must use the expected representation;
- generating `flake.lock` without Nix requires normalized lock metadata;
- refreshing that metadata cannot be part of ordinary native-Windows
  generation.

These mechanisms are useful, but they should not block proving the generated
Nix environments.

### Proposal

After exact-version Nix environments work in direct CI, strengthen their
reproducibility with two independent mechanisms:

1. record expected content hashes for externally downloaded tool and browser
   artifacts;
2. generate and commit `flake.lock` files for `nixpkgs` and any other flake
   inputs.

Artifact hashes verify the bytes selected by an exact version. `flake.lock`
records the exact transitive Nix input graph. They solve related but different
problems and should remain explicit in the implementation.

### Update workflow

Do not require developers to find or copy hashes manually during ordinary
version changes.

Add a deliberate update command, for example:

```sh
npm run ci-nix-lock-update
```

The command may require Nix and network access and may run on Linux, macOS, or
Windows through WSL. It should:

1. read the exact maintained tool versions and Nix input revisions;
2. resolve all required platform-specific artifacts;
3. compute or obtain their expected content hashes;
4. resolve the complete Nix input graph;
5. write normalized lock metadata into maintained `fjs/ci/` configuration;
6. run the ordinary Nix-independent `npm run ci-update`;
7. expose all generated changes for review.

Ordinary commands must remain unchanged:

```sh
npm run update
npm run ci-update
```

They must continue to run on native Windows without Nix, network access, or hash
computation. They only render committed `.nix` and `flake.lock` files from
maintained normalized metadata.

### Artifact hashes

For every externally downloaded artifact, maintained metadata should identify:

- tool and exact version;
- host OS and architecture;
- upstream URL and archive format;
- expected content hash;
- any package-specific revision, such as a Playwright browser revision.

The update command must fail when:

- an expected platform artifact is missing;
- two configured targets resolve inconsistently;
- a downloaded artifact does not match an upstream-provided checksum when one
  is available;
- the generated Nix hash cannot be reproduced.

Generated Nix files should use fixed-output fetches or an equivalent immutable
Nix mechanism once hashes are available.

### Nix input lock files

The maintained configuration should contain complete normalized metadata needed
to generate deterministic `flake.lock` files.

For `nixpkgs`, this includes at least:

- the exact full Git commit;
- the locked content hash such as `narHash`;
- all stable fields required by the supported `flake.lock` format.

`npm run ci-update` should render each `flake.lock` directly from maintained
metadata without invoking Nix or resolving a moving branch.

Validation must:

- treat committed lock files as immutable;
- fail rather than silently rewrite a lock;
- verify generated revisions and hashes against maintained metadata;
- detect additions, deletions, and modifications through the existing staged
  regeneration check.

### Generated-file ownership

Generated `.nix` and `flake.lock` files are committed build artifacts. They are
not maintained manually.

Reusable abstractions and normalized lock metadata belong in the
TypeScript/FunctionalScript generator and its maintained configuration.

A target-specific exception must be explicit in maintained configuration.
Generated hash or lock-file drift is never an implicit exception.

### Tasks

- [ ] Design normalized maintained metadata for platform artifact hashes.
- [ ] Design normalized maintained metadata for Nix input locks.
- [ ] Add a documented Nix-capable-host `ci-nix-lock-update` command.
- [ ] Resolve every supported platform artifact from exact maintained versions.
- [ ] Compute or import expected hashes without manual per-file editing.
- [ ] Handle the Playwright package, driver, browser revisions, downloads, and
      hashes as one coordinated bundle.
- [ ] Resolve `nixpkgs` and other flake inputs to complete lock metadata.
- [ ] Generate deterministic `flake.lock` files without invoking Nix during
      ordinary generation.
- [ ] Generate fixed-output or equivalent content-verified fetches.
- [ ] Keep `npm run update` and `npm run ci-update` runnable on native Windows
      without Nix or network access.
- [ ] Verify committed artifact hashes and Nix locks in Linux and macOS CI.
- [ ] Fail validation rather than updating a committed lock.
- [ ] Preserve `git add -A && git diff --cached --exit-code` for generated drift.

### Out of scope

- selecting different tool versions from those maintained by the CI generator;
- making ordinary generation depend on Nix;
- manually maintaining generated `.nix` or `flake.lock` files;
- blocking initial generated-Nix validation or direct CI on this work.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — exact-version generated Nix environments.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — staged
  migration from generated Nix environments to optional OCI images.
