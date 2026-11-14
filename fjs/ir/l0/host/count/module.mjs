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
 * - **`from_unit`, `concat`, `substring` and `item` make a cell** of the
 *   value that the view answers, counted once, and answer its handle, which
 *   the caller owns: an item read from an array is a cell of its own.
 * - **What a constant holds is kept.** Any's `undefined`, `null`, `true`
 *   and `false` are the cells `-1` to `-4`, each counted once for the
 *   immutable global that holds it, and kept from the start. `keep` keeps
 *   every cell alive at its count, so that a host proof that calls it after
 *   `init` keeps what the start function made for the module's literals and
 *   `init` for its constants. `live` then tells what a call changed: a cell
 *   that is not kept and is alive, and a kept one at another count, `0`
 *   where it was freed.
 * - **A builder is a handle of its own**, an `i32` that names an array
 *   that is not sealed yet
 *   ([L0 design §8](../../../../../doc/sasha-gil/wasm/l0-design.md#8-containers-a-builder-handle-then-seal)):
 *   `begin_array(n)` begins one of `n` items, `push` takes over a cell as
 *   its next item, a count of it that a `drop` would take away, and `seal`
 *   ends the builder and makes a cell of the array, which the caller owns.
 *   A push past `n` items, a seal of fewer, and a handle of no builder, or
 *   of one that is sealed, throw. `builders` tells which are not sealed.
 * - **The host makes the memory**, as a loader does
 *   ([L0 design §5](../../../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)):
 *   the region of a module's data segments starts at `data_base`, past
 *   bytes that the host keeps for itself, and holds as many bytes as the
 *   module's `fjs.layout` asks for. `make_string(ptr, len)` makes a cell of
 *   the string of the `len` UTF-16 units at `ptr`, the low byte of each
 *   first, and throws where they reach past the memory.
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

/** Where the region of a module's data segments starts: past bytes that a runtime would keep for itself. */
const dataBase = 0x100

/**
 * A counting host whose first cells are `values`, each counted once, and
 * whose memory holds `data` bytes of a module's data segments at
 * `data_base`.
 *
 * @type {(values: readonly unknown[], data?: number) => Counting}
 */
export const counting = (values, data = 0) => {
    /** @type {Map<bigint, { readonly value: unknown, readonly count: number }>} */
    const cells = new Map(values.map((value, k) => [BigInt(k), { value, count: 1 }]))
    /** The count at which each kept cell was kept. @type {Map<bigint, number>} */
    const kept = new Map()
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
    /** @type {(h: bigint) => bigint} */
    const dup = h => {
        const { value, count } = cell(h)
        cells.set(h, { value, count: count + 1 })
        return h
    }
    /** @type {(h: bigint) => void} */
    const drop = h => {
        const { value, count } = cell(h)
        if (count === 1) {
            cells.delete(h)
        } else {
            cells.set(h, { value, count: count - 1 })
        }
    }
    /** The builders that are not sealed: how many items each takes, and those it has. @type {Map<number, { readonly length: number, readonly items: readonly unknown[] }>} */
    const builders = new Map()
    let nextBuilder = 0
    /** @type {(b: number) => { readonly length: number, readonly items: readonly unknown[] }} */
    const builder = b => {
        const x = builders.get(b)
        if (x === undefined) { throw 'fjs:l0 host: not a builder' }
        return x
    }
    /** A constant of Any: a cell of `value`, named `h`, counted once for the global that holds it, and kept. @type {(h: bigint, value: unknown) => WebAssembly.Global} */
    const constant = (h, value) => {
        cells.set(h, { value, count: 1 })
        kept.set(h, 1)
        return new WebAssembly.Global({ value: 'i64', mutable: false }, h)
    }
    const v = view(read)
    const memory = new WebAssembly.Memory({ initial: Math.ceil((dataBase + data) / 0x1_0000) })
    /** @type {(ptr: number, len: number) => string} */
    const units = (ptr, len) => {
        const bytes = new DataView(memory.buffer)
        if (ptr < 0 || len < 0 || ptr + 2 * len > bytes.byteLength) { throw 'fjs:l0 host: make_string past the memory' }
        return String.fromCharCode(...Array.from({ length: len }, (_, k) => bytes.getUint16(ptr + 2 * k, true)))
    }
    return {
        imports: {
            memory,
            data_base: new WebAssembly.Global({ value: 'i32', mutable: false }, dataBase),
            make_string: (ptr, len) => make(units(ptr, len)),
            undefined: constant(-1n, undefined),
            null: constant(-2n, null),
            true: constant(-3n, true),
            false: constant(-4n, false),
            kind: v.kind,
            to_f64: v.to_f64,
            to_bool: v.to_bool,
            same: v.same,
            length: v.length,
            unit: v.unit,
            dup,
            drop,
            from_unit: c => make(v.from_unit(c)),
            concat: (a, b) => make(v.concat(a, b)),
            substring: (s, start, end) => make(v.substring(s, start, end)),
            item: (c, i) => make(v.item(c, i)),
            begin_array: n => {
                const b = nextBuilder
                nextBuilder = b + 1
                builders.set(b, { length: n, items: [] })
                return b
            },
            push: (b, h) => {
                const { length, items } = builder(b)
                if (items.length >= length) { throw 'fjs:l0 host: push past the length of a builder' }
                const value = read(h)
                drop(h)
                builders.set(b, { length, items: [...items, value] })
            },
            seal: b => {
                const { length, items } = builder(b)
                if (items.length !== length) { throw 'fjs:l0 host: seal of a builder that is not full' }
                builders.delete(b)
                return make(items)
            },
        },
        read,
        keep: () => {
            for (const [h, { count }] of cells) { kept.set(h, count) }
        },
        live: () => [
            ...[...cells].flatMap(([h, { count }]) => kept.get(h) === count ? [] : [/** @type {const} */ ([h, count])]),
            ...[...kept.keys()].flatMap(h => cells.has(h) ? [] : [/** @type {const} */ ([h, 0])]),
        ],
        builders: () => [...builders.keys()],
    }
}
