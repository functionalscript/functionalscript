/**
 * Centralized version pins and OS images used by the CI generator: runner
 * images, tool versions (Bun, Deno, Rust, Node, Wasmtime, Wasmer, TSGO).
 *
 * @module
 */

// https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories
export const images = /** @type {const} */({
    ubuntu: {
        intel: 'ubuntu-26.04',
        arm: 'ubuntu-26.04-arm'
    },
    macos: {
        intel: 'macos-26-intel',
        arm: 'macos-26'
    },
    windows: {
        intel: 'windows-2025',
        arm: 'windows-11-arm',
    }
})

// Bootstrap package version used by generated smoke tests. Keep this on a
// published FunctionalScript release; do not tie it to package.json's current
// in-repo version.
// https://www.npmjs.com/package/functionalscript
export const functionalscript = /** @type {const} */ '0.47.0'

// Bun is installed by `setup-bun`, so this is a released Bun rather than a
// packaged one. It is the last canonical *runtime* job not on a flake: Nixpkgs
// ships 1.3.13, on which two of this repository's proofs fail — one a real
// difference in when `Symbol.species` is read, not a slow machine. See
// `../todo/bun-nix-blocked-on-nixpkgs.md`.
// https://bun.sh/
export const bun = '1.4.0'

// The Deno version the pinned Nixpkgs snapshot below provides — read from
// `pkgs/by-name/de/deno/package.nix` at that commit. The job asserts the
// version its flake gives it, so this is checked rather than trusted. Nixpkgs
// trails deno.com, so bump the snapshot first and copy the version it offers.
// https://deno.com/
export const deno = '2.8.3'

// The Node versions the pinned Nixpkgs snapshot below provides — read from
// `pkgs/development/web/nodejs/v{22,24,26}.nix` at that commit. They feed the
// canonical jobs' flakes, which assert the version they actually get, as well
// as the `setup-node` steps left in the platform matrix and `package-check`.
// Nixpkgs usually trails nodejs.org, so bump the snapshot first and copy the
// versions it offers rather than the latest release.
// https://nodejs.org/en/download
export const node = /** @type {const} */({
    default: '26.7.0',
    node22: '22.23.2',
    node24: '24.19.0',
})

// The Rust the `wasm` job's flake provides, resolved by `rust-overlay` from
// the official release manifest — so unlike the Nixpkgs pins below, this is an
// exact release rather than whatever a snapshot happens to carry, and the flake
// text names it in full. It is also the version the platform matrix's
// `dtolnay/rust-toolchain` installs; the two are the same constant so they
// cannot drift.
// https://rust-lang.org/
export const rust = '1.98.0'

// Official Nixpkgs snapshot used by the generated CI flakes. `ref` is the
// stable channel the commit is accepted from; `commit` is the exact revision
// every generated `flake.nix` pins. The Node versions above come from this
// snapshot, so the two move together.
// https://channels.nixos.org/nixos-26.05/git-revision
export const nixpkgs = /** @type {const} */({
    ref: 'nixos-26.05',
    commit: '062346a6d85bc4b49dfaa61c986e9c5be21217d1',
})

// Wasmtime and Wasmer are installed by their own setup actions, so these are
// released versions rather than packaged ones. The `wasm` job is not on a flake:
// Nixpkgs builds no `std` for three of its four WASI targets, so the toolchain it
// needs cannot come from the snapshot at all. See
// `../todo/wasm-nix-blocked-on-rust-targets.md`.
// `rust-overlay`, the second input of the `wasm` job's flake. Nixpkgs builds
// one `rustc` and hard-codes the targets it builds `std` for — the host,
// `wasm32-unknown-unknown` and two bare-metal targets — so three of that job's
// four targets have no `std` at any Nixpkgs version. This overlay takes the
// same tarballs `rustup` would, pinned by hashes checked into its own
// repository. `ref` is the branch the commit is accepted from.
// https://github.com/oxalica/rust-overlay
export const rustOverlay = /** @type {const} */({
    ref: 'master',
    commit: '996e9b0b019a4a9eb9e9a5641aefa06d801b5895',
})

// The Wasmtime and Wasmer versions the pinned Nixpkgs snapshot provides — read
// from `pkgs/by-name/wa/{wasmtime,wasmer}/package.nix` at that commit. The
// `wasm` job asserts both from inside its shell, which is the only tie there
// is: neither attribute carries a version, so nothing else connects these
// numbers to what the shell provides. Bump the snapshot first and copy what it
// offers, as the Node and Deno pins do.
// https://github.com/bytecodealliance/wasmtime/releases
export const wasmtime = '45.0.2'

// https://github.com/wasmerio/wasmer/releases
export const wasmer = '7.1.0'

// GitHub Action versions used by CI step builders. The key is the action
// `owner/name`; call sites compose the full ref as
// `` `${name}@${actions[name]}` ``.
// Note: dtolnay/rust-toolchain value is a Rust version, not an action version.
export const actions = /** @type {const} */({
    // https://github.com/marketplace/actions/checkout
    'actions/checkout': 'v7.0.1',
    // https://github.com/marketplace/actions/setup-node-js-environment
    'actions/setup-node': 'v7.0.0',
    // https://github.com/marketplace/actions/setup-bun
    'oven-sh/setup-bun': 'v2.2.0',
    // https://github.com/marketplace/actions/cache
    'actions/cache': 'v6.1.0',
    // https://github.com/marketplace/actions/upload-a-build-artifact
    'actions/upload-artifact': 'v7.0.1',
    // https://github.com/marketplace/actions/download-a-build-artifact
    'actions/download-artifact': 'v8.0.1',
    // https://github.com/marketplace/actions/install-nix
    // Enables the `nix-command` and `flakes` experimental features by default.
    'cachix/install-nix-action': 'v31.11.1',
    // https://rust-lang.org/ - value is Rust version, not action version
    'dtolnay/rust-toolchain': rust,
})
