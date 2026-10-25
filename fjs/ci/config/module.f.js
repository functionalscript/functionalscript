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

export const functionalscript = /** @type {const} */ '0.56.0'

export const bun = '1.4.4'

export const deno = '2.8.3'

export const node = /** @type {const} */ ('26.12.1')

export const typescript = /** @type {const} */({
    version: '7.0.2',
})

export const rust = '1.99.1'

export const jobTimeout = /** @type {const} */ (30)

export const wasmtime = '45.0.2'

export const wasmer = '7.1.0'

export const spidermonkey = /** @type {const} */ ({
    version: '140.14.0',
})

export const pixiTypescript = '7.0.2'
export const pixiBun = '1.4.4'
export const pixiWasmer = '7.5.0'

export const actions = /** @type {const} */({
    'prefix-dev/setup-pixi': 'v0.11.2',
    'actions/checkout': 'v7.0.1',
    'actions/setup-node': 'v7.1.0',
    'actions/cache': 'v6.1.0',
    'dtolnay/rust-toolchain': rust,
})
