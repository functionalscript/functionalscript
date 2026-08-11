/**
 * Proofs for Rust source literals.
 *
 * @module
 */
import { assertEq } from '../../asserts/module.f.mjs'
import { f64Literal, i64Literal, snakeCase, stringLiteral } from './module.f.mjs'

export const proof = {
    stringLiteral: () => {
        assertEq(stringLiteral(''), '""')
        assertEq(stringLiteral('abc'), '"abc"')
        assertEq(stringLiteral('a\\b'), '"a\\\\b"')
        assertEq(stringLiteral('a"b'), '"a\\"b"')
        assertEq(stringLiteral('a\nb'), '"a\\nb"')
        assertEq(stringLiteral('a\rb'), '"a\\rb"')
        assertEq(stringLiteral('a\tb'), '"a\\tb"')
        // Non-ASCII needs no escape: Rust source is UTF-8.
        assertEq(stringLiteral('é'), '"é"')
    },
    f64Literal: () => {
        assertEq(f64Literal(NaN), 'f64::NAN')
        assertEq(f64Literal(Infinity), 'f64::INFINITY')
        assertEq(f64Literal(-Infinity), 'f64::NEG_INFINITY')
        assertEq(f64Literal(-0), '-0f64')
        assertEq(f64Literal(0), '0f64')
        assertEq(f64Literal(2.3), '2.3f64')
        assertEq(f64Literal(-239), '-239f64')
        // Rust's exponent accepts a `+`, which is how `toString` prints it.
        assertEq(f64Literal(1e21), '1e+21f64')
    },
    i64Literal: () => {
        assertEq(i64Literal(0n), '0')
        assertEq(i64Literal(-456n), '-456')
        assertEq(i64Literal(-(2n ** 63n)), '-9223372036854775808')
        assertEq(i64Literal(2n ** 63n - 1n), '9223372036854775807')
    },
    snakeCase: () => {
        assertEq(snakeCase('emptyArray'), 'empty_array')
        assertEq(snakeCase('stringCoercion'), 'string_coercion')
        assertEq(snakeCase('eq'), 'eq')
    },
    throw: {
        i64TooLarge: () => i64Literal(2n ** 63n),
        i64TooSmall: () => i64Literal(-(2n ** 63n) - 1n),
        controlCharacter: () => stringLiteral('a\u0000b'),
        deleteCharacter: () => stringLiteral('a\u007fb'),
    },
}
