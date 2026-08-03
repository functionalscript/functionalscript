/**
 * Centralized version pins and OS images used by the CI generator: runner
 * images, tool versions (Bun, Deno, Rust, Node, Wasmtime, Wasmer, TSGO).
 *
 * @module
 */
// https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories
export const images = {
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
} as const

// Bootstrap package version used by generated smoke tests. Keep this on a
// published FunctionalScript release; do not tie it to package.json's current
// in-repo version.
// https://www.npmjs.com/package/functionalscript
export const functionalscript = '0.39.0' as const

// https://bun.sh/
export const bun = '1.3.14'

// https://deno.com/
export const deno = '2.9.4'

// The Node versions the pinned Nixpkgs snapshot below provides — read from
// `pkgs/development/web/nodejs/v{22,24,26}.nix` at that commit. Every runtime
// uses these: `setup-node` on the GitHub-hosted runners and the generated
// flakes on the Nix jobs, which assert the version they actually get. Nixpkgs
// usually trails nodejs.org, so bump the snapshot first and copy the versions
// it offers rather than the latest release.
// https://nodejs.org/en/download
export const node = {
    default: '26.5.1',
    node22: '22.23.2',
    node24: '24.18.0',
} as const

// Official Nixpkgs snapshot used by the generated CI flakes. `ref` is the
// stable channel the commit is accepted from; `commit` is the exact revision
// every generated `flake.nix` pins. The Node versions above come from this
// snapshot, so the two move together.
// https://channels.nixos.org/nixos-26.05/git-revision
export const nixpkgs = {
    ref: 'nixos-26.05',
    commit: '6d65bfc1bcef2ef39a239d38e577e92a89fb0f07',
} as const

// https://github.com/bytecodealliance/wasmtime/releases
export const wasmtime = '47.0.3'

// https://github.com/wasmerio/wasmer/releases
export const wasmer = '7.2.1'

// GitHub Action versions used by CI step builders. The key is the action
// `owner/name`; call sites compose the full ref as
// `` `${name}@${actions[name]}` ``.
// Note: dtolnay/rust-toolchain value is a Rust version, not an action version.
export const actions = {
    // https://github.com/marketplace/actions/checkout
    'actions/checkout': 'v7.0.1',
    // https://github.com/marketplace/actions/setup-node-js-environment
    'actions/setup-node': 'v7.0.0',
    // https://github.com/marketplace/actions/cache
    'actions/cache': 'v6.1.0',
    // https://github.com/marketplace/actions/setup-deno
    'denoland/setup-deno': 'v2.0.5',
    // https://github.com/marketplace/actions/setup-bun
    'oven-sh/setup-bun': 'v2.2.0',
    // https://github.com/bytecodealliance/actions
    'bytecodealliance/actions/wasmtime/setup': 'v1.1.3',
    // https://github.com/wasmerio/setup-wasmer
    'wasmerio/setup-wasmer': 'v3.1',
    // https://github.com/marketplace/actions/install-nix
    // Enables the `nix-command` and `flakes` experimental features by default.
    'cachix/install-nix-action': 'v31.11.0',
    // https://rust-lang.org/ - value is Rust version, not action version
    'dtolnay/rust-toolchain': '1.97.1',
} as const
