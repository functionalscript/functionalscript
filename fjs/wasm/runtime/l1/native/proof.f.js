import { assert, assertEq } from '../../../../asserts/module.f.js'
import {
    bigintAdd, bigintDivide, bigintEquals, bigintLess, bigintMultiply, bigintNegate, bigintSubtract,
    bigintToString, numberRemainder, numberToString, stringToNumber,
    numberShiftRight, numberAnd, bigintRemainder, bigintShiftRight, bigintAnd, bigintToNumber, stringToBigInt,
} from './module.f.js'

export const proof = {
    // `bigintEquals` is `===` on two bigints.
    bigintEquals: () => {
        assert(bigintEquals(0n, 0n))
        assert(bigintEquals(0x1_0000_0000_0000_0000n, 0x1_0000_0000_0000_0000n))
        assert(!bigintEquals(1n, -1n))
    },
    // `numberRemainder` is `%` on two numbers: the dividend's sign, and `NaN`
    // for a zero divisor or an infinite dividend.
    numberRemainder: () => {
        assertEq(numberRemainder(5.5, 2), 1.5)
        assertEq(numberRemainder(-5, 3), -2)
        assert(Object.is(numberRemainder(-4, 2), -0))
        assertEq(numberRemainder(3, -Infinity), 3)
        assert(Number.isNaN(numberRemainder(1, 0)))
        assert(Number.isNaN(numberRemainder(-Infinity, 1)))
    },
    // `numberShiftRight` and `numberAnd` read each number as a 32-bit integer,
    // the shift by its low five bits.
    bits: () => {
        assertEq(numberShiftRight(-9, 1), -5)
        assertEq(numberShiftRight(2 ** 32 + 8, 33), 4)
        assertEq(numberShiftRight(NaN, 1), 0)
        assertEq(numberAnd(0b1100, 0b1010), 0b1000)
        assertEq(numberAnd(-1, 2 ** 32 + 5), 5)
        assertEq(numberAnd(1.9, Infinity), 0)
    },
    // `numberToString` is `String` of a number, the shortest round trip.
    numberToString: () => {
        assertEq(numberToString(-0), '0')
        assertEq(numberToString(0.1 + 0.2), '0.30000000000000004')
        assertEq(numberToString(1e21), '1e+21')
        assertEq(numberToString(NaN), 'NaN')
        assertEq(numberToString(-Infinity), '-Infinity')
    },
    // `stringToNumber` is `Number` of a string.
    stringToNumber: () => {
        assertEq(stringToNumber(' 12 '), 12)
        assertEq(stringToNumber(''), 0)
        assertEq(stringToNumber('0x10'), 0x10)
        assertEq(stringToNumber('-Infinity'), -Infinity)
        assert(Number.isNaN(stringToNumber('1n')))
    },
    // `stringToBigInt` is `BigInt` of a decimal integer's text.
    stringToBigInt: () => {
        assertEq(stringToBigInt('-18412322765356148968355179291658'), -18412322765356148968355179291658n)
        assertEq(stringToBigInt('0'), 0n)
        assertEq(stringToBigInt('-007'), -7n)
    },
    // `bigintToString` is `String` of a bigint.
    bigintToString: () => {
        assertEq(bigintToString(0n), '0')
        assertEq(bigintToString(-0x1_0000_0000_0000_0000n), '-18446744073709551616')
    },
    // The arithmetic rows are JavaScript's bigint operators, `/` truncated
    // toward zero.
    arithmetic: () => {
        assertEq(bigintAdd(0xffff_ffff_ffff_ffffn, 1n), 0x1_0000_0000_0000_0000n)
        assertEq(bigintSubtract(1n, 3n), -2n)
        assertEq(bigintMultiply(-3n, 4n), -12n)
        assertEq(bigintDivide(-7n, 2n), -3n)
        assertEq(bigintNegate(5n), -5n)
        assertEq(bigintNegate(0n), 0n)
        assertEq(bigintRemainder(-7n, 2n), -1n)
        assertEq(bigintShiftRight(-1n, 100n), -1n)
        assertEq(bigintShiftRight(-9n, 1n), -5n)
        assertEq(bigintShiftRight(1n, -70n), 0x40_0000_0000_0000_0000n)
        assertEq(bigintAnd(-1n, 0x1_0000_0000_0000_0005n), 0x1_0000_0000_0000_0005n)
        assertEq(bigintAnd(-4n, -6n), -8n)
        assertEq(bigintToNumber(-(2n ** 64n) - 1n), -18446744073709552000)
        assertEq(bigintToNumber(2n ** 1024n), Infinity)
    },
    // `bigintLess` answers `1`, `0` or `-1`, a string read as a bigint and
    // undefined where it spells none, or against `NaN`.
    bigintLess: () => {
        assertEq(bigintLess(1n, 2n), 1)
        assertEq(bigintLess(2n, 1n), 0)
        assertEq(bigintLess(1n, 1.5), 1)
        assertEq(bigintLess(2, 1n), 0)
        assertEq(bigintLess(1n, '2'), 1)
        assertEq(bigintLess(' 3 ', 1n), 0)
        assertEq(bigintLess(1n, '1.5'), -1)
        assertEq(bigintLess(NaN, 1n), -1)
        assertEq(bigintLess(1n, Infinity), 1)
    },
    throw: {
        bigintAddFirst: () => { bigintAdd(1, 1n) },
        bigintSubtractSecond: () => { bigintSubtract(1n, 1) },
        bigintMultiply: () => { bigintMultiply(1, 1) },
        bigintDivideZero: () => { bigintDivide(1n, 0n) },
        bigintDivide: () => { bigintDivide('1', 1n) },
        bigintNegate: () => { bigintNegate(1) },
        bigintRemainderZero: () => { bigintRemainder(1n, 0n) },
        bigintRemainder: () => { bigintRemainder(1, 1n) },
        bigintShiftRight: () => { bigintShiftRight(1n, 1) },
        bigintAnd: () => { bigintAnd(1n, 1) },
        bigintToNumber: () => { bigintToNumber(1) },
        stringToBigIntNone: () => { stringToBigInt('1.5') },
        stringToBigIntHex: () => { stringToBigInt('0x10') },
        stringToBigIntEmpty: () => { stringToBigInt('') },
        stringToBigIntSign: () => { stringToBigInt('-') },
        stringToBigInt: () => { stringToBigInt(1) },
        numberShiftRight: () => { numberShiftRight('1', 1) },
        numberAnd: () => { numberAnd(1, 1n) },
        bigintLessNoBigint: () => { bigintLess(1, '1') },
        bigintLessFirst: () => { bigintLess(true, 1n) },
        bigintLessSecond: () => { bigintLess(1n, null) },
        numberRemainderFirst: () => { numberRemainder('1', 1) },
        numberRemainderSecond: () => { numberRemainder(1, 1n) },
        numberToString: () => { numberToString('1') },
        stringToNumber: () => { stringToNumber(1) },
        bigintToString: () => { bigintToString(1) },
        // either operand that is no bigint traps
        first: () => { bigintEquals(1, 1n) },
        second: () => { bigintEquals(1n, 1) },
    },
}
