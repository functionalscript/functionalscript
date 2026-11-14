/**
 * The `fjs:l0` imports as a JavaScript host gives them.
 *
 * @module
 */

import type { Kind } from '../../../wasm/runtime/l0/types.ts'

/**
 * The functions of the `fjs:l0` imports that [the interfaces of
 * L0](../module.f.js) bind, each on a handle, as the WebAssembly
 * JavaScript API passes an `i64`: a `bigint`. A `bool` goes back as `0` or
 * `1`, and a length and a unit as the numbers they are, as an index comes.
 * `dup` and `drop` change the count of a cell; `from_unit` and `concat`
 * allocate a cell the caller owns; `live` is how many cells remain.
 */
export type Host = {
    readonly kind: (h: bigint) => Kind
    readonly to_f64: (h: bigint) => number
    readonly to_bool: (h: bigint) => 0 | 1
    readonly same: (a: bigint, b: bigint) => 0 | 1
    readonly length: (h: bigint) => number
    readonly unit: (h: bigint, i: number) => number
    readonly dup: (h: bigint) => bigint
    readonly drop: (h: bigint) => void
    readonly from_unit: (c: number) => bigint
    readonly concat: (a: bigint, b: bigint) => bigint
    readonly live: () => number
    readonly read: (h: bigint) => unknown
}
