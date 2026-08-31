/**
 * CI step builder for the Rust crate: platform compatibility jobs run native
 * tests and Clippy, Intel jobs also run 32-bit target tests and Clippy, and the
 * canonical WASM job exercises every WASM target inside its generated flake.
 *
 * The two families get their toolchain from different places, and the reason is
 * packaging rather than preference. The platform matrix runs on six runner
 * images across three operating systems, only one of which a generated flake
 * could serve, so it keeps `dtolnay/rust-toolchain`. The WASM job runs on one
 * Linux runner and can have a flake — but not one built from Nixpkgs alone:
 * Nixpkgs builds a single `rustc` and hard-codes the targets it builds `std`
 * for, and three of this job's four are not among them at any version. Its
 * flake takes the toolchain from `rust-overlay` instead, which unpacks the same
 * release artifacts `rustup` would.
 *
 * Both name `../config/module.f.mjs`'s `rust`, so the version cannot differ
 * between a platform job and this one.
 *
 * @module
 *
 * @import { Architecture, MetaStep, Os } from '../common/types.ts'
 * @import { NixRust } from '../nix/types.ts'
 */

import { rust, wasmer, wasmtime } from '../config/module.f.mjs'
import { test } from '../common/module.f.mjs'
import { nixInstall, nixShell, nixSteps, nixVersionStep } from '../nix/module.f.mjs'

/** @type {(tool: 'clippy' | 'test', target?: string, config?: string) => string} */
const cargoCommand = (tool, target, config) => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    return `cargo ${tool}${to}${co}`
}

/** @type {(target?: string) => string} */
const cargoClippy = target => `${cargoCommand('clippy', target)} -- -D warnings`

/** @type {(target?: string) => string} */
const cargoReleaseClippy = target =>
    `${cargoCommand('clippy', target)} --release -- -D warnings`

/** Debug and release, tests then Clippy — the check set every target gets. */
/** @type {(target?: string) => readonly string[]} */
const targetCheckCommands = target => [
    cargoCommand('test', target),
    `${cargoCommand('test', target)} --release`,
    cargoClippy(target),
    cargoReleaseClippy(target),
]

/** @type {(target: string, config: string) => readonly string[]} */
const cargoTestPairCommands = (target, config) => {
    const main = cargoCommand('test', target, config)
    return [main, `${main} --release`]
}

/** @type {(commands: readonly string[]) => readonly MetaStep[]} */
const testSteps = commands => commands.map(run => test({ run }))

/** @type {(target: string) => readonly MetaStep[]} */
const rustTarget = target => [
    { type: 'rust', target },
    ...testSteps(targetCheckCommands(target)),
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
    ...testSteps(targetCheckCommands()),
    ...i686(a, v),
]

/** CI job id, and the directory name of its generated flake. */
export const wasmJobId = /** @type {const} */ ('wasm')

const wasmerConfig = /** @type {const} */ ('.cargo/config.wasmer.toml')

/**
 * Wasmtime 47 removed wasi-threads, so this target runs under Wasmer only.
 * Clippy needs no runner and stays. See `../../../todo/blocked/wasmtime-threads.md`.
 *
 * The Wasmtime the flake provides predates that removal, so the arrangement
 * currently tests less than it could rather than something it cannot: revisit
 * when the pinned snapshot moves past 47.
 */
const wasmerOnlyTarget = /** @type {const} */ ('wasm32-wasip1-threads')

/**
 * Every WASM target the job exercises, in the order it exercises them.
 *
 * One list, read three times: the flake declares these as the targets whose
 * `rust-std` its toolchain must carry, the steps below build the commands from
 * the same array, and `../dev/module.f.mjs` gives a developer's shell the same
 * ones. A target added here therefore arrives in the shell and in the job
 * together, rather than as a command with no standard library.
 */
export const wasmTargets = /** @type {const} */ ([
    'wasm32-wasip1',
    'wasm32-wasip2',
    'wasm32-unknown-unknown',
    wasmerOnlyTarget,
])

/** @type {(target: string) => readonly string[]} */
const wasmTargetCommands = target =>
    target === wasmerOnlyTarget
        ? [
            cargoClippy(target),
            cargoReleaseClippy(target),
            ...cargoTestPairCommands(target, wasmerConfig),
        ]
        : [
            ...targetCheckCommands(target),
            ...cargoTestPairCommands(target, wasmerConfig),
        ]

/**
 * The Rust the shared flake carries: a `rust-overlay` toolchain with every
 * target this job builds.
 *
 * `minimal` rather than `default`, with the two components the job actually
 * runs named explicitly: the default profile would add `rust-docs`, which is a
 * download nothing here opens.
 *
 * It is declared beside the commands that use it rather than beside the flake,
 * so the targets below and `wasmTargets` above cannot come apart —
 * `../dev/module.f.mjs` takes this whole record.
 *
 * The flake names `1.98.0` in full, so no job checks the toolchain's version:
 * a check could only restate the flake. The two runtimes are the opposite
 * case, and the checks below are the whole of that tie.
 *
 * @type {NixRust}
 */
export const wasmRust = {
    version: rust,
    extensions: ['clippy', 'rustfmt'],
    targets: wasmTargets,
}

/**
 * The two runtimes `.cargo/config.toml` and `.cargo/config.wasmer.toml` name,
 * as the shared flake's attributes. Neither carries a version.
 *
 * @type {readonly string[]}
 */
export const wasmPackages = ['wasmtime', 'wasmer']

/**
 * The migrated job: install Nix, check the two runtimes its flake provides,
 * then format, test and lint every WASM target through that shell.
 *
 * It installs no toolchain of its own. `cargo` comes from the flake, which is
 * also where `wasmtime` and `wasmer` come from — and that is not a detail:
 * `cargo` invokes those runners itself, through the `runner` keys in
 * `.cargo/config.toml`, so they have to be on the same `PATH` as the `cargo`
 * that spawns them. A job taking the toolchain from an action and the runtimes
 * from a flake would depend on whether `nix develop` keeps the runner's `PATH`,
 * which nothing else here depends on.
 *
 * @type {readonly MetaStep[]}
 */
export const rustWasmSteps = [
    nixInstall,
    nixVersionStep(nixShell, 'wasmtime --version', `wasmtime ${wasmtime}`),
    nixVersionStep(nixShell, 'wasmer --version', `wasmer ${wasmer}`),
    ...nixSteps(nixShell)([
        'cargo fmt -- --check',
        ...wasmTargets.flatMap(wasmTargetCommands),
    ]),
]
