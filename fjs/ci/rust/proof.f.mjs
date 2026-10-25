
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { wasmer, wasmtime } from '../config/module.f.js'
import { environmentVersionStep } from '../environment/module.f.mjs'
import {
    i686Target,
    rustPlatformCommands,
    rustPlatformSteps,
    shellRustCommands,
    shellRustVersionSteps,
    wasmTargets,
} from './module.f.mjs'

export const proof = {
    // 32-bit *Linux* comes from the shell now, so the only platform job that
    // still asks `dtolnay/rust-toolchain` for a second target is Windows Intel.
    i686TargetIsWindowsOnly: () => {
        for (const o of /** @type {const} */ (['ubuntu', 'macos', 'windows'])) {
            for (const a of /** @type {const} */ (['intel', 'arm'])) {
                assertEq(
                    i686Target(o, a),
                    o === 'windows' && a === 'intel'
                        ? 'i686-pc-windows-msvc'
                        : undefined,
                    `${o}-${a}`)
            }
        }
    },
    // The native checks, named. A job on the shared shell runs these and gets
    // its toolchain from the environment manifest.
    platformCommands: () => {
        assertStructurallySame([...rustPlatformCommands], [
            'cargo test',
            'cargo test --release',
            'cargo clippy -- -D warnings',
            'cargo clippy --release -- -D warnings',
        ])
    },
    // Direct-install jobs need the toolchain markers as well as the commands.
    // Windows Intel alone adds a second target and its debug/release checks.
    platformSteps: () => {
        const native = /** @type {const} */ ([
            { type: 'rust' },
            { type: 'test', step: { run: 'cargo test' } },
            { type: 'test', step: { run: 'cargo test --release' } },
            { type: 'test', step: { run: 'cargo clippy -- -D warnings' } },
            { type: 'test', step: { run: 'cargo clippy --release -- -D warnings' } },
        ])
        assertStructurallySame(rustPlatformSteps('windows', 'intel'), [
            ...native,
            { type: 'rust', target: 'i686-pc-windows-msvc' },
            { type: 'test', step: { run: 'cargo test --target i686-pc-windows-msvc' } },
            { type: 'test', step: { run: 'cargo test --target i686-pc-windows-msvc --release' } },
            { type: 'test', step: { run: 'cargo clippy --target i686-pc-windows-msvc -- -D warnings' } },
            { type: 'test', step: { run: 'cargo clippy --target i686-pc-windows-msvc --release -- -D warnings' } },
        ])
        for (const [os, architecture] of /** @type {const} */ ([
            ['windows', 'arm'],
            ['macos', 'intel'],
        ])) {
            assertStructurallySame(rustPlatformSteps(os, architecture), native)
        }
    },
    // And on Intel Linux, those four and the 32-bit target's four — the job
    // `ubuntu-intel32` was, now that the shell it would have entered is the
    // one `ubuntu-intel` already enters.
    //
    // On ARM Linux, the formatting check first, the native four, and every
    // WASM target — the job `wasm` was, on the same image and in the same
    // shell.
    //
    // The two macOS platforms get the native four and nothing else, which is
    // the half worth asserting: `pkgsi686Linux` throws on their systems, so a
    // 32-bit command there would be a job whose shell cannot be built. Windows
    // is not among them — those two jobs have no shell, and `i686Target` is
    // what gives them their own 32-bit target.
    shellCommandsPerPlatform: () => {
        assertStructurallySame(
            [...shellRustCommands('ubuntu', 'intel')],
            [
                ...rustPlatformCommands,
                'cargo test --target i686-unknown-linux-gnu',
                'cargo test --target i686-unknown-linux-gnu --release',
                'cargo clippy --target i686-unknown-linux-gnu -- -D warnings',
                'cargo clippy --target i686-unknown-linux-gnu --release -- -D warnings',
            ])
        assertStructurallySame(
            [...shellRustCommands('ubuntu', 'arm')],
            [
                'cargo fmt -- --check',
                ...rustPlatformCommands,
                'cargo test --target wasm32-wasip1',
                'cargo test --target wasm32-wasip1 --release',
                'cargo clippy --target wasm32-wasip1 -- -D warnings',
                'cargo clippy --target wasm32-wasip1 --release -- -D warnings',
                'cargo test --target wasm32-wasip1 --config .cargo/config.wasmer.toml',
                'cargo test --target wasm32-wasip1 --config .cargo/config.wasmer.toml --release',
                'cargo test --target wasm32-wasip2',
                'cargo test --target wasm32-wasip2 --release',
                'cargo clippy --target wasm32-wasip2 -- -D warnings',
                'cargo clippy --target wasm32-wasip2 --release -- -D warnings',
                'cargo test --target wasm32-wasip2 --config .cargo/config.wasmer.toml',
                'cargo test --target wasm32-wasip2 --config .cargo/config.wasmer.toml --release',
                'cargo test --target wasm32-unknown-unknown',
                'cargo test --target wasm32-unknown-unknown --release',
                'cargo clippy --target wasm32-unknown-unknown -- -D warnings',
                'cargo clippy --target wasm32-unknown-unknown --release -- -D warnings',
                'cargo test --target wasm32-unknown-unknown --config .cargo/config.wasmer.toml',
                'cargo test --target wasm32-unknown-unknown --config .cargo/config.wasmer.toml --release',
                'cargo clippy --target wasm32-wasip1-threads -- -D warnings',
                'cargo clippy --target wasm32-wasip1-threads --release -- -D warnings',
                'cargo test --target wasm32-wasip1-threads --config .cargo/config.wasmer.toml',
                'cargo test --target wasm32-wasip1-threads --config .cargo/config.wasmer.toml --release',
            ])
        for (const [o, a] of /** @type {const} */ ([
            ['macos', 'intel'],
            ['macos', 'arm'],
        ])) {
            assertStructurallySame(
                [...shellRustCommands(o, a)],
                [...rustPlatformCommands],
                `${o}-${a}`)
        }
    },
    // The two WASM runtimes are asserted where the WASM checks run, and
    // nowhere else: a platform that runs no WASM has nothing to tie them to.
    shellVersionStepsPerPlatform: () => {
        assertStructurallySame(
            [...shellRustVersionSteps('ubuntu', 'arm')],
            [
                environmentVersionStep('wasmtime --version', `wasmtime ${wasmtime}`),
                environmentVersionStep('wasmer --version', `wasmer ${wasmer}`),
            ])
        for (const [o, a] of /** @type {const} */ ([
            ['ubuntu', 'intel'],
            ['macos', 'intel'],
            ['macos', 'arm'],
        ])) {
            assertStructurallySame([...shellRustVersionSteps(o, a)], [], `${o}-${a}`)
        }
    },
}
