# Try Pixi with public binary packages

This opt-in prototype addresses
[`fjs/ci/todo/investigate-mise-pixi.md`](../../fjs/ci/todo/investigate-mise-pixi.md).
It leaves `dev.sh`, the devcontainer, generated CI and the supported project
pins unchanged. The trial deliberately uses versions available in conda-forge's
public binary channel, as authorized for this experiment. It is not evidence
that every tool, target or host has reached parity with Nix.

## Start from the repository root

Install [Pixi 0.83.0](https://github.com/prefix-dev/pixi/releases/tag/v0.83.0)
for your native architecture, then run these commands in a normal terminal
outside the Nix shell:

```sh
pixi install --locked
pixi run --locked versions
pixi run --locked js-deps
pixi run --locked typecheck
pixi run --locked rust-test
```

The same `pixi` commands work in PowerShell on native Windows. Windows ARM64
uses `win-arm64` packages; this trial does not substitute x64 emulation. Use
`pixi shell` for an interactive terminal or prefix an arbitrary command with
`pixi run --locked`. The manifest's named platforms identify the actual native
subdir and required OS baseline. Linux requires glibc 2.34 or newer; macOS
requires 15 or newer. These conservative minima also accommodate the optional
Wasmer packages. Installation and a six-platform solve are different checks:
only Linux x64 has been exercised here.

`pixi.lock` contains archive URLs, versions, builds and SHA-256 hashes for every
resolved environment and host. `--locked` rejects manifest/lock disagreement.
Conda-forge publishes the packages; they may be rebuilt from upstream sources
rather than being the upstream publisher's release archive. This is public
binary distribution, separate from a local download cache or an Actions cache.
Keep `--locked` for ordinary use; run `pixi lock` deliberately when updating a
trial dependency. This manifest is handwritten for the experiment, so compare
it against the central pins before making a trial update.

## What you are comparing

| Tool | Supported project pin | Packaged trial | Availability |
| --- | --- | --- | --- |
| Node | 26.12.1 | 26.12.1 | Default environment, all six hosts |
| Rust, Cargo, Clippy, rustfmt | 1.99.1 toolchain | 1.99.0 toolchain | Default environment, all six hosts |
| TypeScript | 7.0.2, native implementation | 6.0.2, original JavaScript implementation | Default environment, all six hosts |
| Deno | 2.8.3 | 2.8.3 | `runtimes` environment, five hosts; no Windows ARM64 |
| Bun | 1.4.4 | 1.4.2 | `runtimes` environment, same five hosts |
| Wasmer | 7.1.0 | 7.5.0 | `runtimes` environment, same five hosts |
| SpiderMonkey | 140.14.0 | 91.13.0 | Libraries only in `spidermonkey-libs`; no shell executable |
| Wasmtime CLI | 45.0.2 | Not installed | The `wasmtime-py` package is not a CLI substitute |

Version differences can change test results and performance, especially the
TypeScript implementation and much older SpiderMonkey. This is a developer
workflow experiment, not an equivalent-toolchain CI benchmark. A failed
exact-pin solve first found no `rust ==1.99.1` on Windows ARM64. Relaxing the
trial versions allowed the packaged baseline above to solve without rustup or
npm tool installers.

The Conda Rust package supplies the host standard library and native compiler
support on Linux. Native development still needs a working system linker/SDK:
Xcode Command Line Tools on macOS, and Visual Studio Build Tools with the
native architecture's MSVC C++ tools and Windows SDK on Windows. These are
preinstalled on the representative hosted runners; a clean developer machine
may need them installed separately.

This prototype does not add the four WASM target libraries or the i686 target
and linker setup from Nix. They require a follow-up package/target evaluation;
having `rustc` installed does not establish cross-compilation support. In
particular, the repository's `.cargo` WASM runners name tools absent from the
default environment. Do not treat native `rust-test` as a WASM check.

Cargo has a trial-local home in `.pixi/cargo`. This avoids `~/.cargo/bin` taking
precedence over the packaged `cargo-fmt` and `cargo-clippy` when Cargo resolves
subcommands. Crate downloads and Cargo configuration therefore live separately
from your usual Cargo home. No rustup default is changed.

## Other runtimes and the uncommon-tool experiment

```sh
pixi install --locked --environment runtimes
pixi run --locked --environment runtimes deno-version
pixi run --locked --environment runtimes bun-version
pixi run --locked --environment runtimes wasmer-version
```

On Linux x64 or macOS x64:

```sh
pixi install --locked --environment spidermonkey-libs
pixi list --environment spidermonkey-libs
```

The `spidermonkey-libs` environment is an explicit package-coverage experiment,
not a working FJS shell: the installed package contains headers and `libmozjs`,
with **no `js` or `js91` executable**. Catalog availability did not establish
CLI availability. Its native dependencies are locked, and its older ICU
conflicts with Node's ICU, so it has a separate environment without the default
feature. This records the packaging work still needed for an uncommon tool;
it cannot run the FunctionalScript SpiderMonkey suite. The environment is
limited to Linux x64 and macOS x64, where this package version solves.

Trying the current SpiderMonkey 140.14.0 on the other native hosts would need a
new Conda package or a separately managed upstream archive. The TODO links the
Mozilla archives and SHA-256 manifest. Preserve every companion library, verify
the archive against that manifest, and resolve Linux loader paths before
claiming success. No custom package has been built or published by this trial.

## VS Code, tasks and terminals

Launch a **new VS Code process** from `pixi shell` with `code .`, or use
`pixi run --locked code .`. Close existing windows first so the new window does
not inherit an older VS Code process's environment. New integrated terminals,
process tasks and Rust Analyzer inherit the selected environment. Check
`node --version`, `tsc --version` and `rustc --version` in the terminal and in
an actual task. Rust Analyzer may download its own server; its Cargo invocations
must resolve the Pixi tools. The optional
[Pixi VS Code extension](https://pixi.prefix.dev/latest/integration/editor/vscode/)
provides task/environment integration, but does not prove every language server
uses that environment.

VS Code's TypeScript language service normally uses its bundled compiler even
when `tsc` on `PATH` comes from Pixi. To evaluate the cached JavaScript compiler
in the editor, set `typescript.tsdk` in your local workspace settings to
`.pixi/envs/default/lib/node_modules/typescript/lib` on Unix or Windows, then run
**TypeScript: Select TypeScript Version → Use Workspace Version**. Inspect that
folder first: package layouts can change. Editor and native Windows behavior
remain manual trial checks, not completed validations.

A minimal process task can use `"command": "pixi"` with
`"args": ["run", "--locked", "typecheck"]` and
`"options": { "cwd": "${workspaceFolder}" }`. This selects the environment
explicitly even if a task's parent process has another `PATH`.

## CI and feedback

[`ci.example.yml`](./ci.example.yml) is an opt-in manual workflow example.
Copy it to `.github/workflows/pixi-trial.yml` on a trial branch to run it. It is
not part of the generated production workflow and has not been executed on
GitHub. It exercises native package versions, type checking and native Rust;
it does not claim all existing platform-job checks. Current native Windows CI
also uses the published FJS bootstrap, which this prototype does not replace.

For feedback, record OS/architecture, native versus emulated process, manager
version, lock revision, which environment you used, SDK/linker prerequisites,
terminal/task/extension paths and exact commands/results. Keep unsupported
hosts and runtime-version failures visible. CI setup timings are not measured
here. A fair timing follow-up must separate manager bootstrap, cold/restored
package and environment caches, extraction, cache save and build/test time,
with repeated runs on equivalent runner images.

Validation on Linux x64: the default, runtime and isolated SpiderMonkey library
environments solve from conda-forge with all declared platforms in the lock;
execution and compatibility results are recorded in the PR description. The
other native hosts and VS Code integration still need developer feedback.
