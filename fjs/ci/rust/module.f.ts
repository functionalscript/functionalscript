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

const cargoReleaseClippy = (target?: string): MetaStep =>
    test({ run: `${cargoCommand('clippy', target)} --release -- -D warnings` })

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
    cargoClippy(target),
    cargoReleaseClippy(target)
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

// Wasmtime 47 removed wasi-threads, so the threads target runs under Wasmer
// only; Clippy needs no runner and stays. See todo/blocked/wasmtime-threads.md.
const wasmerOnlyTarget = (target: string): readonly MetaStep[] => [
    { type: 'rust', target },
    cargoClippy(target),
    cargoReleaseClippy(target),
    ...cargoTestPair(target, '.cargo/config.wasmer.toml')
]

/**
 * 32-bit Intel Linux: the Rust target and the package its `cargo` checks need.
 * The container image installs both on `amd64`, so it can host the Ubuntu Intel
 * job rather than only the checks that happen to need no cross-compilation.
 */
export const i686Linux = {
    target: 'i686-unknown-linux-gnu',
    // `gcc-multilib` supplies the 32-bit `libgcc` and startup files `cc -m32`
    // links against. `libc6-dev-i386` only *recommends* it, which is enough on
    // a runner but not in the image, where `--no-install-recommends` would
    // leave the linker without them.
    packages: ['libc6-dev-i386', 'gcc-multilib'],
} as const

const i686 = (a: Architecture, v: Os): readonly MetaStep[] => {
    if (a === 'intel') {
        switch (v) {
            case 'windows': return rustTarget('i686-pc-windows-msvc')
            case 'ubuntu': return [
                ...i686Linux.packages.map(p => ({ type: 'apt-get', package: p }) as const),
                ...rustTarget(i686Linux.target),
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

// Every WASM target the crate is checked against, mapped to how it is
// exercised. Also the target list installed into the container image, so the
// image and the generated workflow cannot drift apart.
const wasmTargetSteps = {
    'wasm32-wasip1': wasmTarget,
    'wasm32-wasip2': wasmTarget,
    'wasm32-unknown-unknown': wasmTarget,
    'wasm32-wasip1-threads': wasmerOnlyTarget,
} as const

export const wasmTargets: readonly string[] = Object.keys(wasmTargetSteps)

export const rustWasmSteps: readonly MetaStep[] = [
    test({ run: 'cargo fmt -- --check' }),
    install(uses('bytecodealliance/actions/wasmtime/setup', { version: wasmtime })),
    install(uses('wasmerio/setup-wasmer', { version: `v${wasmer}` })),
    ...Object.entries(wasmTargetSteps).flatMap(([target, steps]) => steps(target)),
]
