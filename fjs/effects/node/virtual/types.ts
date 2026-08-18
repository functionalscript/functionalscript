/**
 * Types for the virtual Node-effect operations used by filesystem and
 * process tests.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Module } from '../types.ts'

/**
 * In-memory JS module entry. When `import_` is called on the path, the
 * function is invoked and its return value is the module value (with a
 * `default` export and optional named exports). Using a function (not a
 * plain value) lets the entry be distinguished from `Vec`/`Dir` at runtime
 * via `typeof === 'function'`, and lets the fixture compute the module on
 * each import for closures/state.
 */
export type JsModule = () => Module

/** @internal */
export type _Entity = readonly Vec[] | Dir | JsModule

export type Dir = {
    readonly[name in string]?: _Entity
}

export type State = {
    stdout: string
    stderr: string
    /** Remaining stdin bytes; each `read` pops the first, `null` at EOF. */
    stdin: readonly number[]
    root: Dir
    internet: {
        readonly[url: string]: Vec
    }
    epochNs: number
    memoryNext: number
    memoryValues: { readonly [key: string]: unknown }
    /** Monotonically increasing counter returned by `randomInt`; starts at 0. */
    randomNext: number
}
