# 65Z-ci-scenario-docker. Run scenario tests in CI via a cached Docker image

**Priority:** P3
**Status:** open

## Problem

The scenario tests (`fs/dev/tf/scenarios/run.sh`) require several tools to be
installed simultaneously — Node, Deno, Bun, and Playwright — which no single
existing CI job provides. Today the scenario runner is not executed in CI at
all, so regressions in scenario behaviour go undetected until a developer runs
`run.sh` locally.

Installing all four tools inline on every CI run would be slow. Playwright is
already kept in a dedicated job specifically because its installation (browsers
+ browser deps) is expensive.

## Proposal

Build and cache a Docker image that has every required tool pre-installed and
run the scenario suite inside it. The image is rebuilt only when a tool version
changes; between rebuilds it is pulled from the GitHub Actions cache.

### Image contents

The Docker image should be generated from `fs/ci/` so that tool versions stay
in sync with the rest of the CI matrix. It should include:

| Tool | Version source |
|------|----------------|
| Node | `config.node.default` |
| Deno | `config.deno` |
| Bun | `config.bun` |
| Playwright + browsers | `config.playwright` |

Rust, Wasmtime, Wasmer and other build tools are **not** needed for the
scenario job and should be omitted to keep the image small and the cache warm.

### Cache key

```
linux-<arch>-scenario-node<NODE>-deno<DENO>-bun<BUN>-playwright<PW>
```

The key is derived from the version constants in `fs/ci/config/module.f.ts` so
it is updated automatically whenever any version is bumped.

### Architectures

Run on both `ubuntu-24.04` (Intel x86-64) and `ubuntu-24.04-arm` (ARM64) — the
same pair used for other Linux jobs — to catch architecture-specific issues.
macOS and Windows are out of scope: the scenario tests are primarily exercising
the framework's JavaScript behaviour, not OS-specific I/O.

### Dockerfile

Reuse and clean up the existing `docker/Dockerfile`, or generate a purpose-built
one from `fs/ci/`. A generated Dockerfile is preferred so that version pins are
single-sourced in `fs/ci/config/module.f.ts`.

### What to run

```sh
for scenario in fs/dev/tf/scenarios/*.pass.ts fs/dev/tf/scenarios/*.fail.ts; do
    for runner in fjs node bun deno playwright; do
        sh fs/dev/tf/scenarios/run.sh $runner $scenario
    done
done
```

(Or an equivalent driven from the CI generator.)

## Related

- [i095](./095-ci-docker.md) — original Docker CI idea
- [i145](./145-docker-linux-ci.md) — Docker containers for Linux CI jobs (broader scope)
- [i183](./183-tf-framework-scenario-tests.md) — scenario test infrastructure
- [i65Y-scenarios-proof](./65Y-scenarios-proof.md) — scenario files converted to `export const proof`; prerequisite for running them in CI
