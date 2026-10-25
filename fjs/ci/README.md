# Continuous integration workflow generator

`fjs ci` writes `.github/workflows/gen.ci.yml` and
`.github/workflows/gen.npm-publish.yml`. Jobs use the checkout's committed
mise manifest and lock; callers must provide those files. This replaces the
previous generated environment API. `Setup.environment` is removed because
this branch has one environment manager.

The nine CI jobs cover Linux, macOS and Windows on x64 and ARM64, plus canonical
Node, Deno and Bun suites. Native Rust debug/release tests and Clippy, i686
Linux/Windows checks, Linux ARM formatting and four WASM targets, SpiderMonkey
compilation/tests, TypeScript, compilation, coverage and packed-package checks
remain separate steps. Host compiler/SDK prerequisites still apply.

## Files

- `config/module.f.js`: exact accepted tool versions and runner/action pins.
- `environment/module.f.mjs`: manager-independent command assembly.
- `mise/module.f.mjs`: locked setup and command execution, including supplements.
- `rust`, `node`, `bun`, `deno`, `spidermonkey`: check builders.
- `package`: isolated packed-package declaration and runtime consumer.
- `smart`: successful-check caching; `cache`: input classification and keys.
- `self`: this repository's consumer and additional steps.

## Usage

Run `./dev.sh npm run gen` after changing a generator or input. Commit generated
workflows with their source changes. Regeneration only needs Node; tool lock
refreshes are separate. The cleaner deletes every `gen.*` output before writing
it again, so retired generated assets become deletions.

`ci(setup)` accepts `nodeExtra(os, architecture)`, optional `packageConsumer`,
`smart`, and `mergeQueueOnly`. Injected shell scripts pass unchanged through
`FJS_CI_RUN` to `bash -e -c` inside the selected environment. The packed consumer
runs outside that environment, under `runner.temp`, with its own `setup-node`.

Publishing retains its separate `setup-node` workflow and npm provenance.
See [platform setup](../../doc/mise-trial/README.md) and
[CI details](../../doc/mise-trial/CI.md).

The separate `Devcontainer` workflow builds the container and runs its
`postCreateCommand` through `devcontainers/ci`, then verifies Node, TypeScript
and repository type-checking. It runs when container or tool inputs change.
