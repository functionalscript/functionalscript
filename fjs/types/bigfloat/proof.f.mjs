import { decToBin } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { bitLength } from '../bigint/module.f.mjs'

/**
 * Checks `decToBin`'s postcondition on a non-zero result: the mantissa holds
 * exactly 53 significant bits, and `m * 2^e` is the value it should be.
 * `bitLength` measures the magnitude, so a negative mantissa is checked as
 * strictly as a positive one. The value is recovered with a shift, so every
 * `dec` passed here must round to a whole number (a non-negative `e`).
 *
 * @type {(dec: readonly [bigint, number]) => (value: bigint) => void}
 */
const assertRounded = dec => value => {
    const [m, e] = decToBin(dec)
    assertEq(bitLength(m), 53n, m.toString(2))
    assertEq(m << BigInt(e), value, m.toString(2))
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
    // Rounding up a mantissa of all ones carries into a 54th bit; the result
    // has to come back as 53 bits without changing the value.
    roundingCarry: [
        () => {
            // 54 ones: an exact tie (nothing below the dropped bit, remainder
            // 0) whose round-to-even goes up because 2^53 - 1 is odd.
            assertRounded([0b11_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) // 2^54
        },
        () => {
            assertRounded([-0b11_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                -0b100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) // -2^54
        },
        () => {
            // 55 ones: not a tie — the dropped bits are 11 — so the carry comes
            // from the plain round-up path instead.
            assertRounded([0b111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                0b1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) // 2^55
        },
        () => {
            assertRounded([-0b111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n, 0])(
                -0b1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n) // -2^55
        },
        () => {
            // A neighbour that doesn't carry: also a tie, but 2^53 - 2 is even,
            // so round-to-even goes down and the mantissa stays 53 bits wide.
            assertRounded([0b11_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1101n, 0])(
                0b11_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1100n)
        },
    ]
}
