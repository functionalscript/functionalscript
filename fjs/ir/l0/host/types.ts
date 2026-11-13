/**
 * The `fjs:l0` imports as a JavaScript host gives them.
 *
 * @module
 */

import type { Kind } from '../../../wasm/runtime/l0/types.ts'

/**
 * The functions of the `fjs:l0` imports that [the interfaces of
 * L0](../module.f.mjs) bind, each on a handle, as the WebAssembly
 * JavaScript API passes an `i64`: a `bigint`. A `bool` goes back as `0` or
 * `1`, and a length as the number it is.
 */
export type Host = {
    readonly kind: (h: bigint) => Kind
    readonly to_f64: (h: bigint) => number
    readonly to_bool: (h: bigint) => 0 | 1
    readonly length: (h: bigint) => number
}
