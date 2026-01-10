/**
 * Conversions between Uint8Array values and bit vectors.
 *
 * @module
 */
import { utf8, utf8ToString } from "../../text/module.f.ts"
import { msb, u8List, u8ListToVec, type Vec } from "../bit_vec/module.f.ts"
import { compose } from "../function/module.f.ts"
import { fromArrayLike, iterable } from "../list/module.f.ts"

const u8ListToVecMsb = u8ListToVec(msb)
const u8ListMsb = u8List(msb)

/**
 * Converts a Uint8Array into an MSB-first bit vector.
 */
export const toVec = (input: Uint8Array): Vec =>
    u8ListToVecMsb(fromArrayLike(input))

/**
 * Converts an MSB-first bit vector into a Uint8Array.
 */
export const fromVec = (input: Vec): Uint8Array =>
    Uint8Array.from(iterable(u8ListMsb(input)))

export const decodeUtf8: (input: Uint8Array) => string
    = compose(toVec)(utf8ToString)

export const encodeUtf8: (input: string) => Uint8Array
    = compose(utf8)(fromVec)
