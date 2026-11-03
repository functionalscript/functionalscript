import { assert, assertEq } from '../../../asserts/module.f.js'
import {
    bigintAdd, bigintDivide, bigintEquals, bigintLess, bigintMultiply, bigintNegate, bigintSubtract,
    bigintToString, numberToString, stringToNumber,
} from './module.f.js'

export const proof = {
    // `bigintEquals` is `===` on two bigints.
    bigintEquals: () => {
        assert(bigintEquals(0n, 0n))
        assert(bigintEquals(0x1_0000_0000_0000_0000n, 0x1_0000_0000_0000_0000n))
        assert(!bigintEquals(1n, -1n))
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
        bigintLessNoBigint: () => { bigintLess(1, '1') },
        bigintLessFirst: () => { bigintLess(true, 1n) },
        bigintLessSecond: () => { bigintLess(1n, null) },
        numberToString: () => { numberToString('1') },
        stringToNumber: () => { stringToNumber(1) },
        bigintToString: () => { bigintToString(1) },
        // either operand that is no bigint traps
        first: () => { bigintEquals(1, 1n) },
        second: () => { bigintEquals(1n, 1) },
    },
}
