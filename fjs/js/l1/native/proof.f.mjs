import { assert, assertEq } from '../../../asserts/module.f.js'
import { bigintEquals, bigintToString, numberToString, stringToNumber } from './module.f.js'

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
    throw: {
        numberToString: () => { numberToString('1') },
        stringToNumber: () => { stringToNumber(1) },
        bigintToString: () => { bigintToString(1) },
        // either operand that is no bigint traps
        first: () => { bigintEquals(1, 1n) },
        second: () => { bigintEquals(1n, 1) },
    },
}
