## 65Z-ci-nix. Generate standalone CI flakes from official Nixpkgs

**Priority:** P3
**Status:** open

### Problem

Linux and macOS CI install the same top-level tools as Windows, but through
separate generated setup steps. The earlier Nix proposal also recreated package
recipes, upstream URLs, hashes, installation logic, and lock metadata inside the
FunctionalScript generator.

That is too much machinery for the first Nix milestone. Official Nixpkgs already
contains package definitions, dependency graphs, platform fixes, and binary-cache
artifacts. FunctionalScript should initially use only versions already available
from one official stable Nixpkgs snapshot.

Windows still requires exact version strings for native installers. The selected
Nixpkgs snapshot and the cross-platform version constants in
`fjs/ci/config/module.f.ts` must therefore be updated together.

A single shell cannot represent the existing Node 22, 24, and 26 matrix. All three
packages expose `node` and `npm`, and the jobs also run different command
sequences. Replacing them with one shell or one generic `npm test` command would
silently change CI coverage.

Rust also requires more than `rustc` and Cargo. Existing CI uses rustfmt, Clippy,
the `i686-unknown-linux-gnu` standard library and linker support, and these WASM
target standard libraries:

- `wasm32-wasip1`;
- `wasm32-wasip2`;
- `wasm32-unknown-unknown`;
- `wasm32-wasip1-threads`.

A Rust or WASM flake is not equivalent to the current setup until every component,
target provider, linker/runtime dependency, and existing command passes.

### Proposal

Use one configured official stable Nixpkgs ref, initially `nixos-26.05`, and one
explicit update command:

```sh
npm run ci-nix-update
```

The command treats the complete configured Nix environment set as one atomic
snapshot:

1. resolve a candidate latest GitHub commit of the configured stable Nixpkgs ref;
2. evaluate every configured package and provider on every system that uses it,
   without changing maintained files;
3. verify every configured Rust component, target standard library, linker, and
   runtime package;
4. verify all other configured environments, including Playwright package and
   lockfile synchronization after Playwright is added to the configured set;
5. reject the complete candidate when any configured requirement fails;
6. after every check succeeds, atomically update the shared Nixpkgs revision,
   top-level versions, and synchronized dependency metadata;
7. generate the complete standalone flake tree from the accepted configuration;
8. leave all changes ready to commit and review.

A rejected candidate must preserve the previous revision, version constants,
package metadata, lockfiles, and generated flake tree.

Snapshot acceptance and generation are atomic. CI adoption is incremental: after
the complete generated set is committed and validated, individual jobs may switch
to their matching flakes at different times. Existing setup actions remain until
their replacements prove equivalent.

A future environment may remain explicitly outside the configured Nix set while
its requirements are being investigated. Once an environment is added to that
set, every later candidate revision must satisfy it. Silently dropping a configured
environment or omitting its generated flake is not a fallback.

### Configuration

Keep the existing exact version constants because they are the cross-platform CI
contract. Add the Nixpkgs source, package attributes, and complete Rust
requirements:

```ts
export const bun = '1.3.14'
export const deno = '2.9.4'
export const playwright = '1.62.0'

export const node = {
    default: '26.5.0',
    node22: '22.23.1',
    node24: '24.18.0',
} as const

export const rust = '1.97.1'
export const wasmtime = '47.0.2'
export const wasmer = '7.2.1'

export const nix = {
    nixpkgs: {
        ref: 'nixos-26.05',
        rev: '<exact-github-commit>',
    },
    packages: {
        bun: 'bun',
        deno: 'deno',
        node: {
            default: 'nodejs_26',
            node22: 'nodejs_22',
            node24: 'nodejs_24',
        },
        rust: {
            rustc: 'rustc',
            cargo: 'cargo',
            rustfmt: 'rustfmt',
            clippy: 'clippy',
        },
        wasmtime: 'wasmtime',
        wasmer: 'wasmer',
    },
    rustTargets: {
        platform: ['i686-unknown-linux-gnu'],
        wasm: [
            'wasm32-wasip1',
            'wasm32-wasip2',
            'wasm32-unknown-unknown',
            'wasm32-wasip1-threads',
        ],
    },
} as const
```

Playwright should remain outside `nix.packages` until
[playwright-package-version-sync](playwright-package-version-sync.md) is complete.
When Playwright is later added, the same exact version must be represented by:

- the Nixpkgs driver/browser bundle;
- `config.playwright`;
- the existing root `@playwright/test` dependency;
- `package-lock.json`;
- `deno.lock`;
- `bun.lock`.

The exact package and provider attribute names are validated against the candidate
snapshot. A package is accepted only when it exists on every system required by
its configured environment and reports the expected version.

The Rust target list is executable configuration, not documentation. For each
target, `ci-nix-update` must evaluate an official-Nixpkgs standard-library or
complete-toolchain provider and all required native support packages. For
`i686-unknown-linux-gnu`, this includes 32-bit linker and libc development/runtime
support on x86-64 Linux.

Because `nix.nixpkgs.rev` is shared, there is no per-environment revision fallback.
If a candidate cannot provide any configured package, component, target standard
library, linker, runtime, or synchronization requirement, the candidate is rejected
entirely before maintained files are changed.

### Update and generation commands

`npm run ci-nix-update` is the deliberate networked, Nix-capable operation that
selects a new snapshot and synchronizes versions.

Ordinary `npm run ci-update` only renders committed configuration. It must:

- remain runnable on native Windows;
- not invoke Nix;
- not resolve a moving Nixpkgs ref;
- not access the network;
- produce byte-identical generated files on Linux, macOS, and Windows.

The broader `npm run update` workflow is not required to be offline. It deliberately
updates project dependencies and lockfiles from registries. When it invokes
`npm run ci-update`, that nested CI-generation step remains network-free.

### Generated standalone flakes

Generate one self-contained flake directory per CI environment or incompatible
version family. The initial configured set may include:

```text
nix/generated/
  node22/flake.nix
  node24/flake.nix
  node26/flake.nix
  deno/flake.nix
  bun/flake.nix
  rust-platform/flake.nix
  rust-wasm/flake.nix
```

After Playwright synchronization is complete, the configured set may also include:

```text
nix/generated/playwright/flake.nix
```

Every generated `flake.nix` must:

- embed the exact accepted Nixpkgs Git commit;
- support only the systems used by its CI environment;
- use only configured official-Nixpkgs packages and providers;
- expose one unambiguous default shell;
- assert package metadata versions;
- provide executable version checks;
- include every required component, target, linker/runtime package, and environment
  variable;
- contain a generated-file warning;
- import no other generated Nix file.

The Node flakes each contain exactly one Node package:

```text
node22 -> pkgs.nodejs_22
node24 -> pkgs.nodejs_24
node26 -> pkgs.nodejs_26
```

CI must preserve each job's current ordered command sequence inside its matching
shell. The required sequences are:

```sh
# Node 22
npm install -g functionalscript@<configured-version>
npm ci
fjs t

# Node 24
npm ci
node --test

# Node 26
npm ci
npm run ci-update
git add -A && git diff --cached --exit-code
npx tsc
npm run cov
npm pack
```

These are not interchangeable and must not be replaced by a common `npm test`.
Checkout and Nix bootstrap remain workflow steps around these commands.

A Rust platform flake must provide `rustc`, Cargo, rustfmt, Clippy, and the host
standard library. On x86-64 Linux it must also provide the
`i686-unknown-linux-gnu` standard library, 32-bit linker, and libc support.

A Rust WASM flake must provide all four configured WASM target standard libraries,
Wasmtime, and Wasmer. Validation must compile and execute the same debug/release
and runner combinations as current CI. Listing a target name without successfully
compiling it is insufficient.

The generator owns the complete `nix/generated/` tree. Before writing accepted
outputs, it must recursively delete and recreate that directory from the current
configuration. Candidate validation happens before this destructive step, so a
rejected candidate cannot erase or partially replace the previous generated tree.

Do not generate `flake.lock` in this first milestone. Each flake input URL embeds
the exact immutable commit, and validation/CI must use the appropriate
`--no-write-lock-file` behavior. A committed lock file can be considered later.

### CI adoption

After the complete generated set is committed and validated:

1. install Nix through a pinned action on Linux and macOS;
2. evaluate and build each applicable flake without writing a lock;
3. run the exact existing job commands inside the matching shell;
4. compare Nix-backed and setup-action jobs in parallel;
5. remove an old setup path only after equivalent coverage is proven.

Rust/WASM adoption additionally requires equivalent rustfmt, Clippy, host, i686,
and WASM coverage. Playwright adoption remains blocked until its synchronization
TODO is complete and Playwright has been added to an atomically accepted snapshot.

OCI images remain later work and must reuse already validated flakes.

### Tasks

- [ ] Add the stable Nixpkgs ref and exact shared revision to
      `fjs/ci/config/module.f.ts`.
- [ ] Define the explicit environment set governed by that shared revision.
- [ ] Add package mappings for every configured top-level tool.
- [ ] Extract Rust into a shared exact version constant.
- [ ] Map `rustc`, Cargo, rustfmt, and Clippy.
- [ ] Record i686 and all four WASM targets in maintained configuration.
- [ ] Define and validate official-Nixpkgs target providers plus required
      linker/runtime packages.
- [ ] Add `npm run ci-nix-update`.
- [ ] Evaluate the complete candidate snapshot without modifying maintained files.
- [ ] Reject the complete candidate when any configured requirement fails.
- [ ] Atomically update the revision, versions, synchronized dependency metadata,
      and generated tree only after all configured environments pass.
- [ ] Preserve all previously accepted files after a rejected candidate.
- [ ] Keep Playwright outside the configured set until its package and all three
      tracked lockfiles can be synchronized.
- [ ] Keep the network-free requirement scoped to `npm run ci-update`.
- [ ] Delete and recreate the complete generated tree after candidate acceptance.
- [ ] Generate separate Node 22, 24, and 26 flakes.
- [ ] Preserve the exact Node 22, 24, and 26 command sequences.
- [ ] Keep every generated flake self-contained.
- [ ] Generate metadata and executable version checks.
- [ ] Validate Rust with rustfmt, Clippy, host, i686, and all WASM commands.
- [ ] Commit generated flakes and preserve
      `git add -A && git diff --cached --exit-code`.
- [ ] Validate every generated environment/system pair without writing a lock.
- [ ] Adopt matching flakes incrementally only after equivalent coverage is proven.

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  implementation sequence.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [playwright-package-version-sync](playwright-package-version-sync.md) — synchronize
  Playwright package metadata and all tracked lockfiles.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source resolving to an immutable GitHub Nixpkgs commit.
