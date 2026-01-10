/**
 * Conversions between Uint8Array values and bit vectors.
 *
 * @module
 */
import { msb, u8List, u8ListToVec, type Vec } from "../bit_vec/module.f.ts"
import { iterable, type List } from "../list/module.f.ts"

const u8ListToVecMsb = u8ListToVec(msb)
const u8ListMsb = u8List(msb)

const toList = (input: Uint8Array): List<number> => {
    const step = (index: number): List<number> =>
        index < input.length
            ? { first: input[index], tail: () => step(index + 1) }
            : null
    return step(0)
}

/**
 * Converts a Uint8Array into an MSB-first bit vector.
 */
export const toVec = (input: Uint8Array): Vec =>
    u8ListToVecMsb(toList(input))

/**
 * Converts an MSB-first bit vector into a Uint8Array.
 */
export const fromVec = (input: Vec): Uint8Array =>
    Uint8Array.from(iterable(u8ListMsb(input)))
