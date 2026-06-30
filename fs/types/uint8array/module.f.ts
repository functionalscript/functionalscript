/**
 * Conversions between `Uint8Array` values and bit vectors.
 *
 * @deprecated FunctionalScript represents byte data as `bigint`-based bit
 * vectors (`Vec` from `fs/types/bit_vec`). Use `utf8`/`utf8ToString` from
 * `fs/text` for string encoding, and the `bit_vec` module directly for raw
 * byte manipulation. `Uint8Array` interop belongs at Node.js boundaries only
 * (e.g. `fromVec`/`toVec` when reading or writing files).
 *
 * @module
 */
import { utf8, utf8ToString } from '../../text/module.f.ts'
import { msb, u8List, u8ListToVec, type Vec } from '../bit_vec/module.f.ts'
import type { Nullable } from '../nullable/module.f.ts'
import { flat, fromArrayLike, iterable, map, type List } from '../list/module.f.ts'

const u8ListToVecMsb = u8ListToVec(msb)
const u8ListMsb = u8List(msb)

/**
 * Converts a Uint8Array into an MSB-first bit vector, or `null` when the array
 * is larger than a single `Vec` can hold (`maxLength` bits). The `null` is the
 * over-cap signal; callers at an I/O boundary turn it into a typed error.
 */
export const toVec = (input: Uint8Array): Nullable<Vec> =>
    u8ListToVecMsb(fromArrayLike(input))

const m = map(fromArrayLike)

export const listToVec = (input: List<Uint8Array>): Nullable<Vec> =>
    u8ListToVecMsb(flat(m(input)))

/**
 * Converts an MSB-first bit vector into a Uint8Array.
 */
export const fromVec = (input: Vec): Uint8Array =>
    Uint8Array.from(iterable(u8ListMsb(input)))

export const decodeUtf8 = (input: Uint8Array): Nullable<string> => {
    const v = toVec(input)
    return v === null ? null : utf8ToString(v)
}

export const encodeUtf8 = (input: string): Nullable<Uint8Array> => {
    const v = utf8(input)
    return v === null ? null : fromVec(v)
}
