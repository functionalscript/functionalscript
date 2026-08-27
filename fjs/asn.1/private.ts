import type { Vec } from "../types/bit_vec/types.ts"

export type _ClassPc = |
    0b000_00000n |
    0b001_00000n |
    0b010_00000n |
    0b011_00000n |
    0b100_00000n |
    0b101_00000n |
    0b110_00000n |
    0b111_00000n

/**
 * Note: the tag number (the second parameter) can be arbitrarily large,
 *       so we can't just use a single byte to represent it.
 */
export type _ParsedTag = readonly[_ClassPc, bigint]

export type _Round8 = {
    readonly byteLen: bigint
    readonly v: Vec
}
