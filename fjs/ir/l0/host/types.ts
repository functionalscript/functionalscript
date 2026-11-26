/**
 * The `fjs:l0` imports as a JavaScript host gives them.
 *
 * @module
 */

import type { Kind } from '../../../wasm/runtime/l0/types.ts'
import type { ShortTag } from '../../runtime/string/types.ts'
import type { Host as NativeHost } from '../../native/host/types.ts'

/**
 * Whether allocating string imports on a counting / NaNVM host may return
 * a short-string box ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md)
 * S2). Matches String-manifest `emit` + `enabledTags`: A is always
 * dyn-ref; B/C are short when an enabled tag fits.
 */
export type StringEmit =
    | { readonly kind: 'alwaysDynRef' }
    | { readonly kind: 'shortWhenEnabled', readonly enabledTags: readonly ShortTag[] }

/**
 * The functions of the `fjs:l0` imports that [the interfaces of
 * L0](../module.f.js) bind, over the L0 view, each on a handle as the
 * WebAssembly JavaScript API passes an `i64`: a `bigint`. A `bool` goes back
 * as `0` or `1`, and a length and a unit as the numbers they are, as an
 * index comes. `from_unit`, `concat`, `substring`, `item`, `join`, `key`
 * and `text` answer the value that they make or read, which a host gives a
 * handle. `find` answers an `i32`.
 */
export type View = {
    readonly kind: (h: bigint) => Kind
    readonly to_f64: (h: bigint) => number
    readonly from_f64: (x: number) => number
    readonly to_bool: (h: bigint) => 0 | 1
    readonly from_bool: (b: 0 | 1) => boolean
    readonly same: (a: bigint, b: bigint) => 0 | 1
    readonly length: (h: bigint) => number
    readonly unit: (h: bigint, i: number) => number
    readonly from_unit: (c: number) => string
    readonly concat: (a: bigint, b: bigint) => string
    readonly substring: (s: bigint, start: number, end: number) => string
    readonly item: (c: bigint, i: number) => unknown
    readonly find: (o: bigint, k: bigint) => number
    readonly join: (parts: bigint, separator: bigint) => string
    readonly key: (o: bigint, i: number) => string
    readonly text: (f: bigint) => string | undefined
}

/**
 * The `fjs:l0` imports of a host that counts: Any's constants, each an
 * immutable global of its NaN box, the view's readers over boxes, `dup` and
 * `drop`, which count a dyn-ref's cell, Ref's `kind_ref` / `dup_ref` /
 * `drop_ref` / `same_ref`, and `from_unit`, `concat`, `substring`, `item`,
 * `join`, `key` and `text`, which make a box that the caller owns. `find`
 * answers an `i32`. The memory that the host makes holds a module's data
 * segments at `data_base`, from which `make_string` makes a box of a string
 * of the UTF-16 units at an address.
 * A builder is an `i32` handle: `begin_array` makes one of a number of
 * items, `begin_object` one of a number of properties, `push` or
 * `push_property` takes over a cell as its next item or property,
 * `push_all` borrows a cell of an array and adds each of its items, and
 * `seal` ends it and makes a cell of the array or the object. `call`
 * borrows a function and an arguments array and answers a new cell of the
 * result; a throw from the function keeps the value and traps.
 * `make_function` takes over a frame array and a text and makes a cell of
 * a JavaScript function that calls the module's code through the table
 * that the host makes, which the module fills from `table_base`, and
 * `frame` answers a new cell of an item of the frame of such a function. `throw` takes over a cell, keeps its
 * value and returns, so that the `unreachable` after its call traps.
 */
export type Imports = {
    readonly memory: WebAssembly.Memory
    readonly data_base: WebAssembly.Global
    readonly table: WebAssembly.Table
    readonly table_base: WebAssembly.Global
    readonly make_string: (ptr: number, len: number) => bigint
    readonly undefined: WebAssembly.Global
    readonly null: WebAssembly.Global
    readonly true: WebAssembly.Global
    readonly false: WebAssembly.Global
    readonly kind: (h: bigint) => Kind
    readonly to_f64: (h: bigint) => number
    readonly from_f64: (x: number) => bigint
    readonly to_bool: (h: bigint) => 0 | 1
    readonly from_bool: (b: 0 | 1) => bigint
    readonly same: (a: bigint, b: bigint) => 0 | 1
    readonly length: (h: bigint) => number
    readonly unit: (h: bigint, i: number) => number
    readonly dup: (h: bigint) => bigint
    readonly drop: (h: bigint) => void
    readonly kind_ref: (b: bigint) => Kind
    readonly dup_ref: (b: bigint) => bigint
    readonly drop_ref: (b: bigint) => void
    readonly same_ref: (a: bigint, b: bigint) => 0 | 1
    readonly from_unit: (c: number) => bigint
    readonly concat: (a: bigint, b: bigint) => bigint
    readonly substring: (s: bigint, start: number, end: number) => bigint
    readonly item: (c: bigint, i: number) => bigint
    readonly find: (o: bigint, k: bigint) => number
    readonly begin_array: (n: number) => number
    readonly begin_object: (n: number) => number
    readonly push: (b: number, v: bigint) => void
    readonly push_all: (b: number, a: bigint) => void
    readonly push_property: (b: number, k: bigint, v: bigint) => void
    readonly seal: (b: number) => bigint
    readonly join: (parts: bigint, separator: bigint) => bigint
    readonly key: (o: bigint, i: number) => bigint
    readonly make_function: (code: number, frame: bigint, length: number, text: bigint) => bigint
    readonly call: (f: bigint, args: bigint) => bigint
    readonly text: (f: bigint) => bigint
    readonly throw: (v: bigint) => void
    readonly frame: (self: bigint, i: number) => bigint
}

/**
 * A host that counts every counted value: its imports, the value that a handle
 * names, `keep`, which keeps every cell alive at its count, and the cells
 * that are not as they were kept, each a handle and its count, in the order
 * they were made: a cell alive that is not kept, and a kept one at another
 * count, `0` where a `drop` freed it. `builders` are the handles of the
 * builders that are not sealed, in the order they were begun. The
 * runtime's host-only exports
 * ([L0 design §13](../../../../doc/sasha-gil/wasm/l0-design.md#13-errors-a-throw-traps))
 * read a throw after a trap: `has_thrown` answers `1` where a throw keeps a
 * value, `thrown` a handle of a new cell of it, which the caller owns, and
 * `recover` frees what the trap abandoned, and answers the cells that it
 * freed, each a handle and the counts it took away.
 *
 * A copy value, `undefined`, `null`, a boolean, a number or a well-formed
 * short-string box, is not counted: where an import, `own` or `thrown`
 * would make a new box of one, it answers the value's own NaN-box bits,
 * which no one owns, and a `dup` or a `drop` of those bits is a no-op. A
 * reference is a dyn-ref box that packs a cell index; `dup` and `drop`
 * count that cell. Short-string **emission** follows the host's
 * {@link StringEmit} policy (default always dyn-ref).
 */
export type Counting = {
    readonly imports: Imports
    /** The NaN boxes of the first values, in their order. */
    readonly first: readonly bigint[]
    /**
     * The `fjs:l1-native` imports of a host that has its own, as NaNVM
     * does; a host without them gets the [JavaScript
     * rows](../../native/host/module.mjs) over its cells.
     */
    readonly native?: NativeHost
    readonly has_thrown: () => 0 | 1
    readonly thrown: () => bigint
    /**
     * What a trap with nothing thrown said, of a host whose imports trap
     * in WebAssembly, as NaNVM's do: the text of `e`, the engine's error,
     * where the host kept it, and `e` where it did not. A host whose
     * imports throw their reasons to JavaScript has none.
     */
    readonly trap?: (e: unknown) => unknown
    readonly recover: () => readonly (readonly [handle: bigint, count: number])[]
    readonly read: (h: bigint) => unknown
    /** A cell of `value`, counted once, which the caller owns; for a copy value, its constant's handle. */
    readonly own: (value: unknown) => bigint
    /**
     * Keep a FunctionalScript throw the way `Functions.call` does when a
     * JavaScript function throws: the host then answers `1` from
     * `has_thrown` after the import traps.
     */
    readonly fail: (value: unknown) => void
    readonly keep: () => void
    readonly live: () => readonly (readonly [handle: bigint, count: number])[]
    readonly builders: () => readonly number[]
}
