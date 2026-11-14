/**
 * A JavaScript host for the `fjs:l0` imports that [the interfaces of
 * L0](../module.f.js) bind, so that a module of the IR runs on any
 * WebAssembly engine of a JavaScript host before NaNVM runs it.
 *
 * - **A value of `any` is a handle**: an `i64` that names a cell in a table
 *   the host holds. Each cell has a reference count. A handle that names no
 *   cell, or one whose count has reached zero, throws.
 * - **`dup` and `drop` count.** `dup` increments; `drop` decrements and
 *   frees the cell at zero. The four immortal constants of the definition
 *   host are not in this slice; every value the proofs pass is counted.
 * - **Each import is the [L0 view](../../../wasm/runtime/l0/module.f.js)'s
 *   function**, on the values that the handles name. Where L0 traps, the
 *   view throws, and so does the import. `from_unit` and `concat` allocate
 *   a new cell the caller owns.
 *
 * A host proof makes one table per call of an exported function: the
 * values of its arguments of `any`, whose handles it passes. The
 * [host of L1's native rows](../../native/host/module.f.js) reads the same
 * table through `handles`.
 *
 * @module
 *
 * @import { Host } from './types.ts'
 */

import {
    asBoolean, asNumber, concat as viewConcat, fromUnit, kind, length, same, unit,
} from '../../../wasm/runtime/l0/module.f.js'

/**
 * The value that a handle names in a table of values, or a throw where it
 * names none. Kept for the native host, which shares the argument table.
 *
 * @type {(values: readonly unknown[]) => (h: bigint) => unknown}
 */
export const handles = values => h => {
    if (h < 0n || h >= BigInt(values.length)) { throw 'fjs:l0 host: not a handle' }
    return values[Number(h)]
}

/**
 * The `fjs:l0` imports over a table of values. Each argument of `any` is a
 * cell at its index with count one; `from_unit` and `concat` allocate past
 * that. `live()` is the number of cells that still have a positive count.
 *
 * @type {(values: readonly unknown[]) => Host}
 */
export const host = values => {
    /** @type {Map<bigint, { value: unknown, count: number }>} */
    const cells = new Map(values.map((value, i) => [BigInt(i), { value, count: 1 }]))
    let next = BigInt(values.length)

    /** @type {(h: bigint) => { value: unknown, count: number }} */
    const cell = h => {
        const c = cells.get(h)
        if (c === undefined || c.count <= 0) { throw 'fjs:l0 host: not a handle' }
        return c
    }

    /** @type {(h: bigint) => unknown} */
    const read = h => cell(h).value

    /** @type {(value: unknown) => bigint} */
    const alloc = value => {
        const h = next
        next += 1n
        cells.set(h, { value, count: 1 })
        return h
    }

    /** @type {(h: bigint) => bigint} */
    const dup = h => {
        cell(h).count += 1
        return h
    }

    /** @type {(h: bigint) => void} */
    const drop = h => {
        const c = cell(h)
        c.count -= 1
        if (c.count === 0) { cells.delete(h) }
    }

    return {
        kind: h => kind(read(h)),
        to_f64: h => asNumber(read(h)),
        to_bool: h => asBoolean(read(h)) ? 1 : 0,
        same: (a, b) => same(read(a), read(b)) ? 1 : 0,
        length: h => length(read(h)),
        unit: (h, i) => unit(read(h), i),
        dup,
        drop,
        from_unit: c => alloc(fromUnit(c)),
        concat: (a, b) => alloc(viewConcat(read(a), read(b))),
        live: () => cells.size,
        read,
    }
}
