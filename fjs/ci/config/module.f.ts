/**
 * Centralized version pins and OS images used by the CI generator: runner
 * images, tool versions (Bun, Deno, Playwright, Rust, Node, Wasmtime, Wasmer,
 * TSGO).
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
export const functionalscript = '0.38.0' as const

// https://bun.sh/
export const bun = '1.3.14'

// https://deno.com/
export const deno = '2.9.3'

// https://www.npmjs.com/package/playwright
export const playwright = '1.61.1'

// https://nodejs.org/en/download
export const node = {
    default: '26.5.0',
    node22: '22.23.1',
    node24: '24.18.0',
} as const

// https://github.com/bytecodealliance/wasmtime/releases
export const wasmtime = '47.0.2'

// https://github.com/wasmerio/wasmer/releases
export const wasmer = '7.2.0'

// GitHub Action versions used by CI step builders. The key is the action
// `owner/name`; call sites compose the full ref as
// `` `${name}@${actions[name]}` ``.
// Note: dtolnay/rust-toolchain value is a Rust version, not an action version.
export const actions = {
    // https://github.com/marketplace/actions/checkout
    'actions/checkout': 'v7',
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
