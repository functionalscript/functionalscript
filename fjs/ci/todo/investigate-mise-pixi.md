## Investigate mise and Pixi as Nix alternatives

**Priority:** P3
**Status:** open

### Problem

The shared Nix development environment and native Windows CI use different
installation paths. Investigate whether [mise](https://mise.jdx.dev/),
[Pixi](https://pixi.prefix.dev/), or another cross-platform system can provide
the project's development and CI tooling through one primary environment
manager across all supported platforms.

### Requirements

- **Native platform support is mandatory:** Linux, macOS, and Windows, each on
  x64 and ARM64. Windows must work without requiring WSL2 or a Linux container.
- **Easy support for uncommon tools:** adding a pinned binary such as
  SpiderMonkey should require little configuration, packaging, and ongoing
  maintenance, including any native runtime dependencies.
- **Good coverage in globally available, trusted binary caches:** evaluate usable
  prebuilt artifacts for the project's exact tool versions on each platform.
  Record the publishers, provenance and integrity checks, update lag, and gaps
  that would require our own builds or hosting.
- **Fast package installation on CI:** compare the time needed to make the
  required tools available with empty caches and restored caches, including
  manager bootstrap and cache overhead.

### Stages

#### 1. Create a PR with a development environment for developers to try

- [ ] Inventory the tool versions, Rust components and compilation targets,
      native libraries, linkers, and SDK requirements from the current tool
      configuration, Nix environment, and platform CI jobs.
- [ ] Compare mise, Pixi, and any other candidates against that inventory for
      every required host. Classify each requirement as available from a trusted
      public binary source, requiring custom packaging or a source build, or
      unavailable. Distinguish public binary availability from local download
      caches, GitHub Actions caches, and cached successful test results.
- [ ] Demonstrate adding SpiderMonkey to each candidate. Evaluate version and
      checksum locking, runtime dependencies, maintenance effort, and reuse of
      prebuilt artifacts through our own server or GitHub storage when public
      coverage is insufficient.
- [ ] Create a PR with a development environment based on mise, Pixi, or another
      cross-platform system for developers to try on Linux, macOS, and native
      Windows. Include setup instructions, VS Code extension, task, and terminal
      access to the tools, and representative CI configurations. Collect
      feedback on every supported OS and architecture; record prerequisites,
      separately managed tools, and integration work for the generators.
- [ ] Benchmark CI environment setup for each candidate and the current setup
      on each supported platform, using comparable runners and equivalent
      tool versions, components, and targets. Measure elapsed time until tools
      are ready with empty local and CI caches and with restored caches,
      including manager bootstrap, cache restoration, downloads, extraction,
      installation, and any source builds.
      Report cache save time separately from setup time, and keep build/test
      execution separate. Use repeated runs to record typical timings and
      variation. Record the runner image, preinstalled tools, and any reuse of
      those tools; start each comparison from the same runner state.
- [ ] Document developer feedback, platform/package coverage, example
      configurations, reproducibility limits, CI installation timings,
      maintenance costs, and unresolved gaps.

#### 2. Decide which system to keep and replace or retain Nix

- [ ] Use the trial results to choose the system to keep and decide whether to
      replace or retain Nix. A replacement must meet the requirements above;
      retaining the current setup remains a valid outcome.
- [ ] If a migration is selected, implement it in a follow-up PR. This may also
      require replacing or updating CI environments and workflows,
      configuration generators, caching, and developer setup documentation.
      Verify the resulting development and CI setup on all supported platforms.

### Preliminary comparison reports

Research snapshot: **2026-10-24 UTC**, against repository revision
[`c162c3a`][repo-pins]. These tables summarize the investigation so far.
"All six hosts" means Linux, macOS, and native Windows, each on x64 and ARM64.
Report emulated execution separately from native execution.
Manager support, published binaries, successful installation, and working CI
are separate checks. The Stage 1 trials and performance measurements remain
open.

#### Environment model and developer workflow

| Area | mise | Pixi |
| --- | --- | --- |
| Native platforms | Official manager builds cover all six hosts. Tool availability still depends on the selected backend and upstream release. [Platforms][mise-platforms] | Supports all six platform identifiers, including native `win-arm64`. Each package must also support its selected platform. [Platforms][pixi-manifest] |
| Environment model | Selects tool versions and supplies environment variables and tasks through `mise.toml`; suitable for combining upstream runtime distributions. [Tools][mise-tools] | Solves packaged dependencies into project environments; features and target tables describe platform differences in `pixi.toml`. [Manifest][pixi-manifest] |
| Public binary sources | Uses upstream publishers and registry backends; a registry entry alone does not establish a usable binary or its provenance. Check the selected download and verification method. [Registry][mise-registry] | Uses channels such as conda-forge with package metadata and native dependency declarations. Exact version and architecture coverage must be checked; the results below concern conda-forge only. [Conda ecosystem][pixi-conda] |
| Locking | `mise.lock` records resolved versions and archive URLs/hashes where the backend supports them. The Rust backend records the toolchain version while rustup handles installation; npm dependency locks have sidecar files. Use `mise install --locked`. [Locking][mise-lock] | `pixi.lock` records resolved packages across environments/platforms. Use `pixi install --locked`. Tools installed separately by rustup or arbitrary tasks are outside this package lock. [Locking][pixi-lock] |
| Adding an uncommon binary | The `http:` backend accepts per-platform URLs, checksums, and extraction settings. An existing archive can avoid a custom package recipe; its runtime libraries still need to work. [HTTP][mise-http] | A maintained Conda package can include the binary and declare its native dependencies. Repackaging an upstream archive is a candidate approach; building via `pixi-build-rattler-build` currently requires the `pixi-build` preview feature. [Build backend][pixi-build] |
| Rust and native dependencies | Rust backend options cover profiles, components, and targets through rustup. Target libraries do not supply the native linker, Windows SDK, or Linux i686 libc/sysroot. [Rust][mise-rust] [Cross-compilation][rust-targets] | Native libraries and compilers can be packaged with the environment, subject to channel coverage. The checked exact Rust version is missing; using external rustup would leave a hybrid to evaluate, rather than prove a complete packaged replacement. [Rust][pixi-rust] |
| VS Code on native Windows | Use mise shims on the user `Path`, restart VS Code, and use `mise exec` for explicit tool execution. Verify extension, task, and terminal tool selection independently. [IDE integration][mise-ide] | Use `pixi run` for tasks and launch the editor from the intended environment. The community extension exposes tasks and dependency management; TypeScript/Rust language-server integration still needs testing. [VS Code][pixi-vscode] |

#### Exact tool versions and public package coverage

The version pins come from the [central configuration][repo-pins]. The
conda-forge release API was checked at **2026-10-24 04:43 UTC** using the exact
names and versions linked below. A missing release does not rule out another
channel or package name. A listed artifact does not establish a successful
dependency solve. The mise column describes proposed installation routes and
upstream asset listings, not completed installations.

| Tool and exact version | mise route investigated | Pixi: checked conda-forge result |
| --- | --- | --- |
| Node `26.12.1` | Core `node` backend using the upstream distribution. [Node][mise-node] | [`nodejs` release][cf-node]: artifacts listed for all six hosts. |
| Rust `1.99.1` | Core `rust` backend; minimal profile, rustfmt/clippy, and the existing platform-specific target sets. [Rust][mise-rust] | [`rust` release][cf-rust]: exact version absent. The complete target/component combination still needs packaging or another verified source. |
| TypeScript `7.0.2` | `npm:typescript`; preserve the `tsc` command used by the repository. [npm backend][mise-npm] [Project pin][repo-pins] | [`typescript-go`][cf-tsgo]: package name not found; [`typescript`][cf-ts]: exact version absent. |
| Deno `2.8.3` | Core `deno` backend. The upstream release lists binaries for all six hosts. [Backend][mise-deno] [Release][deno-release] | [`deno` release][cf-deno]: five hosts; no Windows ARM64 artifact listed. |
| Bun `1.4.4` | Core `bun` backend. The upstream release lists binaries for all six hosts. [Backend][mise-bun] [Release][bun-release] | [`bun` release][cf-bun]: exact version absent. |
| Wasmtime `45.0.2` | `aqua:bytecodealliance/wasmtime` or a pinned upstream archive; the release lists binaries for all six hosts. [Upstream release][wasmtime-release] | [`wasmtime`][cf-wasmtime]: package name not found. |
| Wasmer `7.1.0` | `aqua:wasmerio/wasmer` or a pinned upstream archive. The inspected upstream release had no Windows ARM64 binary. [Upstream release][wasmer-release] | [`wasmer` release][cf-wasmer]: artifacts for Linux, macOS, and Windows x64 only. |
| SpiderMonkey `140.14.0` | `http:spidermonkey` using Mozilla's checked archives; see the next table. | [`spidermonkey` release][cf-spidermonkey]: exact version absent. A custom package is a candidate, not a published result of this investigation. |

The checked conda-forge catalog cannot satisfy the complete proposed
environment as written. Do not relax the project's pins to make it solve.
mise's proposed routes also need complete installation and runtime validation;
neither candidate has demonstrated all-platform parity.

#### SpiderMonkey: verified archives and packaging work

Mozilla's [140.14.0 ESR shell directory][mozilla-shells] provides five ZIPs
covering the six hosts. All five were downloaded, checked against the
[published SHA-256 manifest][mozilla-checksums], and inspected for binary
architecture and archive layout.

| Host | Archive | Binary inspection and execution result |
| --- | --- | --- |
| Linux x64 | [`jsshell-linux-x86_64.zip`][sm-linux-x64] | ELF x64; `js --version` executed and reported `JavaScript-C140.14.0`. |
| Linux ARM64 | [`jsshell-linux-aarch64.zip`][sm-linux-arm64] | ELF AArch64; not executed on that host. |
| macOS x64 and ARM64 | [`jsshell-mac.zip`][sm-macos] | Universal Mach-O containing both architectures; not executed on either host. |
| Windows x64 | [`jsshell-win64.zip`][sm-windows-x64] | PE x64 with `js.exe` and companion DLLs; not executed on that host. |
| Windows ARM64 | [`jsshell-win64-aarch64.zip`][sm-windows-arm64] | PE ARM64 with `js.exe` and companion DLLs; not executed on that host. |

| Packaging question | mise candidate | Pixi candidate |
| --- | --- | --- |
| How to consume the archive | Pin the version, platform URL and SHA-256 with `http:`; preserve the archive contents and expose the root with `bin_path = "."`. [HTTP][mise-http] | Repackage the verified archive as a Conda package for each target platform and publish it to an indexed channel. [Build backend][pixi-build] [Publishing][pixi-publish] |
| Native runtime handling | The Linux archive contains NSPR libraries, but the inspected Linux x64 executable has no RPATH/RUNPATH. Configure library discovery, for example a Linux-only library-path entry; host runtime requirements still apply. | Declare or bundle the required libraries and validate loader paths in the package. Repackaging must preserve the working `js`/`js.exe` command and its dependencies. |
| Work still to prove | The complete mise installation and FunctionalScript SpiderMonkey tests on each required host. | A real recipe, built packages, a successful solve, and FunctionalScript SpiderMonkey tests on each required host. |

#### Caches, hosting, and CI installation speed

| Area | mise | Pixi |
| --- | --- | --- |
| GitHub Actions integration | `jdx/mise-action` supports locked installation and installed-tool caching. Rustup/Cargo state needs deliberate handling because toolchains live outside mise's installs directory. [CI][mise-ci] [Rust][mise-rust] | `prefix-dev/setup-pixi` caches project environments using platform and lock-derived keys; a hit can skip installation. Explicitly select any named environments used by the job. [Action][pixi-action] |
| Download cache versus installed environment | Restoring installed tools avoids extraction, but restored trees are trusted as restored. The documented `downloads-cas` approach rechecks locked archive hashes and extracts again; source-built tools still compile. [CI][mise-ci] [Locking][mise-lock] | Package/metadata caches and cached project environments serve different purposes. An external rustup task is not automatically covered by the Pixi environment cache. [Cache commands][pixi-cache] [Action][pixi-action] |
| Our own server or mirror | Serve versioned archives with hashes; `http:` can consume them. URL replacements can route existing upstream requests to a mirror, but do not populate it. [HTTP][mise-http] [Mirrors][mise-mirrors] | Serve Conda packages and channel indexes, or an exact channel mirror. `pixi publish --target-channel` can create an indexed local channel for later hosting; `--target-dir` only copies artifacts. [Publishing][pixi-publish] [Mirrors][pixi-mirrors] |
| Git branch or GitHub Releases | A commit-pinned raw archive URL is a possible `http:` source. Releases are a more suitable candidate for accumulating versioned binaries than ordinary Git history. [HTTP][mise-http] [GitHub guidance][github-large-files] | A repository can hold recipes and channel metadata; distributing packages still needs a usable package/channel layout. A raw SpiderMonkey ZIP in a release is not itself a Conda package. [Custom channels][conda-channel] |
| GitHub Actions cache as storage | Can accelerate CI using cached files, but entries may be evicted and access is scoped. Keep a durable upstream/release/server source from which installation can recover. [GitHub cache][github-cache] | The same limits apply to cached Pixi environments and packages. Use a durable channel for developer installs and cache-miss recovery. [GitHub cache][github-cache] |
| Measured CI installation speed | Not measured. Compare cold installation, restored installations, and verified download-cache restoration on the required runner matrix. | Not measured. Compare cold installation and restored package/environment caches using equivalent tools and runner types. |

No speed winner is established. The Stage 1 benchmark includes bootstrap,
cache restoration, download, extraction, installation and compilation, with
cache saving reported separately. Existing successful-check records in the
repository's `build-cache` branch are a separate cache from tool downloads,
installed environments, and Cargo build outputs. [Cache inputs][repo-cache]
[Smart CI][repo-smart]

#### Repository integration findings

| Area | Researched repository baseline | Work needed for either candidate |
| --- | --- | --- |
| Platform scope | The full Nix shell covers Linux x64/ARM64 and macOS ARM64. Intel macOS and both Windows jobs install Node/Rust directly; Windows also uses published `functionalscript@0.56.0` and `fjs test`. [Flake][repo-flake] [CI][repo-ci] | Distinguish matching existing CI from extending every tool/test to all six hosts. Preserve the Windows bootstrap when comparing equivalent setups. |
| Shared pins and generation | Pins are centralized; workflow and flake outputs are generated. General generation ends by invoking the Nix lock-update script. [Pins][repo-pins] [Generation][repo-gen] | Generate adopted manifests from the shared pins. Separate Nix lock generation or retain a suitable generation job; a new manager manifest alone does not make generation native on Windows. |
| Rust targets and system tools | Nix supplies four WASM targets and a real Linux i686 compiler/libc setup; Windows x64 tests the i686 MSVC target. [Flake][repo-flake] [Rust CI][repo-rust] | Preserve components, target standard libraries, linker selection, SDKs and system libraries. Demonstrate the developer-machine prerequisites as well as the preconfigured CI runners. |
| CI cache integration | Tracked files are explicitly classified, and smart CI recognizes the `sh ./gen.nix/run ` wrapper. [Inputs][repo-cache] [Smart CI][repo-smart] | Add adopted manifests, locks and sidecars to affected cache inputs; recognize the new invocation/setup dependencies and preserve existing success-cache behavior. |
| Editor and execution entry points | `dev.sh` and the devcontainer use Nix; the container supplies tools beyond an interactive terminal. [Entry point][repo-dev] [Container][repo-container] | Update entry points and verify tools separately in terminals, tasks, and language servers, especially on native Windows. |
| Test equivalence | Native Rust checks include debug and release; WASM execution is concentrated on Ubuntu ARM. The packed-consumer check deliberately runs outside the full development shell. [CI][repo-ci] | Keep equivalent checks and one reportable command per CI step. Preserve the isolated consumer check so development tools cannot hide missing package dependencies. |

#### What has and has not been validated

| Check | Result so far |
| --- | --- |
| Repository inventory, documentation and exact conda-forge release metadata | Inspected; findings and primary sources are recorded above. Catalog checks are not dependency solves. |
| Illustrative mise and Pixi configurations | Parsed as TOML; mise Rust options/selectors were checked against documentation/schema. No completed installation or full candidate lockfile was produced. |
| SpiderMonkey artifacts | Five archive hashes, layouts and architectures checked; only the Linux x64 version command was executed. Full FunctionalScript tests were not run against these archives. |
| Custom Pixi package, six-host trials, VS Code, and CI benchmarks | Not performed. These remain Stage 1 work. |

**Assessment to test:** mise appears to require less packaging for this
repository's upstream runtime binaries. Pixi offers an integrated model for
packaged native dependencies, but the checked channel lacks several exact
pins. These are working hypotheses for the trial; the results must drive
the Stage 2 choice. Identify independently installed tools and prerequisites
when assessing the one-primary-manager goal.

[mise-platforms]: https://mise.jdx.dev/installing-mise.html#supported-platforms
[mise-tools]: https://mise.jdx.dev/dev-tools/
[mise-registry]: https://mise.jdx.dev/registry.html
[mise-lock]: https://mise.jdx.dev/dev-tools/mise-lock.html
[mise-http]: https://mise.jdx.dev/dev-tools/backends/http.html
[mise-rust]: https://mise.jdx.dev/lang/rust.html
[mise-ide]: https://mise.jdx.dev/ide-integration.html
[mise-node]: https://mise.jdx.dev/lang/node.html
[mise-npm]: https://mise.jdx.dev/dev-tools/backends/npm.html
[mise-deno]: https://mise.jdx.dev/lang/deno.html
[mise-bun]: https://mise.jdx.dev/lang/bun.html
[mise-ci]: https://mise.jdx.dev/continuous-integration.html
[mise-mirrors]: https://mise.jdx.dev/url-replacements.html
[pixi-manifest]: https://pixi.prefix.dev/latest/reference/pixi_manifest/
[pixi-conda]: https://pixi.prefix.dev/latest/conda_ecosystem/
[pixi-lock]: https://pixi.prefix.dev/latest/workspace/lock_file/
[pixi-build]: https://pixi.prefix.dev/latest/build/backends/pixi-build-rattler-build/
[pixi-rust]: https://pixi.prefix.dev/latest/tutorials/rust/
[pixi-vscode]: https://pixi.prefix.dev/latest/integration/editor/vscode/
[pixi-publish]: https://pixi.prefix.dev/latest/reference/cli/pixi/publish/
[pixi-action]: https://github.com/prefix-dev/setup-pixi
[pixi-cache]: https://pixi.prefix.dev/latest/reference/cli/pixi/clean/cache/
[pixi-mirrors]: https://pixi.prefix.dev/latest/reference/pixi_configuration/#mirror-configuration
[rust-targets]: https://rust-lang.github.io/rustup/cross-compilation.html
[conda-channel]: https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/create-custom-channels.html
[github-cache]: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
[github-large-files]: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
[deno-release]: https://github.com/denoland/deno/releases/tag/v2.8.3
[bun-release]: https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4
[wasmtime-release]: https://github.com/bytecodealliance/wasmtime/releases/tag/v45.0.2
[wasmer-release]: https://github.com/wasmerio/wasmer/releases/tag/v7.1.0
[cf-node]: https://api.anaconda.org/release/conda-forge/nodejs/26.12.1
[cf-rust]: https://api.anaconda.org/release/conda-forge/rust/1.99.1
[cf-tsgo]: https://api.anaconda.org/release/conda-forge/typescript-go/7.0.2
[cf-ts]: https://api.anaconda.org/release/conda-forge/typescript/7.0.2
[cf-deno]: https://api.anaconda.org/release/conda-forge/deno/2.8.3
[cf-bun]: https://api.anaconda.org/release/conda-forge/bun/1.4.4
[cf-wasmtime]: https://api.anaconda.org/release/conda-forge/wasmtime/45.0.2
[cf-wasmer]: https://api.anaconda.org/release/conda-forge/wasmer/7.1.0
[cf-spidermonkey]: https://api.anaconda.org/release/conda-forge/spidermonkey/140.14.0
[mozilla-shells]: https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/jsshell/
[mozilla-checksums]: https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/SHA256SUMS
[sm-linux-x64]: https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/jsshell/jsshell-linux-x86_64.zip
[sm-linux-arm64]: https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/jsshell/jsshell-linux-aarch64.zip
[sm-macos]: https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/jsshell/jsshell-mac.zip
[sm-windows-x64]: https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/jsshell/jsshell-win64.zip
[sm-windows-arm64]: https://archive.mozilla.org/pub/firefox/releases/140.14.0esr/jsshell/jsshell-win64-aarch64.zip
[repo-pins]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/fjs/ci/config/module.f.js
[repo-flake]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/gen.nix/flake.nix
[repo-ci]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/.github/workflows/gen.ci.yml
[repo-gen]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/fjs/dev/gen/module.f.mjs
[repo-rust]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/fjs/ci/rust/module.f.mjs
[repo-cache]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/fjs/ci/cache/inputs/module.f.js
[repo-smart]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/fjs/ci/smart/module.f.mjs
[repo-dev]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/dev.sh
[repo-container]: https://github.com/functionalscript/functionalscript/blob/c162c3ae732207c43b49c2d8c42b716937ea418a/.devcontainer/devcontainer.json

### Related

- [Tool configuration](../config/module.f.js) — exact supported tool versions.
- [Nix environment](../nix/README.md) — current development environment.
- [CI](../README.md) — platform jobs and generated workflows.
- [CI caching](./096-ci-caching.md) — related cache investigation.
