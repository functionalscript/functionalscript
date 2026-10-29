/**
 * Centralized version pins and OS images used by the CI generator: runner
 * images, tool versions (Bun, Deno, Rust, Node, Wasmtime, Wasmer, TSGO).
 *
 * @module
 */

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

export const functionalscript = /** @type {const} */ '0.57.0'

export const bun = '1.4.4'

export const deno = '2.9.8'

export const node = /** @type {const} */ ('26.13.0')

export const typescript = /** @type {const} */({
    version: '7.0.2',
})

export const rust = '1.99.1'

export const jobTimeout = /** @type {const} */ (30)

export const wasmtime = '50.0.0'

export const wasmer = '7.5.0'

export const spidermonkey = /** @type {const} */ ({
    version: '153.6.0',
})

export const actions = /** @type {const} */({
    'jdx/mise-action': 'v5',
    'actions/checkout': 'v7.0.1',
    'actions/setup-node': 'v7.1.0',
    'actions/cache': 'v6.1.0',
    'dtolnay/rust-toolchain': rust,
})
