/**
 * @module
 * @import { Architecture, MetaStep, Os } from '../common/types.ts'
 */

import { wasmer, wasmtime } from '../config/module.f.js'
import { isUbuntuArm, test } from '../common/module.f.mjs'
import { environmentVersionStep } from '../environment/module.f.mjs'

/**
 * One `cargo` check, run twice: debug, then `--release`.
 *
 * Every `cargo` command this generator emits belongs to such a pair, so the pair
 * is the unit rather than the command. Clippy always denies warnings — the
 * `-- -D warnings` suffix follows from the tool, not from the caller.
 *
 * @type {(tool: 'clippy' | 'test', target?: string, config?: string) => readonly string[]}
 */
const cargoPair = (tool, target, config) => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    const main = `cargo ${tool}${to}${co}`
    const warnings = tool === 'clippy' ? ' -- -D warnings' : ''
    return [`${main}${warnings}`, `${main} --release${warnings}`]
}

/** Debug and release, tests then Clippy — the check set every target gets. */
/** @type {(target?: string) => readonly string[]} */
const targetCheckCommands = target => [
    ...cargoPair('test', target),
    ...cargoPair('clippy', target),
]

/** @type {(commands: readonly string[]) => readonly MetaStep[]} */
const testSteps = commands => commands.map(run => test({ run }))

/** @type {(target: string) => readonly MetaStep[]} */
const rustTarget = target => [
    { type: 'rust', target },
    ...testSteps(targetCheckCommands(target)),
]

const i686Linux = /** @type {const} */ ('i686-unknown-linux-gnu')

/**
 * The additional Windows target; Intel Linux is handled by shellRustCommands.
 * @type {(v: Os, a: Architecture) => string | undefined}
 */
export const i686Target = (v, a) =>
    a === 'intel' && v === 'windows' ? 'i686-pc-windows-msvc' : undefined

/** @type {(v: Os, a: Architecture) => readonly MetaStep[]} */
const i686 = (v, a) => {
    const target = i686Target(v, a)
    return target === undefined ? [] : rustTarget(target)
}

/**
 * @type {readonly string[]}
 */
export const rustPlatformCommands = targetCheckCommands()

/** @type {(v: Os, a: Architecture) => readonly MetaStep[]} */
export const rustPlatformSteps = (v, a) => [
    { type: 'rust' },
    ...testSteps(rustPlatformCommands),
    ...i686(v, a),
]

/**
 * @type {(v: Os, a: Architecture) => boolean}
 */
const wasmPlatform = isUbuntuArm

/**
 * Assert the two WASM runtimes on the platform that exercises them.
 * @type {(v: Os, a: Architecture) => readonly MetaStep[]}
 */
export const shellRustVersionSteps = (v, a) =>
    wasmPlatform(v, a)
        ? [
            environmentVersionStep('wasmtime --version', `wasmtime ${wasmtime}`),
            environmentVersionStep('wasmer --version', `wasmer ${wasmer}`),
        ]
        : []

/**
 * Native checks, plus i686 on Intel Linux and formatting/WASM on ARM Linux.
 * @type {(v: Os, a: Architecture) => readonly string[]}
 */
export const shellRustCommands = (v, a) => {
    const wasm = wasmPlatform(v, a)
    return [
        ...(wasm ? ['cargo fmt -- --check'] : []),
        ...rustPlatformCommands,
        ...(v === 'ubuntu' && a === 'intel' ? targetCheckCommands(i686Linux) : []),
        ...(wasm ? wasmTargets.flatMap(wasmTargetCommands) : []),
    ]
}

const wasmerConfig = /** @type {const} */ ('.cargo/config.wasmer.toml')

const wasmerOnlyTarget = /** @type {const} */ ('wasm32-wasip1-threads')

/**
 * Every WASM target exercised on ARM Linux.
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
            ...cargoPair('clippy', target),
            ...cargoPair('test', target, wasmerConfig),
        ]
        : [
            ...targetCheckCommands(target),
            ...cargoPair('test', target, wasmerConfig),
        ]
