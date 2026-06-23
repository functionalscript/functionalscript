## 65Z-ci-nix. Investigate Nix as a package manager for CI environments

**Priority:** P4
**Status:** open

### Summary

Nix is a purely functional package manager (not a virtualizer) that provides
reproducible, content-addressed tool environments. It is a candidate for
replacing inline tool installations (`setup-node`, `setup-bun`, etc.) on
macOS CI — and potentially Linux — without the overhead of Docker or a VM.

### What Nix is (and is not)

Nix manages tool binaries via a content-addressed store (`/nix/store`). When
you enter a Nix shell (`nix develop`), `PATH` and related env vars point at
Nix-managed binaries. **There is no virtualization**: the process runs
natively on the host OS with the host kernel, syscalls, and filesystem.

On macOS this means:
- `process.platform === 'darwin'`
- macOS-specific APIs (Keychain, FSEvents, etc.) are accessible
- Tests exercise the real macOS environment that users run on

This is the key advantage over Docker on macOS: Docker runs inside a Linux
VM (via the Docker Desktop hypervisor), so it does not test macOS behaviour.

### How it looks in GitHub Actions

Jobs and steps are unchanged. Only `run:` steps need a Nix wrapper;
`uses:` actions (including `actions/checkout`) run in the GitHub Actions
Node.js sidecar and require no changes:

```yaml
jobs:
  test:
    runs-on: macos-26
    steps:
      - uses: DeterminateSystems/nix-installer-action@v4
      - uses: DeterminateSystems/magic-nix-cache-action@v2  # caches Nix store
      - uses: actions/checkout@v5                           # unchanged
      - run: npm t
        shell: nix develop --command bash -e {0}
      - run: npm run fst
        shell: nix develop --command bash -e {0}
```

The `magic-nix-cache-action` transparently caches the Nix store between runs
so `nix develop` is fast after the first build — similar to Docker image
caching but at the granularity of individual derivations (only changed
packages are re-fetched).

Alternatively, each step can be prefixed explicitly:
```yaml
      - run: nix develop --command npm t
```

The CI generator in `fs/ci/` would emit the `shell:` override or the
`nix develop --command` prefix on `run:` steps; the overall job/step shape
stays the same.

### Platform support

| Platform | Nix viable? | Notes |
|---|---|---|
| Linux (Intel + ARM) | ✅ | Works natively; Docker is the current plan ([i65Z-ci-scenario-docker](todo.md)) |
| macOS | ✅ | **Best fit** — real macOS environment, no VM overhead |
| Windows | ❌ | WSL2 only → runs a Linux kernel, not real Windows; no advantage over Docker |

#### Why Windows is out of scope

Nix on Windows requires WSL2. Inside WSL2 the kernel is Linux, so
`process.platform === 'linux'` — Windows-specific behaviour (path
separators, PowerShell, NTFS, `cmd.exe`) is not tested. GitHub-hosted
Windows runners also do not have WSL2 pre-enabled, and enabling it in CI
has known reliability issues. Windows CI therefore stays with inline
`setup-*` actions for the foreseeable future.

### Playwright caveat

Playwright's browser binaries and their system dependencies (glibc, libX11,
etc.) are notoriously difficult to express in Nix derivations. This is the
main reason [i65Z-ci-scenario-docker](todo.md) chose
Docker for Linux (where Playwright runs) rather than Nix. Nix packaging of
Playwright may improve over time.

### Proposed split

| Platform | Tool management | Real OS tested? |
|---|---|---|
| Linux (Intel + ARM) | Docker image | No (Linux container) |
| macOS | Nix shell | ✅ Yes |
| Windows | Inline `setup-*` actions | ✅ Yes |

### Tasks

- [ ] Evaluate `flake.nix` / `shell.nix` for the project's macOS tool set
      (Node, Bun, Deno, Rust, Wasmtime, Wasmer)
- [ ] Benchmark cold vs warm `nix develop` times on `macos-26` runners
- [ ] Integrate `magic-nix-cache-action` and measure cache hit rate
- [ ] Decide whether the CI generator (`fs/ci/`) emits `shell:` overrides or
      explicit `nix develop --command` prefixes
- [ ] Determine if tool versions in `fs/ci/config/module.f.ts` can be
      single-sourced with `flake.nix` (e.g. via `builtins.fromJSON`)

### Related

- [i65Z-ci-scenario-docker](todo.md) — Docker plan for Linux CI (chose Docker over Nix due to Playwright)
- i145 — Docker containers for Linux CI jobs
- i095 — original Docker CI idea
