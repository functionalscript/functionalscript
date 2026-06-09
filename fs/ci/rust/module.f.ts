/**
 * CI step builder for the Rust crate: platform compatibility jobs run native
 * tests and Clippy, Intel jobs also run 32-bit target tests and Clippy, and the
 * canonical WASM job installs Wasmtime and Wasmer before exercising every WASM
 * target.
 *
 * @module
 */
import { wasmer, wasmtime } from '../config/module.f.ts'
import { type Architecture, type MetaStep, type Os, install, test, uses } from '../common/module.f.ts'

const cargoCommand = (tool: 'clippy' | 'test', target?: string, config?: string): string => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    return `cargo ${tool}${to}${co}`
}

const cargoTest = (target?: string, config?: string): MetaStep =>
    test({ run: cargoCommand('test', target, config) })

const cargoClippy = (target?: string): MetaStep =>
    test({ run: `${cargoCommand('clippy', target)} -- -D warnings` })

const cargoTestPair = (target: string, config?: string): readonly MetaStep[] => {
    const main = cargoCommand('test', target, config)
    return [
        cargoTest(target, config),
        test({ run: `${main} --release` })
    ]
}

const cargoReleaseTest = (target?: string): MetaStep =>
    test({ run: `${cargoCommand('test', target)} --release` })

const targetChecks = (target?: string): readonly MetaStep[] => [
    cargoTest(target),
    cargoReleaseTest(target),
    cargoClippy(target)
]

const rustTarget = (target: string): readonly MetaStep[] => [
    { type: 'rust', target },
    ...targetChecks(target)
]

const wasmTarget = (target: string): readonly MetaStep[] => [
    { type: 'rust', target },
    ...targetChecks(target),
    ...cargoTestPair(target, '.cargo/config.wasmer.toml')
]

const i686 = (a: Architecture, v: Os): readonly MetaStep[] => {
    if (a === 'intel') {
        switch (v) {
            case 'windows': return rustTarget('i686-pc-windows-msvc')
            case 'ubuntu': return [
                { type: 'apt-get', package: 'libc6-dev-i386' } as const,
                ...rustTarget('i686-unknown-linux-gnu'),
            ]
        }
    }
    return []
}

export const rustPlatformSteps = (v: Os, a: Architecture): readonly MetaStep[] => [
    { type: 'rust' },
    ...targetChecks(),
    ...i686(a, v),
]

export const rustWasmSteps: readonly MetaStep[] = [
    test({ run: 'cargo fmt -- --check' }),
    install(uses('bytecodealliance/actions/wasmtime/setup', { version: wasmtime })),
    install(uses('wasmerio/setup-wasmer', { version: `v${wasmer}` })),
    ...wasmTarget('wasm32-wasip1'),
    ...wasmTarget('wasm32-wasip2'),
    ...wasmTarget('wasm32-unknown-unknown'),
    ...wasmTarget('wasm32-wasip1-threads'),
]
