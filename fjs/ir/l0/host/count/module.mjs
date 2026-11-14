/**
 * A host for the `fjs:l0` imports that counts every value, so that a
 * misplaced `dup` or `drop` shows: the [L0 view's imports](../module.f.js)
 * over cells that it holds, each a value and a count.
 *
 * - **A handle names a cell.** The values that a host proof passes are the
 *   first cells, each counted once and named by its index, as a table of
 *   values names them. A handle that names no cell throws, and so does one
 *   whose cell a `drop` freed.
 * - **`dup` and `drop` count.** `dup` adds one to a cell's count and
 *   answers its handle; `drop` takes one away, and frees the cell at zero.
 * - **`from_unit` and `concat` make a cell** of the value that the view
 *   answers, counted once, and answer its handle, which the caller owns.
 *
 * Counting is state, and a WebAssembly import has nowhere else to keep it,
 * so this is a host boundary in plain JavaScript beside the
 * FunctionalScript of the view
 * ([fjs/AGENTS.md §3.1](../../../../AGENTS.md#31-immutability-and-purity)).
 *
 * @module
 *
 * @import { Counting } from '../types.ts'
 */

import { view } from '../module.f.js'

/**
 * A counting host whose first cells are `values`, each counted once.
 *
 * @type {(values: readonly unknown[]) => Counting}
 */
export const counting = values => {
    /** @type {Map<bigint, { readonly value: unknown, readonly count: number }>} */
    const cells = new Map(values.map((value, k) => [BigInt(k), { value, count: 1 }]))
    let next = BigInt(values.length)
    /** @type {(h: bigint) => { readonly value: unknown, readonly count: number }} */
    const cell = h => {
        const c = cells.get(h)
        if (c === undefined) { throw 'fjs:l0 host: not a handle' }
        return c
    }
    /** @type {(h: bigint) => unknown} */
    const read = h => cell(h).value
    /** @type {(value: unknown) => bigint} */
    const make = value => {
        const h = next
        next = h + 1n
        cells.set(h, { value, count: 1 })
        return h
    }
    const v = view(read)
    return {
        imports: {
            kind: v.kind,
            to_f64: v.to_f64,
            to_bool: v.to_bool,
            same: v.same,
            length: v.length,
            unit: v.unit,
            dup: h => {
                const { value, count } = cell(h)
                cells.set(h, { value, count: count + 1 })
                return h
            },
            drop: h => {
                const { value, count } = cell(h)
                if (count === 1) {
                    cells.delete(h)
                } else {
                    cells.set(h, { value, count: count - 1 })
                }
            },
            from_unit: c => make(v.from_unit(c)),
            concat: (a, b) => make(v.concat(a, b)),
        },
        read,
        live: () => [...cells].map(([h, { count }]) => [h, count]),
    }
}
