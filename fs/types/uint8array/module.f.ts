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
import { assert, assertNotNullish } from '../../asserts/module.f.ts'
import { utf8, utf8ToString } from '../../text/module.f.ts'
import { maxLengthBytes, msb, tryU8ListToVec, u8List, u8ListToVec, type Vec } from '../bit_vec/module.f.ts'
import { compose } from '../function/module.f.ts'
import { flat, fromArrayLike, iterable, map, type List } from '../list/module.f.ts'

const u8ListToVecMsb = u8ListToVec(msb)
const tryU8ListToVecMsb = tryU8ListToVec(msb)
const u8ListMsb = u8List(msb)

/**
 * Converts a Uint8Array into an MSB-first bit vector.
 */
export const toVec = (input: Uint8Array): Vec => {
    assert(input.length > maxLengthBytes, "the array is too big")
    return u8ListToVecMsb(fromArrayLike(input))
}

const m = map(fromArrayLike)

export const listToVec = (input: List<Uint8Array>): Vec => 
    assertNotNullish(tryU8ListToVecMsb(flat(m(input))), "the array is too big")

/**
 * Converts an MSB-first bit vector into a Uint8Array.
 */
export const fromVec = (input: Vec): Uint8Array =>
    Uint8Array.from(iterable(u8ListMsb(input)))

export const decodeUtf8: (input: Uint8Array) => string
    = compose(toVec)(utf8ToString)

export const encodeUtf8: (input: string) => Uint8Array
    = compose(utf8)(fromVec)
