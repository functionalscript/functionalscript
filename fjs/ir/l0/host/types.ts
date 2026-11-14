/**
 * The `fjs:l0` imports as a JavaScript host gives them.
 *
 * @module
 */

import type { Kind } from '../../../wasm/runtime/l0/types.ts'

/**
 * The functions of the `fjs:l0` imports that [the interfaces of
 * L0](../module.f.js) bind, over the L0 view, each on a handle as the
 * WebAssembly JavaScript API passes an `i64`: a `bigint`. A `bool` goes back
 * as `0` or `1`, and a length and a unit as the numbers they are, as an
 * index comes. `from_unit`, `concat`, `substring` and `item` answer the
 * value that they make or read, which a host gives a handle.
 */
export type View = {
    readonly kind: (h: bigint) => Kind
    readonly to_f64: (h: bigint) => number
    readonly to_bool: (h: bigint) => 0 | 1
    readonly same: (a: bigint, b: bigint) => 0 | 1
    readonly length: (h: bigint) => number
    readonly unit: (h: bigint, i: number) => number
    readonly from_unit: (c: number) => string
    readonly concat: (a: bigint, b: bigint) => string
    readonly substring: (s: bigint, start: number, end: number) => string
    readonly item: (c: bigint, i: number) => unknown
}

/**
 * The `fjs:l0` imports of a host that counts: the view's readers, `dup` and
 * `drop`, which count a cell, and `from_unit`, `concat`, `substring` and
 * `item`, which make a cell that the caller owns and answer its handle.
 */
export type Imports = {
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
    readonly substring: (s: bigint, start: number, end: number) => bigint
    readonly item: (c: bigint, i: number) => bigint
}

/**
 * A host that counts every value: its imports, the value that a handle
 * names, and the cells that are alive, each a handle and its count, in the
 * order they were made.
 */
export type Counting = {
    readonly imports: Imports
    readonly read: (h: bigint) => unknown
    readonly live: () => readonly (readonly [handle: bigint, count: number])[]
}
