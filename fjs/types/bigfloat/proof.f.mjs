import { binary64, decToBin, tryDecToFormat } from './module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { abs, bitLength } from '../bigint/module.f.mjs'

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

const toBinary64 = tryDecToFormat(binary64)

/**
 * The exact decimal for the dyadic value `m * 2^k`, as a `BigFloat` this
 * module's own functions take: `2^k = 5^-k * 10^k` for a negative `k`, so no
 * decimal digit is ever approximated on the way in. Every boundary below is
 * stated as a power of two, which is the grid the format is defined on.
 *
 * @type {(m: bigint, k: number) => readonly [bigint, number]}
 */
const dyadic = (m, k) => k >= 0 ? [m << BigInt(k), 0] : [m * 5n ** BigInt(-k), k]

/**
 * Asserts that `toBinary64` answers exactly `[m, e]` for the exact decimal of
 * `dyadic(dm, dk)`, and that the answer respects the format: on the
 * `2^-1074` grid, and no wider than 53 bits.
 *
 * @type {(dyad: readonly [bigint, number]) => (expected: readonly [bigint, number]) => void}
 */
const assertBinary64 = ([dm, dk]) => expected => {
    const result = toBinary64(dyadic(dm, dk))
    assertStructurallySame(result, expected, [dm, dk])
    const [m, e] = expected
    assert(e >= binary64.minExp, expected)
    assert(bitLength(abs(m)) <= BigInt(binary64.precision), expected)
}

/**
 * Asserts that the exact decimal of `dyadic(dm, dk)` overflows the format.
 *
 * @type {(dyad: readonly [bigint, number]) => void}
 */
const assertOverflow = ([dm, dk]) => assertEq(toBinary64(dyadic(dm, dk)), null, [dm, dk])

/**
 * Cross-checks `toBinary64` against `Number(decimal)`, which the language
 * specifies to be correctly rounded — the same claim this function makes, so
 * disagreement on any input is a defect in one of them.
 *
 * A `null` stands for an infinity, which `BigFloat` cannot encode. `-0` is
 * folded into `0` by the addition: a bigint mantissa has no signed zero, so
 * the sign of an underflowed value is information this representation does
 * not carry.
 *
 * @type {(dec: readonly [bigint, number]) => void}
 */
const assertSameAsNumber = ([dm, de]) => {
    const expected = Number(`${dm}e${de}`)
    const result = toBinary64([dm, de])
    const actual = result === null
        ? (dm < 0n ? -Infinity : Infinity)
        : Number(result[0]) * 2 ** result[1]
    assertEq(actual + 0, expected + 0, [dm, de, result])
}

/** @type {(from: number) => (to: number) => readonly number[]} */
const range = from => to => Array.from({ length: to - from + 1 }, (_, i) => from + i)

/**
 * A deterministic corpus of decimals: ten mantissas of both signs against
 * every decimal exponent from below the subnormal range to past the top of
 * the format, so every branch of the conversion is crossed by construction.
 *
 * @type {readonly (readonly [bigint, number])[]}
 */
const corpus = [1n, 2n, 3n, 5n, 7n, 9n, 10n, 4999999999999999n, 5000000000000001n, 12345678901234567890n]
    .flatMap(dm => [dm, -dm])
    .flatMap(dm => range(-340)(320).map(de => /** @type {readonly [bigint, number]} */([dm, de])))

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
    ],
    // `tryDecToFormat(binary64)` rounds once, onto the grid the target format
    // actually has. Every case below is stated as an exact decimal for a
    // dyadic value, so the input names a point on that grid or a known
    // distance from one.
    tryDecToFormat: [
        // The case this function exists for. One part in 2^126 below the
        // midpoint between the subnormals 3*2^-1074 and 4*2^-1074: the
        // correctly-rounded answer is 3, and `decToBin`'s 53-bit answer is the
        // midpoint itself, which rounds the other way because 3 is odd.
        () => {
            const dec = /** @type {const} */([(7n * 2n ** 125n - 1n) * 5n ** 1200n, -1200])
            assertStructurallySame(decToBin(dec), [7881299347898368n, -1125], 'the midpoint decToBin lands on')
            assertStructurallySame(toBinary64(dec), [3n, -1074], 'rounded once, below the midpoint')
        },
        // minExp exactly: the smallest value the format holds.
        () => assertBinary64([1n, -1074])([1n, -1074]),
        () => assertBinary64([3n, -1074])([3n, -1074]),
        // Half of it is an exact tie, and 0 is the even side.
        () => assertBinary64([1n, -1075])([0n, 0]),
        // A hair above that tie rounds up; a hair below rounds down.
        () => assertEq(toBinary64([5n ** 1075n + 1n, -1075])?.[0], 1n),
        () => assertEq(toBinary64([5n ** 1075n - 1n, -1075])?.[0], 0n),
        // Ties inside the subnormal range go to even in both directions.
        () => assertBinary64([7n, -1075])([4n, -1074]),
        () => assertBinary64([11n, -1075])([6n, -1074]),
        // minExp + 52: the smallest normal, where full precision resumes. Its
        // mantissa fills all 53 bits and its exponent is still minExp.
        () => assertBinary64([1n, -1022])([1n << 52n, -1074]),
        () => assertBinary64([(1n << 52n) - 1n, -1074])([(1n << 52n) - 1n, -1074]),
        // maxExp exactly: the largest finite value.
        () => assertBinary64([(1n << 53n) - 1n, 971])([(1n << 53n) - 1n, 971]),
        () => assertBinary64([-((1n << 53n) - 1n), 971])([-((1n << 53n) - 1n), 971]),
        // Rounding up out of the top bit has to come back as `precision` bits,
        // not `precision + 1`. Nothing else here catches a missing
        // re-normalization: the overflow check is invariant under it
        // (`54 + (e + 1)` is `53 + (e + 2)`) and the value is the same either
        // way, so only the width assertion sees it.
        () => assertBinary64([(1n << 54n) - 1n, -54])([1n << 52n, -52]),
        () => assertBinary64([-((1n << 54n) - 1n), -54])([-(1n << 52n), -52]),
        // Past it: 2^1024 outright, and the midpoint below it, which overflows
        // by rounding up rather than by magnitude.
        () => assertOverflow([1n, 1024]),
        () => assertOverflow([-1n, 1024]),
        () => assertOverflow([(1n << 54n) - 1n, 970]),
        () => assertBinary64([(((1n << 54n) - 1n) << 970n) - 1n, 0])([(1n << 53n) - 1n, 971]),
        // Underflow is an answer, not a failure: it is the correctly-rounded
        // one. A bigint mantissa has no signed zero, so both signs give `0n`.
        () => assertBinary64([1n, -1200])([0n, 0]),
        () => assertBinary64([-1n, -1200])([0n, 0]),
        () => assertBinary64([0n, 0])([0n, 0]),
        () => assertEq(toBinary64([0n, -400])?.[1], 0),
        // Negatives mirror positives exactly, subnormals included.
        () => assertBinary64([-3n, -1074])([-3n, -1074]),
        () => assertBinary64([-1n, -1022])([-(1n << 52n), -1074]),
        () => assertBinary64([-1n, 0])([-(1n << 52n), -52]),
        // A whole-number input takes the other scaling branch (`de >= 0`),
        // both when it needs widening and when it needs truncating.
        () => assertBinary64([1n, 0])([1n << 52n, -52]),
        () => assertBinary64([(1n << 60n) + 1n, 0])([1n << 52n, 8]),
    ],
    // Cross-check against `Number(decimal)`, which the language specifies to
    // be correctly rounded. 13220 decimals, every one of them agreeing.
    binary64AgreesWithNumber: () => corpus.forEach(assertSameAsNumber),
}
