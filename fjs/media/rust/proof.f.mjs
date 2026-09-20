/**
 * Proofs for Rust source literals.
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { f64Literal, i64Literal, snakeCase, stringLiteral } from './module.f.mjs'

export const proof = {
    stringLiteral: () => {
        assertStructurallySame(stringLiteral(''), ok('""'))
        assertStructurallySame(stringLiteral('abc'), ok('"abc"'))
        assertStructurallySame(stringLiteral('a\\b'), ok('"a\\\\b"'))
        assertStructurallySame(stringLiteral('a"b'), ok('"a\\"b"'))
        assertStructurallySame(stringLiteral('a\nb'), ok('"a\\nb"'))
        assertStructurallySame(stringLiteral('a\rb'), ok('"a\\rb"'))
        assertStructurallySame(stringLiteral('a\tb'), ok('"a\\tb"'))
        // Non-ASCII needs no escape: Rust source is UTF-8. A surrogate pair
        // is one character, not two lone surrogates.
        assertStructurallySame(stringLiteral('é'), ok('"é"'))
        assertStructurallySame(stringLiteral('‰😀'), ok('"‰😀"'))
        // A control character has no place in a Rust literal as it stands,
        // and neither has a bidirectional control, which `rustc` refuses:
        // both take the `\u{…}` escape.
        assertStructurallySame(stringLiteral('a\u0000b'), ok('"a\\u{0}b"'))
        assertStructurallySame(stringLiteral('\u001f'), ok('"\\u{1f}"'))
        assertStructurallySame(stringLiteral('a\u007fb'), ok('"a\\u{7f}b"'))
        assertStructurallySame(stringLiteral('a\u202ab\u202ec'), ok('"a\\u{202a}b\\u{202e}c"'))
        assertStructurallySame(stringLiteral('a\u2066b\u2069c'), ok('"a\\u{2066}b\\u{2069}c"'))
        // A lone surrogate, high or low, has no spelling: the refusal is
        // the string itself.
        assertStructurallySame(stringLiteral('a\ud800b'), error('a\ud800b'))
        assertStructurallySame(stringLiteral('\udc00'), error('\udc00'))
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
        assertStructurallySame(i64Literal(0n), ok('0'))
        assertStructurallySame(i64Literal(-456n), ok('-456'))
        assertStructurallySame(i64Literal(-(2n ** 63n)), ok('-9223372036854775808'))
        assertStructurallySame(i64Literal(2n ** 63n - 1n), ok('9223372036854775807'))
        // One past either end of `i64`: the refusal is the value itself.
        assertStructurallySame(i64Literal(2n ** 63n), error(2n ** 63n))
        assertStructurallySame(i64Literal(-(2n ** 63n) - 1n), error(-(2n ** 63n) - 1n))
    },
    snakeCase: () => {
        assertEq(snakeCase('emptyArray'), 'empty_array')
        assertEq(snakeCase('stringCoercion'), 'string_coercion')
        assertEq(snakeCase('eq'), 'eq')
    },
}
