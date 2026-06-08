/**
 * CI step builder for the Rust crate: platform compatibility jobs run native
 * and Intel-only `i686` tests, while the canonical WASM job installs Wasmtime
 * and Wasmer before exercising every WASM target.
 *
 * @module
 */
import { wasmer, wasmtime } from '../config/module.f.ts'
import { type Architecture, type MetaStep, type Os, install, test, uses } from '../common/module.f.ts'

const cargoTestCommand = (target?: string, config?: string): string => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    return `cargo test${to}${co}`
}

const cargoTest = (target?: string, config?: string): MetaStep =>
    test({ run: cargoTestCommand(target, config) })

const cargoTestPair = (target: string, config?: string): readonly MetaStep[] => {
    const main = cargoTestCommand(target, config)
    return [
        cargoTest(target, config),
        test({ run: `${main} --release` })
    ]
}

const customTarget = (target: string): readonly MetaStep[] => [
    { type: 'rust', target },
    cargoTest(target)
]

const wasmTarget = (target: string): readonly MetaStep[] => [
    { type: 'rust', target },
    ...cargoTestPair(target),
    ...cargoTestPair(target, '.cargo/config.wasmer.toml')
]

const i686 = (a: Architecture, v: Os): readonly MetaStep[] => {
    if (a === 'intel') {
        switch (v) {
            case 'windows': return customTarget('i686-pc-windows-msvc')
            case 'ubuntu': return [
                { type: 'apt-get', package: 'libc6-dev-i386' } as const,
                ...customTarget('i686-unknown-linux-gnu'),
            ]
        }
    }
    return []
}

export const rustPlatformSteps = (v: Os, a: Architecture): readonly MetaStep[] => [
    cargoTest(),
    ...i686(a, v),
]

export const rustWasmSteps: readonly MetaStep[] = [
    test({ run: 'cargo fmt -- --check' }),
    test({ run: 'cargo clippy -- -D warnings' }),
    install(uses('bytecodealliance/actions/wasmtime/setup', { version: wasmtime })),
    install(uses('wasmerio/setup-wasmer', { version: `v${wasmer}` })),
    ...wasmTarget('wasm32-wasip1'),
    ...wasmTarget('wasm32-wasip2'),
    ...wasmTarget('wasm32-unknown-unknown'),
    ...wasmTarget('wasm32-wasip1-threads'),
]
