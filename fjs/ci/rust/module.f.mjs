/**
 * CI step builder for the Rust crate: platform compatibility jobs run native
 * tests and Clippy, Intel jobs also run 32-bit target tests and Clippy, and the
 * canonical WASM job installs Wasmtime and Wasmer before exercising every WASM
 * target.
 *
 * @module
 */
import { wasmer, wasmtime } from '../config/module.f.mjs'
import { install, test, uses } from '../common/module.f.mjs'
/** @import { Architecture, MetaStep, Os } from '../common/types.ts' */

/** @type {(tool: 'clippy' | 'test', target?: string, config?: string) => string} */
const cargoCommand = (tool, target, config) => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    return `cargo ${tool}${to}${co}`
}

/** @type {(target?: string, config?: string) => MetaStep} */
const cargoTest = (target, config) =>
    test({ run: cargoCommand('test', target, config) })

/** @type {(target?: string) => MetaStep} */
const cargoClippy = target =>
    test({ run: `${cargoCommand('clippy', target)} -- -D warnings` })

/** @type {(target?: string) => MetaStep} */
const cargoReleaseClippy = target =>
    test({ run: `${cargoCommand('clippy', target)} --release -- -D warnings` })

/** @type {(target: string, config?: string) => readonly MetaStep[]} */
const cargoTestPair = (target, config) => {
    const main = cargoCommand('test', target, config)
    return [
        cargoTest(target, config),
        test({ run: `${main} --release` })
    ]
}

/** @type {(target?: string) => MetaStep} */
const cargoReleaseTest = target =>
    test({ run: `${cargoCommand('test', target)} --release` })

/** @type {(target?: string) => readonly MetaStep[]} */
const targetChecks = target => [
    cargoTest(target),
    cargoReleaseTest(target),
    cargoClippy(target),
    cargoReleaseClippy(target)
]

/** @type {(target: string) => readonly MetaStep[]} */
const rustTarget = target => [
    { type: 'rust', target },
    ...targetChecks(target)
]

/** @type {(target: string) => readonly MetaStep[]} */
const wasmTarget = target => [
    { type: 'rust', target },
    ...targetChecks(target),
    ...cargoTestPair(target, '.cargo/config.wasmer.toml')
]

// Wasmtime 47 removed wasi-threads, so the threads target runs under Wasmer
// only; Clippy needs no runner and stays. See todo/blocked/wasmtime-threads.md.
/** @type {(target: string) => readonly MetaStep[]} */
const wasmerOnlyTarget = target => [
    { type: 'rust', target },
    cargoClippy(target),
    cargoReleaseClippy(target),
    ...cargoTestPair(target, '.cargo/config.wasmer.toml')
]

/** @type {(a: Architecture, v: Os) => readonly MetaStep[]} */
const i686 = (a, v) => {
    if (a === 'intel') {
        switch (v) {
            case 'windows': return rustTarget('i686-pc-windows-msvc')
            case 'ubuntu': return [
                { type: 'apt-get', package: 'libc6-dev-i386' },
                ...rustTarget('i686-unknown-linux-gnu'),
            ]
        }
    }
    return []
}

/** @type {(v: Os, a: Architecture) => readonly MetaStep[]} */
export const rustPlatformSteps = (v, a) => [
    { type: 'rust' },
    ...targetChecks(),
    ...i686(a, v),
]

/** @type {readonly MetaStep[]} */
export const rustWasmSteps = [
    test({ run: 'cargo fmt -- --check' }),
    install(uses('bytecodealliance/actions/wasmtime/setup', { version: wasmtime })),
    install(uses('wasmerio/setup-wasmer', { version: `v${wasmer}` })),
    ...wasmTarget('wasm32-wasip1'),
    ...wasmTarget('wasm32-wasip2'),
    ...wasmTarget('wasm32-unknown-unknown'),
    ...wasmerOnlyTarget('wasm32-wasip1-threads'),
]
