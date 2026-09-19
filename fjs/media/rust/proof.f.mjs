/**
 * Proofs for Rust source literals.
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
        assertEq(stringLiteral('‰😀'), '"‰😀"')
        // A control character has no place in a Rust literal as it stands,
        // and neither has a bidirectional control, which `rustc` refuses:
        // both take the `\u{…}` escape.
        assertEq(stringLiteral('a\u0000b'), '"a\\u{0}b"')
        assertEq(stringLiteral('\u001f'), '"\\u{1f}"')
        assertEq(stringLiteral('a\u007fb'), '"a\\u{7f}b"')
        assertEq(stringLiteral('a\u202ab\u202ec'), '"a\\u{202a}b\\u{202e}c"')
        assertEq(stringLiteral('a\u2066b\u2069c'), '"a\\u{2066}b\\u{2069}c"')
        // A lone surrogate is not spelled yet — `./todo/strings-rust-cannot-spell.md`.
        assertEq(stringLiteral('\ud800'), '"\ud800"')
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
    },
}
