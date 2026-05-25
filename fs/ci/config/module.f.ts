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
        intel: 'ubuntu-24.04',
        arm: 'ubuntu-24.04-arm'
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

// https://bun.sh/
export const bun = '1.3.14'

// https://deno.com/
export const deno = '2.8.0'

// https://www.npmjs.com/package/playwright
export const playwright = '1.60.0'

// https://rust-lang.org/
export const rust = '1.95.0'

// https://nodejs.org/en/download
export const node = {
    default: '26.2.0',
    others: ['22.22.3', '24.16.0'],
} as const

// https://github.com/bytecodealliance/wasmtime/releases
export const wasmtime = '44.0.1'

// https://github.com/wasmerio/wasmer/releases
export const wasmer = '7.1.0'

// https://www.npmjs.com/package/@typescript/native-preview?activeTab=versions
export const tsgo = '7.0.0-dev.20260524.1'
