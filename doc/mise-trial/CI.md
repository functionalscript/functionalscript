# Try mise on repository CI

This migration is stacked on the mise development trial, as the owner requested.
The generated `.github/workflows/gen.ci.yml` uses mise for all six native platform
jobs and the canonical Node, Deno and Bun jobs. The nine-job topology and check
commands remain: native Rust debug/release tests and Clippy, i686 on Linux/Windows
x64, ARM Linux formatting/WASM/SpiderMonkey, runtime coverage, source compilation,
generated-file drift, and packed-consumer validation.

`fjs/ci/self/module.f.mjs` explicitly selects `environment: 'mise'`. The pure
adapter in `fjs/ci/mise/` replaces setup and command wrappers after the default
job builders assemble the checks. Generic `fjs ci` retains its self-contained
Nix environment for external callers; selecting mise there requires the caller's
own manifests and locks. This avoids imposing an absent `mise.toml` on consumers.

Every job installs mise 2026.10.19 through `jdx/mise-action@v3` and installs the
baseline from the committed lock and npm sidecar. Commands run under
`mise exec --`; environment/shim exports are disabled, so the final packed
consumer uses its independent `setup-node` and local npm compiler. Publishing
retains its Node registry configuration and OIDC/provenance contract. Native
Windows retains the published FunctionalScript bootstrap and uses Bash for
portable wrapper/version steps. The action caches baseline installs; rustup's
separate download/toolchain state is not captured by that installed-tool cache.

Linux x64 installs `gcc-multilib` and `libc6-dev-i386` through apt for native i686
linking. MSVC SDKs/toolsets and macOS Command Line Tools come from the runner
images. Wasmer has no native Windows ARM64 binary, where existing native tests
do not need it. ARM Linux keeps all current WASM commands; their target-specific
runner configuration is unchanged. Wasmtime's upstream build metadata is stripped
when asserting its exact configured version. Native jobs also assert the
central Rust pin, so a stale handwritten mise manifest fails visibly.

SpiderMonkey is installed only for ARM Linux through the optional environment.
A dedicated `mise lock` step first resolves the fixed Mozilla archive
against the publisher's SHA256SUMS, then a separate locked install verifies
that digest before extracting the archive. A full committed SpiderMonkey lock remains unavailable from this
session's network; this runtime publisher verification differs from the baseline's
committed archive digests. SpiderMonkey setup and version checks share the same
smart-CI cache gates as its compile/suite checks. Baseline setup stays enabled for
uncached generation even when other cached checks hit. The root manifests,
lock, and `.mise/locks/` sidecars participate in both JavaScript and Rust inputs.

`npm run gen` now regenerates sources with Node alone. Cleanup preserves the
committed optional `gen.nix/flake.lock`; the Nix development shell and devcontainer
still work from that lock. `npm run lock-update` explicitly refreshes it through
Nix after pin changes. Keeping those local assets does not install or execute Nix
in repository CI.

Local validation covers generator types, scoped proofs/coverage, deterministic
regeneration without Nix on PATH, FunctionalScript compilation, and the Linux x64
mise baseline established in the parent trial. The actual six GitHub runner
executions, SpiderMonkey install, i686/native SDK linking, WASM runtime execution,
cache behavior and comparable cold/warm timings still need the PR's CI results.
These are trial results to collect before choosing an alternative for adoption.

Mozilla lists each archive as jsshell/<filename> in SHA256SUMS. The HTTP
backend checksum expression selects that full relative path; basename-only
matching failed in the initial GitHub run. A local manifest fixture checks
that an unrelated archive digest is not selected.
