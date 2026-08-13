/**
 * @import { BigFloat } from './types.ts'
 */

import { decToBin } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { abs } from '../bigint/module.f.mjs'

const twoPow53 = 0b0010_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

/**
 * Asserts that `decToBin(dec)` equals `expected` and that its mantissa is a
 * binary64 significand — `abs(m) < 2^53`. The width check is on the
 * magnitude: `m < 2^53` is vacuous for a negative mantissa.
 *
 * @type {(dec: BigFloat) => (expected: BigFloat) => void}
 */
const assertDecToBin = dec => ([em, ee]) => {
    const [m, e] = decToBin(dec)
    assert(abs(m) < twoPow53, m.toString(2))
    assertEq(m, em, m.toString(2))
    assertEq(e, ee)
}

export const proof = {
    decToBin: [
        () => {
            const result = decToBin([0n, 0])
            assertEq(result[0], 0b0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], 0)
        },
        () => {
            const result = decToBin([0n, 10])
            assertEq(result[0], 0b0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], 0)
        },
        () => {
            const result = decToBin([0n, -10])
            assertEq(result[0], 0b0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], 0)
        },
        () => {
            const result = decToBin([1n, 0])
            assertEq(result[0], 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], -52)
        },
        () => {
            const result = decToBin([1n, 1])
            assertEq(result[0], 0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], -49)
        },
        () => {
            const result = decToBin([1000n, -2])
            assertEq(result[0], 0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], -49)
        },
        () => {
            const result = decToBin([1n, -1])
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2)) //+1
            assertEq(result[1], -56)
        },
        () => {
            const result = decToBin([-1n, 0])
            assertEq(result[0], -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], -52)
        },
        () => {
            const result = decToBin([-1n, 1])
            assertEq(result[0], -0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], -49)
        },
        () => {
            const result = decToBin([-1000n, -2])
            assertEq(result[0], -0b1_0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], -49)
        },
        () => {
            const result = decToBin([-1n, -1])
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2)) //+1
            assertEq(result[1], -56)
        },
        () => {
            const result = decToBin([0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, 0]) //54bits (...0.1)
            assertEq(result[0], 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], 1)
        },
        () => {
            const result = decToBin([-0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n, 0]) //54bits (...1.1)
            assertEq(result[0], -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n, result[0].toString(2))
            assertEq(result[1], 1)
        },
        () => {
            const result = decToBin([-0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, 0]) //54bits (...0.1)
            assertEq(result[0], -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], 1)
        },
        () => {
            const result = decToBin([-0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n, 0]) //54bits (...1.1)
            assertEq(result[0], -0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n, result[0].toString(2))
            assertEq(result[1], 1)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, 0]) //55bits (...0.01)
            assertEq(result[0], 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n, 0]) //55bits (...0.10)
            assertEq(result[0], 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0110n, 0]) //55bits (...1.10)
            assertEq(result[0], 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n, 0]) //55bits (0.11)
            assertEq(result[0], 0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, result[0].toString(2))
            assertEq(result[1], 2)
        },
    ],
    roundingPositive: [
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, -1])
            // reminder = 0
            // m = 11001100110011001100110011001100110011001100110011001.101
            // rounding up
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_0000n, -1])
            // reminder = 0
            // m = 11001100110011001100110011001100110011001100110011010.000
            // rounding down
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_0100n, -1])
            // reminder = 0
            // m = 11001100110011001100110011001100110011001100110011010.100
            // rounding down (to even)
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_0101n, -1])
            // reminder = 1
            // m = 11001100110011001100110011001100110011001100110011010.100
            // rounding up
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1011n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_1001n, -1])
            // reminder = 0
            // m = 11001100110011001100110011001100110011001100110011010.101
            // rounding up
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1011n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011_1101n, -1])
            // reminder = 0
            // m = 11001100110011001100110011001100110011001100110011011.001
            // rounding down
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1011n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0100_1100n, -1])
            // reminder = 0
            // m = 11001100110011001100110011001100110011001100110011011.100
            // rounding up (to even)
            assertEq(result[0], 0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1100n, result[0].toString(2))
            assertEq(result[1], 2)
        }
    ],
    roundingNegative: [
        () => {
            const result = decToBin([-0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n, -1])
            // reminder = 0
            // m = -11001100110011001100110011001100110011001100110011001.101
            // rounding down
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([-0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_0000n, -1])
            // reminder = 0
            // m = -11001100110011001100110011001100110011001100110011010.000
            // rounding up
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([-0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_0100n, -1])
            // reminder = 0
            // m = -11001100110011001100110011001100110011001100110011010.100
            // rounding up (to even)
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1010n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([-0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_0101n, -1])
            // reminder = 1
            // m = -11001100110011001100110011001100110011001100110011010.100
            // rounding down
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1011n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([-0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_1001n, -1])
            // reminder = 0
            // m = -11001100110011001100110011001100110011001100110011010.101
            // rounding down
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1011n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([-0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011_1101n, -1])
            // reminder = 0
            // m = -11001100110011001100110011001100110011001100110011011.001
            // rounding up
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1011n, result[0].toString(2))
            assertEq(result[1], 2)
        },
        () => {
            const result = decToBin([-0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0100_1100n, -1])
            // reminder = 0
            // m = -11001100110011001100110011001100110011001100110011011.100
            // rounding down (to even)
            assertEq(result[0], -0b1_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1001_1100n, result[0].toString(2))
            assertEq(result[1], 2)
        }
    ],
    // Rounding up out of 53 bits: the mantissa reaches exactly 2^53 before
    // re-normalization. The value is unchanged, only the representation moves
    // one bit right.
    roundingCarry: [
        () => {
            // 2^54 - 1 (54 bits, exact): a tie, and 2^53 - 1 is odd, so
            // half-to-even rounds up to 2^54 = 2^52 * 2^2.
            assertDecToBin([0b11_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                [0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, 2])
        },
        () => {
            assertDecToBin([-0b11_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                [-0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, 2])
        },
        () => {
            // 2^55 - 1 (55 bits): the reduction to 54 bits drops a `1`, so this
            // is not a tie; the plain round-up carries just the same, to
            // 2^55 = 2^52 * 2^3.
            assertDecToBin([0b111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                [0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, 3])
        },
        () => {
            assertDecToBin([-0b111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                [-0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n, 3])
        },
    ],
    // The mantissa width holds at every scale, not just where binary64 has a
    // normal exponent. These two land where binary64 would encode a subnormal
    // (biased exponent 0x000, at most 52 significand bits) and an infinity
    // (0x7ff); `decToBin` clamps neither, and still returns 53 bits. Hex, not
    // binary: these mantissas have no bit pattern worth reading.
    farExponent: [
        () => {
            assertDecToBin([1n, -320])([0x1f_a017_12e8_f047n, -1116])
        },
        () => {
            assertDecToBin([1n, 400])([0x1b_4ec7_f919_73ffn, 1276])
        },
    ]
}
