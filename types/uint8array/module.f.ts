/**
 * Conversions between Uint8Array values and bit vectors.
 *
 * @module
 */
import { msb, u8List, u8ListToVec, type Vec } from "../bit_vec/module.f.ts"
import { toArray } from "../list/module.f.ts"

const u8ListToVecMsb = u8ListToVec(msb)
const u8ListMsb = u8List(msb)

/**
 * Converts a Uint8Array into an MSB-first bit vector.
 */
export const toVec = (input: Uint8Array): Vec =>
    u8ListToVecMsb(Array.from(input))

/**
 * Converts an MSB-first bit vector into a Uint8Array.
 */
export const fromVec = (input: Vec): Uint8Array =>
    Uint8Array.from(toArray(u8ListMsb(input)))
