## 65Z-ci-nix. Generate exact-version Nix environments

**Priority:** P3
**Status:** open
**Phase:** 2
**Depends on:** Phase 1 — exact versions in `fjs/ci/config/module.f.ts` (done)
**Unlocks:** [direct Nix CI](65z-ci-nix-ci.md), [Nix input locks](65z-ci-nix-locks.md), and [Nix hardening](65z-ci-nix-hardening.md)

### Goal

Generate and commit target-specific `flake.nix` files for Linux and macOS from
the existing CI configuration.

The generated files must install the exact upstream tool versions selected by
`fjs/ci/config/module.f.ts`. They must not use whichever Node, Deno, Bun, Rust,
Wasmtime, Wasmer, Playwright, or other version happens to be packaged by the
selected `nixpkgs` revision.

`nixpkgs` may provide build tools, shells, linkers, runtime libraries, archive
utilities, and other supporting infrastructure. It is not the version authority
for CI tools.

### Dependency graph

```text
Phase 1: exact versions in ci/config/module.f.ts [done]
        |
        v
Phase 2: generate and commit flake.nix files [this task]
        |
        +--> Phase 3: run Linux/macOS CI through Nix
        |        |
        |        +--> Phase 4: build and use Linux OCI images
        |        +--> Phase 5: investigate macOS Nix caching
        |
        +--> Phase 6: commit flake.lock files [low priority]
        +--> Phase 7: validation and fixed artifact hashes [low priority]
```

Phases 6 and 7 are improvements. They do not block Phase 3.

### Source of truth

The maintained source remains the CI scripts and configuration, including
`fjs/ci/config/module.f.ts`.

```text
CI scripts and config
        |
        v
npm run ci-update
        |
        +-- generated GitHub Actions workflow
        +-- generated Linux/macOS flake.nix files
        +-- native Windows installation steps
```

Generated `.nix` files are committed build artifacts. They are not maintained
manually. Reusable abstractions belong in the TypeScript/FunctionalScript
generator.

### Exact upstream tools

For every CI tool, the generator should use the exact configured upstream
release and its target-specific installation method.

Each generated target may contain:

- the exact host OS and architecture;
- the exact required tool versions;
- version-specific upstream URLs, package references, or installer commands;
- archive formats and unpacking logic;
- installation and wrapping steps;
- required system libraries and environment variables;
- Rust, WASM, browser, and other target-specific setup.

The first implementation may download version-addressed upstream artifacts while
preparing or entering the environment. It does not need to turn every artifact
into a fixed-output Nix derivation yet.

This deliberately provides a simple version-pinned environment before adding
stronger reproducibility machinery.

### Independent generated files

Start without a root-level aggregate `flake.nix`. Generate explicit files for
known targets or CI environments so each one can be inspected and debugged
independently.

Possible layouts include one flake per OS and architecture:

```text
nix/generated/linux-x86_64/flake.nix
nix/generated/linux-aarch64/flake.nix
nix/generated/darwin-x86_64/flake.nix
nix/generated/darwin-aarch64/flake.nix
```

or one flake per CI environment:

```text
nix/generated/node-24-linux-x86_64/flake.nix
nix/generated/wasm-linux-x86_64/flake.nix
nix/generated/playwright-linux-x86_64/flake.nix
nix/generated/node-24-darwin-aarch64/flake.nix
```

Do not require the permanent boundary to be selected in this task. Generated
duplication is acceptable because each file is a compiled CI artifact and a
minimal reproduction for its environment.

### Cross-platform generation

`npm run update` invokes `npm run ci-update`. Ordinary generation must remain
Nix-independent and runnable on native Windows.

Ordinary generation must not:

- invoke Nix;
- download every upstream artifact merely to regenerate files;
- discover or compute fixed artifact hashes;
- generate or refresh `flake.lock`;
- resolve moving tool versions.

It should preserve the staged generated-file check:

```yaml
steps:
  - uses: actions/checkout@<pinned-version>
  - run: npm run ci-update
  - run: git add -A && git diff --cached --exit-code
```

### Completion criteria

This phase is complete when:

- `npm run ci-update` generates committed target-specific `flake.nix` files;
- every generated file selects exact upstream tool versions from the maintained
  CI configuration;
- no tested tool version is selected implicitly by `nixpkgs`;
- generation works on Linux, macOS, and native Windows without Nix;
- stale generated files are deleted;
- generated additions, deletions, and modifications are detected by CI;
- the generated files contain enough installation logic for Phase 3 to run the
  existing CI commands through them.

Dedicated version checks, representative command checks, Playwright bundle
checks, target checks, and fixed artifact hashes belong to
[Phase 7](65z-ci-nix-hardening.md). Their absence does not block Phase 3.

### Tasks

- [ ] Add target-specific Nix generation to `fjs/ci/module.f.ts` or a dedicated
      generator used by `npm run ci-update`.
- [ ] Generate exact upstream installation logic for every configured CI tool.
- [ ] Use `nixpkgs` only for build tools, system libraries, and supporting
      infrastructure.
- [ ] Generate independent Linux and macOS flake directories without a root
      aggregate flake.
- [ ] Keep `npm run update` and `npm run ci-update` runnable on native Windows.
- [ ] Do not require artifact hashes, validation suites, or `flake.lock` files.
- [ ] Delete stale generated files when tools, versions, systems,
      architectures, targets, or jobs are removed.
- [ ] Preserve `git add -A && git diff --cached --exit-code`.
- [ ] Keep hosts separate from additional Rust, WASM, and 32-bit targets.
- [ ] Generate Playwright package, browser, dependency, and environment setup
      from the configured Playwright version.

### Out of scope

- converting CI jobs to Nix — [Phase 3](65z-ci-nix-ci.md);
- Linux OCI images — [Phase 4](65z-ci-scenario-docker.md);
- macOS cache investigation — [Phase 5](65z-ci-nix-cache-macos.md);
- committed Nix input locks — [Phase 6](65z-ci-nix-locks.md);
- comprehensive validation and fixed artifact hashes —
  [Phase 7](65z-ci-nix-hardening.md);
- a developer-oriented aggregate `flake.nix`.

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — complete
  dependency-driven rollout.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
