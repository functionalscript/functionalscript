## 65Z-ci-nix. Generate one CI flake from official Nixpkgs

**Priority:** P3
**Status:** open

### Problem

Linux and macOS CI install the same top-level tools as Windows, but through
separate generated setup steps. The previous Nix proposal also recreated package
recipes, upstream URLs, hashes, installation logic, target-specific flakes, and
lock metadata in the FunctionalScript generator.

That is too much machinery for the first Nix milestone. Official Nixpkgs already
contains package definitions, dependency graphs, platform fixes, and binary-cache
artifacts. FunctionalScript should initially use only versions already available
from one official stable Nixpkgs snapshot.

Windows still requires exact version strings for its native installers. Therefore,
the selected Nixpkgs snapshot and the cross-platform version constants in
`fjs/ci/config/module.f.ts` must be updated together.

### Proposal

Use one configured official stable Nixpkgs ref, for example `nixos-26.05`, and one
explicit update command:

```sh
npm run ci-nix-update
```

The command runs on a documented Nix-capable host and performs these steps in
order:

1. resolve the latest GitHub commit of the configured official stable Nixpkgs ref;
2. read the versions of the configured Nix package attributes on every supported
   Nix host;
3. update the exact Nixpkgs commit and top-level package versions in
   `fjs/ci/config/module.f.ts`;
4. run the ordinary CI generator, which emits one root `flake.nix`;
5. leave the config and generated flake changes ready to commit and review.

The first implementation generates and commits only `flake.nix`. It does not add
OCI outputs, custom derivations, overlays, a private package source, or multiple
per-job flakes.

After the generated flake builds and reports the expected versions on Linux and
macOS, existing CI jobs can start invoking it directly. Windows continues using
its native setup path with the exact versions copied from the selected Nixpkgs
snapshot.

### Configuration

Keep the existing exact version constants because they are the cross-platform CI
contract. Add only the Nixpkgs source and package-attribute mapping:

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
        playwright: 'playwright-driver',
        node: {
            default: 'nodejs_26',
            node22: 'nodejs_22',
            node24: 'nodejs_24',
        },
        rust: {
            rustc: 'rustc',
            cargo: 'cargo',
        },
        wasmtime: 'wasmtime',
        wasmer: 'wasmer',
    },
} as const
```

The exact attribute names are validated against the selected snapshot. A package
attribute is accepted only when it exists on all required Nix systems and reports
the same expected version.

The update command owns changes to `nix.nixpkgs.rev` and the existing top-level
version constants. Ordinary `npm run update` and `npm run ci-update` never resolve
a moving Nixpkgs ref and remain runnable on native Windows.

### Generated `flake.nix`

Generate one root file with the exact commit embedded in the input URL:

```nix
{
  inputs.nixpkgs.url =
    "github:NixOS/nixpkgs/<configured-exact-commit>";

  outputs = { nixpkgs, ... }:
    # Generated shells and checks for the supported systems.
    { };
}
```

The generated file should:

- support `x86_64-linux`, `aarch64-linux`, `x86_64-darwin`, and
  `aarch64-darwin`;
- use only configured package attributes from official Nixpkgs;
- expose a default development/CI shell containing the selected tools;
- assert each package's Nix metadata version against the exact config version;
- include executable checks such as `node --version`;
- add required Rust compilation targets and environment variables;
- keep the existing CI commands outside the package definitions;
- contain a generated-file header and never be edited manually.

Do not generate `flake.lock` in this first milestone. The exact Git commit in the
input URL pins the package source. Initial validation and CI commands must prevent
Nix from writing an uncommitted lock file, for example with the appropriate
`--no-write-lock-file` option. Adding a committed lock file can be evaluated later
as a separate improvement.

### Version synchronization

The update command queries every configured attribute for every supported system.
For example, Node 26 is accepted only when all supported systems expose:

```text
nodejs_26.version = 26.5.0
```

It then writes `26.5.0` to `node.default`. Linux and macOS obtain
`pkgs.nodejs_26`; Windows installs `node.default` through the existing native
setup action. Both paths run an executable version check.

If the latest stable Nixpkgs snapshot does not contain a required package,
platform, or matching version, the update command fails without changing the
config. We do not create a custom package in this phase. A FunctionalScript
package source or overlay may be proposed later after a concrete missing-package
case exists.

### CI adoption

CI adoption is a separate follow-up after the generated file is committed and
validated:

1. install Nix on Linux and macOS runners using a pinned action;
2. run `nix flake check` without rewriting inputs;
3. run the existing CI commands inside the generated default shell;
4. compare the Nix-backed jobs with the existing setup-action jobs;
5. remove old Linux/macOS setup steps only after equivalent coverage is proven.

OCI images remain later work. They may eventually be built from the same proven
flake, but they are not part of generating or validating the first file.

### Tasks

- [ ] Add a configured official stable Nixpkgs ref and exact revision to
      `fjs/ci/config/module.f.ts`.
- [ ] Add Nix package-attribute mappings for the top-level CI tools.
- [ ] Extract Rust into a normal exact version constant shared by Windows and Nix.
- [ ] Add `npm run ci-nix-update` for resolving the latest stable commit and
      querying package versions on all supported Nix systems.
- [ ] Make the command update the exact commit and existing version constants
      together.
- [ ] Fail the update when a package is missing, broken, unsupported, or reports
      different versions across required systems.
- [ ] Extend `npm run ci-update` to generate one root `flake.nix` without invoking
      Nix or accessing the network.
- [ ] Generate metadata and executable version checks from the config.
- [ ] Commit the generated `flake.nix` and preserve
      `git add -A && git diff --cached --exit-code` in the regeneration check.
- [ ] Validate the committed flake on all supported Linux and macOS runners
      without writing a lock file.
- [ ] Add a follow-up CI phase that runs existing Linux/macOS commands through the
      validated flake.

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  implementation sequence.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source whose release points to an immutable GitHub Nixpkgs commit.
