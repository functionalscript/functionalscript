# pixi development environment

This branch uses pixi for development and every CI host. Install
[pixi](https://pixi.sh)
(0.83.0) before initialization.

```sh
# Install rustup first: https://rustup.rs/
sh ./dev-setup.sh
./dev.sh node --version
./dev.sh npm ci
./dev.sh tsc
./dev.sh npm start test
```

`./dev.sh` opens a shell; arguments run one command in the selected environment.
On Windows, run initialization in Git Bash with rustup on PATH. PowerShell
commands use `pixi run --locked --environment ci <command>` after initialization.
The CI profile uses the supported npm TypeScript 7.0.2 and Bun 1.4.4. The cached
Conda default profile (Rust 1.99.0, TypeScript 6.0.2) is still available explicitly
as `pixi run --environment default`; its compiler cannot emit the supported
package declarations, so development and packaging use `ci`.

## Host prerequisites

| Host | Prerequisites |
| --- | --- |
| Linux | Native C compiler and libc headers |
| Linux x64 i686 | `gcc-multilib libc6-dev-i386` plus target standard library |
| macOS | Xcode Command Line Tools |
| Windows | MSVC build tools and Windows SDK; Git Bash for shell scripts |

The devcontainer installs the manager, native build prerequisites, and initializes
the mounted checkout. Rebuild it after Dockerfile changes. Manager installations
do not replace platform SDKs.

## Runtime supplements

`pixi.toml` and `pixi.lock` provide the locked native Node environment on all six
hosts. `dev-setup.sh` installs supported npm compiler/Bun/Deno versions locally
and rustup's supported toolchain and targets. These supplements are explicit
because the cached Conda compiler and Bun versions failed declaration emission
and serializer tests. CI installs the same compiler and Bun supplements.

CI's Linux ARM64 profile additionally supplies Deno 2.8.3 and Wasmer 7.5.0.
For local Wasmer on other supported hosts, `pixi run --locked --environment
runtimes wasmer --version` selects the optional cached profile. That profile has
no Windows ARM64 package. Its SpiderMonkey package contains libraries and
headers, not the JavaScript shell, and stays in an isolated profile because of
ICU conflicts.

On Linux, the upstream Wasmtime and SpiderMonkey installers are available:

```sh
pixi run --locked --environment ci sh fjs/ci/pixi/install-supplements.sh wasmtime 45.0.2
pixi run --locked --environment ci sh fjs/ci/pixi/install-supplements.sh spidermonkey 140.14.0
```

Archive digests are verified before extraction. For local WASM checks outside
Linux ARM64, install Wasmer on PATH as well, or provide a wrapper that invokes
`pixi run --locked --environment runtimes wasmer` to the Cargo runner. Native
runtime availability remains platform-specific; none of these steps need Nix.

## Regeneration and updates

`./dev.sh npm run gen` writes all generated source and workflows using Node.
Tool lock updates are separate: update central pins and manifests together,
refresh manager locks for every platform and commit any npm sidecars. Run
scoped checks before pushing; CI validates all nine jobs. The generic `fjs ci`
command requires the caller's committed manager manifest and lock.
