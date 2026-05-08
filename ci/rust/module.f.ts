import { wasmer, wasmtime } from '../config/module.f.ts'
import { type Architecture, type MetaStep, type Os, install, test } from '../common/module.f.ts'

const cargoTest = (target?: string, config?: string): readonly MetaStep[] => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    const main = `cargo test${to}${co}`
    return [
        test({ run: main }),
        test({ run: `${main} --release` })
    ]
}

const customTarget = (target: string): readonly MetaStep[] => [
    { type: 'rust', target },
    ...cargoTest(target)
]

const wasmTarget = (target: string): readonly MetaStep[] => [
    ...customTarget(target),
    ...cargoTest(target, '.cargo/config.wasmer.toml')
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

export const rustSteps = (a: Architecture, v: Os): readonly MetaStep[] => [
    test({ run: 'cargo fmt -- --check' }),
    test({ run: 'cargo clippy -- -D warnings' }),
    ...cargoTest(),
    install({
        uses: 'bytecodealliance/actions/wasmtime/setup@v1',
        with: { version: wasmtime }
    }),
    install({
        uses: 'wasmerio/setup-wasmer@v3.1',
        with: { version: `v${wasmer}` },
    }),
    ...wasmTarget('wasm32-wasip1'),
    ...wasmTarget('wasm32-wasip2'),
    ...wasmTarget('wasm32-unknown-unknown'),
    ...wasmTarget('wasm32-wasip1-threads'),
    ...i686(a, v),
]
