/**
 * Proofs for Rust source literals.
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { f64Bits, i64Literal, snakeCase, stringLiteral, withoutStringLiterals } from './module.f.mjs'

export const proof = {
    /** Every literal's contents go, an escaped quote or backslash inside one included; the code around them stays. */
    withoutStringLiterals: () => {
        assertEq(withoutStringLiterals('f("a", x)'), 'f("", x)')
        assertEq(withoutStringLiterals('f("a\\"b", "c\\\\", x)'), 'f("", "", x)')
        assertEq(withoutStringLiterals('f(x)'), 'f(x)')
        assertEq(withoutStringLiterals(''), '')
    },
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
    f64Bits: () => {
        // One spelling for every number, its own bits: the values a decimal
        // literal cannot spell are ordinary here.
        assertEq(f64Bits(0), '0x0000000000000000')
        assertEq(f64Bits(-0), '0x8000000000000000')
        assertEq(f64Bits(1), '0x3ff0000000000000')
        assertEq(f64Bits(-1), '0xbff0000000000000')
        assertEq(f64Bits(2.3), '0x4002666666666666')
        assertEq(f64Bits(-0.3), '0xbfd3333333333333')
        assertEq(f64Bits(-239), '0xc06de00000000000')
        assertEq(f64Bits(1e21), '0x444b1ae4d6e2ef50')
        assertEq(f64Bits(NaN), '0x7ff8000000000000')
        assertEq(f64Bits(-NaN), '0x7ff8000000000000')
        assertEq(f64Bits(Infinity), '0x7ff0000000000000')
        assertEq(f64Bits(-Infinity), '0xfff0000000000000')
        // Either side of a power of two, and the two neighbours of 1.
        assertEq(f64Bits(1024), '0x4090000000000000')
        assertEq(f64Bits(0.9999999999999999), '0x3fefffffffffffff')
        assertEq(f64Bits(1.0000000000000002), '0x3ff0000000000001')
        // The largest and the smallest normal, and two subnormals down to
        // the smallest double there is.
        assertEq(f64Bits(1.7976931348623157e308), '0x7fefffffffffffff')
        assertEq(f64Bits(2.2250738585072014e-308), '0x0010000000000000')
        assertEq(f64Bits(2.225073858507201e-308), '0x000fffffffffffff')
        assertEq(f64Bits(5e-324), '0x0000000000000001')
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
