/**
 * A JavaScript host for the `fjs:l0` imports that [the interfaces of
 * L0](../module.f.mjs) bind, so that a module of the IR runs on any
 * WebAssembly engine of a JavaScript host before NaNVM runs it.
 *
 * - **A value of `any` is a handle**: the index of the value in a table that
 *   the host holds, as an `i64`. A handle that names no value of the table
 *   throws.
 * - **Each import is the [L0 view](../../../wasm/runtime/l0/module.f.js)'s
 *   function**, on the value that the handle names: `kind` is its `kind`,
 *   `to_f64` its `asNumber`, `to_bool` its `asBoolean`, and `length` its
 *   `length`. Where L0 traps, the view throws, and so does the import.
 *
 * A host proof makes one table per call of an exported function: the
 * values of its arguments of `any`, whose handles it passes.
 *
 * @module
 *
 * @import { Host } from './types.ts'
 */

import { asBoolean, asNumber, kind, length } from '../../../wasm/runtime/l0/module.f.js'

/**
 * The `fjs:l0` imports over a table of values.
 *
 * @type {(values: readonly unknown[]) => Host}
 */
export const host = values => {
    /** The value that a handle names. @type {(h: bigint) => unknown} */
    const value = h => {
        if (h < 0n || h >= BigInt(values.length)) { throw 'fjs:l0 host: not a handle' }
        return values[Number(h)]
    }
    return {
        kind: h => kind(value(h)),
        to_f64: h => asNumber(value(h)),
        to_bool: h => asBoolean(value(h)) ? 1 : 0,
        length: h => length(value(h)),
    }
}
