/**
 * Types private to the [NaNVM host](./module.mjs).
 *
 * @module
 */

/** NaNVM's exports, as the WebAssembly JavaScript API gives them. */
export type _Nanvm = {
    readonly memory: WebAssembly.Memory
    readonly reserve: (size: number) => number
    readonly constant_box: (k: number) => bigint
    readonly kind: (h: bigint) => number
    readonly to_f64: (h: bigint) => number
    readonly from_f64: (x: number) => bigint
    readonly make_string: (ptr: number, len: number) => bigint
    readonly read_units: (s: bigint, start: number, len: number, ptr: number) => void
    readonly make_bigint: (sign: number, ptr: number, len: number) => bigint
    readonly sign: (b: bigint) => number
    readonly read_words: (b: bigint, start: number, len: number, ptr: number) => void
    readonly begin_array: (n: number) => number
    readonly begin_object: (n: number) => number
    readonly push: (b: number, v: bigint) => void
    readonly push_property: (b: number, k: bigint, v: bigint) => void
    readonly seal: (b: number) => bigint
    readonly length: (h: bigint) => number
    readonly item: (h: bigint, i: number) => bigint
    readonly key: (h: bigint, i: number) => bigint
    readonly dup: (h: bigint) => bigint
    readonly drop: (h: bigint) => void
    readonly make_function: (code: number, frame: bigint, length: number, text: bigint) => bigint
    readonly call: (f: bigint, args: bigint) => bigint
    readonly throw: (h: bigint) => void
    readonly same: (a: bigint, b: bigint) => number
    readonly has_thrown: () => number
    readonly thrown: () => bigint
    readonly enter: () => void
    readonly leave: () => void
    readonly recover: () => void
    readonly live: () => number
    readonly open_builders: () => number
    readonly alive: (h: bigint) => number
    readonly trap_text_length: () => number
    readonly trap_text_into: (ptr: number) => void
    /** `0` always dyn-ref (A); non-zero short when a v1-enabled tag fits (B/C). */
    readonly set_string_emit_short: (enabled: number) => void
}
