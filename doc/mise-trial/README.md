# Try the mise development environment

This is the mise trial for
[`fjs/ci/todo/investigate-mise-pixi.md`](../../fjs/ci/todo/investigate-mise-pixi.md).
It provides an opt-in environment alongside `./dev.sh`. The existing Nix shell,
devcontainer, generated CI, and release workflows remain the supported setup.
No migration has been selected.

## Start

Install [mise](https://mise.jdx.dev/installing-mise.html) **2026.10.19** using
its instructions for Linux, macOS, or native Windows. Use a fresh terminal
outside a Nix shell so an inherited Nix linker or Cargo configuration does not
mask machine prerequisites. From the repository root:

```text
mise trust
mise install --locked
mise exec -- npm ci
mise run check
```

`mise.toml`, `mise.lock`, and `.mise/locks/` belong together. The sidecar under
`.mise/locks/npm-typescript/` locks the npm compiler's platform dependencies;
copying just `mise.lock` is insufficient. `mise exec -- <command>` supplies the
tools and environment without installing a shell hook. For example:

```text
mise exec -- tsc
mise exec -- cargo test
mise exec -- cargo clippy -- -D warnings
mise exec -- cargo fmt -- --check
mise exec -- npm start test
```

The source JavaScript test command on native Windows remains an experiment.
Current Windows CI bootstraps the published `functionalscript@0.56.0` and runs
`fjs test`; this trial does not claim to have replaced that bootstrap.

## Tools and prerequisites

The manually written manifest snapshots the exact versions in
[`fjs/ci/config/module.f.js`](../../fjs/ci/config/module.f.js): Node 26.12.1,
TypeScript 7.0.2, Rust 1.99.1, Deno 2.8.3, Bun 1.4.4, Wasmtime 45.0.2, and
Wasmer 7.1.0. The npm `typescript` package supplies the `tsc` command; it is
not a download of an arbitrary current compiler. There are no version deviations
in this trial. Trying cached versions later is allowed, but record each
changed version and do not report those results as exact Nix parity.

| Requirement | What the trial supplies | What the host still supplies |
| --- | --- | --- |
| Native tools | All six hosts have locked Node, TypeScript, Rust, Deno, Bun, and Wasmtime routes | Supported glibc/Linux, macOS, or Windows runtime libraries; download access |
| Rust components | Minimal profile, clippy, rustfmt | rustup manages installation outside mise's installed-tool directory |
| Rust WASM targets | All four current WASM targets on Linux/macOS | WASM runtimes must support the specific test; the threaded target still uses Wasmer |
| Linux x64 i686 | `i686-unknown-linux-gnu` standard library | A native compiler and 32-bit libc/linker, e.g. Debian/Ubuntu `build-essential gcc-multilib libc6-dev-i386`; Nix's i686 linker is not supplied |
| macOS | Native Rust and current WASM target libraries | Xcode Command Line Tools |
| Windows x64 | Native Rust plus `i686-pc-windows-msvc` standard library | Visual Studio C++ Build Tools, Windows SDK, x64/x86 build tools |
| Windows ARM64 | Native Rust | Native ARM64 C++ Build Tools and Windows SDK; Wasmer 7.1.0 has no upstream native ARM64 binary and is deliberately excluded |
| Git | No managed Git pin | Git installed on the host |

The lock records upstream archive URLs and hashes for six platform identifiers.
That is downloaded metadata, not six machines passing tests. Rust uses rustup's
release manifests and component checksums; it has a version/component/target
lock entry rather than a mise archive URL. Native linkers, SDKs, and system
libraries are prerequisites, not captured dependencies.

If an existing rustup installation is broken or you want to isolate a trial,
set `MISE_RUSTUP_HOME` and `MISE_CARGO_HOME` to separate writable directories
before **both** installation and execution. Do not delete another toolchain to
repair this trial. The validation below used isolated Rust/Cargo homes after
the environment's pre-existing partial Rust installation conflicted.

## SpiderMonkey

Mozilla's checked ESR jsshell archives are a separate opt-in because they have a
different publisher and runtime-library layout:

```text
mise trust mise.spidermonkey.toml
mise -E spidermonkey lock http:spidermonkey --platform linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64,windows-arm64
mise -E spidermonkey install --locked
mise -E spidermonkey exec -- js --version
mise -E spidermonkey run spidermonkey-test
```

Review and keep the generated `mise.spidermonkey.lock` before repeating the
trial. No SpiderMonkey lock is committed: this session's network policy does not
allow `archive.mozilla.org`, so resolving the checksum manifest and executing
this installation remain unvalidated. The source is Mozilla's
[SHA256SUMS](https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/SHA256SUMS),
with the `checksum_url` option recording the archive's digest in the lock.
On Linux, the environment adds the installed archive directory to
`LD_LIBRARY_PATH` for its bundled NSPR libraries. On Windows, all companion DLLs
stay next to `js.exe`; macOS uses Mozilla's universal archive. Test those loader
assumptions on each native host. Do not count the system's unrelated `js`
command as this installation.

## VS Code

Install the [mise extension](https://marketplace.visualstudio.com/items?itemName=hverlin.mise-vscode) for configuration
and task discovery. Tool selection in a language server, a task, and a terminal
are separate checks. Quit existing VS Code processes, then start an instance
from this checkout with `mise exec -- code --new-window .`. Extensions launched
by that instance inherit its tool paths. Confirm Rust Analyzer uses the pinned
Cargo/Rust toolchain in its output; the extension's own Rust Analyzer binary is
separate. TypeScript's editor language service is also separate from `tsc` and
has not been validated by this trial.

For a terminal use `mise exec -- bash` (or zsh) on Unix, and
`mise exec -- pwsh -NoExit` in native PowerShell. Check `node --version`,
`tsc --version`, and `rustc --version` in that terminal. On Windows confirm
`Get-Command node` and `Get-Command cargo` select mise's tools. For interactive
switching between projects, follow mise's shell activation or shims guidance.

[Example VS Code tasks](tasks.json) explicitly invoke mise, so they do not depend
on a terminal activation hook. Copy them into your local `.vscode/tasks.json`
after reviewing; `.vscode` stays untracked. Rust Analyzer/editor-path behavior
and native Windows task/terminal behavior still need developer feedback.

## CI and reproducibility

[`workflow.yml`](workflow.yml) is an inactive, manually triggered six-runner
example. Copy it to `.github/workflows/` only for a deliberate CI experiment;
it does not replace the generated workflows. It checks tool versions, the
compiler, and native Rust. Tool installation, dependency fetches, checks, and
cache save should be measured separately. The example can disable caches;
it is not yet a cold/warm timing comparison against Nix.

mise-action caches installed mise tools. Rustup/Cargo live outside that cache;
the example caches those explicitly. A restored installed-tool cache is trusted
as restored, whereas a fresh locked download is checked against the recorded
hash. GitHub Actions caches may be evicted and are not durable public binary
hosting. Successful-test records on this repository's `build-cache` branch
are unrelated to either cache.

To refresh the committed lock without inventing a Wasmer ARM64 route:

```text
mise lock node npm:typescript bun rust github:denoland/deno github:bytecodealliance/wasmtime --platform linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64,windows-arm64
mise lock github:wasmerio/wasmer --platform linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64
```

Review URLs, architectures, hashes, provenance and sidecar changes. Platform
asset names are explicit because top-level `os()`/`arch()` templates rendered
for the locking host, rather than each target, in this manager version.

Adoption would require generating manifests from the shared pins, integrating
new execution wrappers with smart CI/cache inputs, deciding how Nix lock
refresh fits native Windows generation, and updating supported entry points.
These opt-in manifests are excluded from current check inputs because the
current generated CI does not consume them.

## Validation and feedback

On Linux x64, mise 2026.10.19 resolved the six-host baseline lock and installed
the pinned baseline tools. `mise run check`, `wasmer --version`, `npm ci`, and `tsc` through
`mise exec` passed. The configured target/component lists installed successfully;
that does not validate native i686 linking or WASM execution. Other native hosts, VS Code, SpiderMonkey, Linux i686
linking, and WASM execution remain unvalidated. Installation durations from
this preconfigured session are not comparable CI benchmark results.

For feedback record the OS/architecture and runner image, manager version,
actual tool versions, machine prerequisites, cold/restored cache state,
setup/cache-save times, editor/task/terminal paths, commands/results, and any
manual tool installation. In particular, distinguish native Windows ARM64
execution from x64 emulation. The TODO retains the six-host comparison,
benchmarks, and the decision whether to keep Nix.
