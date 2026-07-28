/**
 * Centralized version pins and OS images used by the CI generator: runner
 * images, container base image, tool versions (Bun, Deno, Playwright, Rust,
 * Rustup, Node, Wasmtime, Wasmer, TSGO).
 *
 * Every pin here is an exact version: the generated workflow and the generated
 * `docker/Dockerfile` both read from this module, so a bump lands in both.
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

// Base image of the generated `docker/Dockerfile`. A date-stamped Ubuntu
// 26.04 snapshot: immutable, unlike the rolling `26.04` tag, and the same
// distribution release as the `ubuntu-26.04` GitHub-hosted runners, so
// Playwright's `install --with-deps` resolves the packages it does in CI.
// https://hub.docker.com/_/ubuntu/tags
export const dockerBase = 'ubuntu:resolute-20260707'

// Archive snapshot the image's `apt` sources are repointed at. The base image
// tag only pins the initial filesystem — `apt-get update` would otherwise
// resolve whatever the archive holds on the day of the build — so this pins
// the packages too. Move it with `dockerBase`; the service serves every
// architecture and its `Release` files carry no `Valid-Until`.
// https://snapshot.ubuntu.com/
export const dockerSnapshot = '20260707T000000Z'

// Bootstrap package version used by generated smoke tests. Keep this on a
// published FunctionalScript release; do not tie it to package.json's current
// in-repo version.
// https://www.npmjs.com/package/functionalscript
export const functionalscript = '0.38.0' as const

// https://bun.sh/
export const bun = '1.3.14'

// https://deno.com/
export const deno = '2.9.4'

// https://www.npmjs.com/package/playwright
export const playwright = '1.62.0'

// https://nodejs.org/en/download
export const node = {
    default: '26.5.0',
    node22: '22.23.1',
    node24: '24.18.0',
} as const

// Installer used by the container image to pin the Rust toolchain; the
// toolchain version itself is `actions['dtolnay/rust-toolchain']`.
// https://static.rust-lang.org/rustup/release-stable.toml
export const rustup = '1.29.0'

// https://github.com/bytecodealliance/wasmtime/releases
export const wasmtime = '47.0.2'

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
    // https://rust-lang.org/ - value is Rust version, not action version
    'dtolnay/rust-toolchain': '1.97.1',
} as const
