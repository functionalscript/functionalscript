/**
 * Conversions between `Uint8Array` values and bit vectors.
 *
 * @deprecated FunctionalScript represents byte data as `bigint`-based bit
 * vectors (`Vec` from `fjs/types/bit_vec`). Use `utf8`/`utf8ToString` from
 * `fjs/text` for string encoding, and the `bit_vec` module directly for raw
 * byte manipulation. `Uint8Array` interop belongs at Node.js boundaries only
 * (e.g. `fromVec`/`toVec` when reading or writing files).
 *
 * @module
 */

import { assertNotNullish } from '../../asserts/module.f.mjs'
import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { msb, tryU8ListToVec, u8List } from '../bit_vec/module.f.mjs'
/** @import { Vec } from '../bit_vec/types.ts' */
import { compose } from '../function/module.f.mjs'
import { flat, fromArrayLike, iterable, map } from '../list/module.f.mjs'
/** @import { List } from '../list/types.ts' */

const tryU8ListToVecMsb = tryU8ListToVec(msb)
const u8ListMsb = u8List(msb)

const m = map(fromArrayLike)

/**
 * Concatenates a list of `Uint8Array` values into one MSB-first bit vector.
 *
 * Throws if the result would exceed `maxLength`. The bound is not precomputed:
 * `tryU8ListToVec` attempts the real conversion and reports `null` when it does
 * not fit (AGENTS.md §5.6).
 *
 * @type {(input: List<Uint8Array>) => Vec}
 */
export const listToVec = input =>
    assertNotNullish(tryU8ListToVecMsb(flat(m(input))), "the array is too big")

/**
 * Converts a Uint8Array into an MSB-first bit vector.
 *
 * @type {(input: Uint8Array) => Vec}
 */
export const toVec = input => listToVec([input])

/**
 * Converts an MSB-first bit vector into a Uint8Array.
 *
 * @type {(input: Vec) => Uint8Array}
 */
export const fromVec = input =>
    Uint8Array.from(iterable(u8ListMsb(input)))

/** @type {(input: Uint8Array) => string} */
export const decodeUtf8 = compose(toVec)(utf8ToString)

/** @type {(input: string) => Uint8Array} */
export const encodeUtf8 = compose(utf8)(fromVec)
