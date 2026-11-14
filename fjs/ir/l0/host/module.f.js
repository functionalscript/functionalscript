/**
 * The `fjs:l0` imports that [the interfaces of L0](../module.f.js) bind,
 * as the [L0 view](../../../wasm/runtime/l0/module.f.js)'s functions on the
 * values that handles name, so that a module of the IR runs on any
 * WebAssembly engine of a JavaScript host before NaNVM runs it.
 *
 * - **A value of `any` is a handle**, an `i64` that a host reads as the
 *   value it names. `handles` reads a table of values by index, and the
 *   [counting host](./count/module.mjs) reads its cells.
 * - **Each import is the view's function**: `kind` is its `kind`,
 *   `to_f64` its `asNumber`, `to_bool` its `asBoolean`, `same` its `same`,
 *   `length` its `length`, and `unit` its `unit`. Where L0 traps, the view
 *   throws, and so does the import.
 * - **`from_unit`, `concat`, `substring` and `item` answer a value**, the
 *   view's `fromUnit`, `concat`, `substring` and `item`, which a host gives
 *   a handle of its own, since the caller owns it. Counting is the host's:
 *   `dup`, `drop` and the cells are state, which a host boundary holds and
 *   FunctionalScript does not.
 *
 * The [host of L1's native rows](../../native/host/module.f.js) reads
 * values the same way.
 *
 * @module
 *
 * @import { View } from './types.ts'
 */

import { asBoolean, asNumber, concat, fromUnit, item, kind, length, same, substring, unit } from '../../../wasm/runtime/l0/module.f.js'

/**
 * The value that a handle names in a table of values, by its index, or a
 * throw where it names none.
 *
 * @type {(values: readonly unknown[]) => (h: bigint) => unknown}
 */
export const handles = values => h => {
    if (h < 0n || h >= BigInt(values.length)) { throw 'fjs:l0 host: not a handle' }
    return values[Number(h)]
}

/**
 * The `fjs:l0` imports of the L0 view, over a reading of handles.
 *
 * @type {(read: (h: bigint) => unknown) => View}
 */
export const view = read => ({
    kind: h => kind(read(h)),
    to_f64: h => asNumber(read(h)),
    to_bool: h => asBoolean(read(h)) ? 1 : 0,
    same: (a, b) => same(read(a), read(b)) ? 1 : 0,
    length: h => length(read(h)),
    unit: (h, i) => unit(read(h), i),
    from_unit: c => fromUnit(c),
    concat: (a, b) => concat(read(a), read(b)),
    substring: (s, start, end) => substring(read(s), start, end),
    item: (c, i) => item(read(c), i),
})
