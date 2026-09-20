/**
 * Rust source literals.
 *
 * Printing a value as Rust source is not specific to any one generator: the
 * MVP roadmap's `fjs compile <input>.rs` backend and `nanvm-lib`'s generated
 * operator tests both need the same escaping and the same spelling of the
 * numeric edge cases. This module owns that layer — the syntax of a literal —
 * and nothing above it. Expressions, items, and whatever API a generator
 * targets stay with the generator.
 *
 * The sibling of `fjs/media/nix`, which does the same for Nix expressions.
 *
 * A literal the target type cannot hold — a string with a lone surrogate,
 * which no Rust `&str` can hold, or a bigint outside `i64` — is refused as
 * a `Result` rather than thrown or truncated, and the refusal carries the
 * value itself under `unknown`: this layer commits to nothing about the
 * shape of a reason, and the printer above it names one.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 *
 * @example
 *
 * ```js
 * import { f64Literal, i64Literal, stringLiteral } from './module.f.mjs'
 *
 * stringLiteral('a"b') // ok('"a\\"b"')
 * f64Literal(-0)       // '-0f64'
 * f64Literal(2.3)      // 'f64::from_bits(0x4002666666666666)'
 * i64Literal(-456n)    // ok('-456')
 * ```
 */

import { error, ok } from '../../types/result/module.f.mjs'

/**
 * A character a Rust string literal cannot hold as it stands: a control
 * character — U+0000 to U+001F, or U+007F — or one of the bidirectional
 * controls, U+202A to U+202E and U+2066 to U+2069, which `rustc` refuses in
 * a literal under its default `text_direction_codepoint_in_literal` deny.
 * Each is spelled by its `\u{…}` escape instead. The comparisons are on
 * one character, so they compare its code unit, and every character named
 * here is one code unit.
 *
 * @type {(c: string) => boolean}
 */
const unspellable = c =>
    c < ' ' || c === '\u007f' || (c >= '\u202a' && c <= '\u202e') || (c >= '\u2066' && c <= '\u2069')

/**
 * One character of a Rust string literal: the five escapes Rust and
 * JavaScript spell alike, the `\u{…}` escape for what {@link unspellable}
 * names, and every other character as it stands, Rust source being UTF-8.
 *
 * @type {(c: string) => string}
 */
const character = c => {
    switch (c) {
        case '\\': { return '\\\\' }
        case '"': { return '\\"' }
        case '\n': { return '\\n' }
        case '\r': { return '\\r' }
        case '\t': { return '\\t' }
        default: { return unspellable(c) ? `\\u{${c.charCodeAt(0).toString(16)}}` : c }
    }
}

/**
 * A lone surrogate: one code unit of a pair standing without its partner.
 * Iterating a string yields a paired surrogate as one two-unit character,
 * so a surrogate that arrives alone is the unpaired one.
 *
 * @type {(c: string) => boolean}
 */
const loneSurrogate = c => c.length === 1 && c >= '\ud800' && c <= '\udfff'

/**
 * A double-quoted Rust string literal, or the refusal of a string holding a
 * lone surrogate: a Rust `&str` is UTF-8 and cannot hold one, and no escape
 * spells it — `"\u{d800}"` is refused by `rustc` — so the string has no
 * spelling in the API a printer targets, and is answered back as the
 * refusal rather than written as bytes `rustc` then refuses to read.
 *
 * @type {(v: string) => Result<string, unknown>}
 */
export const stringLiteral = v => {
    const chars = [...v]
    return chars.some(loneSurrogate) ? error(v) : ok(`"${chars.map(character).join('')}"`)
}

/**
 * The exponent of a normal number: the `e` with `2 ** e <= a < 2 ** (e + 1)`,
 * found by bisection over the exponent range, every step an exact
 * comparison against a power of two — `Math.log2` was set aside, since it
 * may round to the integer at a power of two and would need a correction
 * whose other half no input reaches.
 *
 * @type {(a: number) => number}
 */
const exponentOf = a => {
    let low = -1022
    let high = 1024
    while (high - low > 1) {
        const mid = Math.floor((low + high) / 2)
        if (2 ** mid <= a) { low = mid } else { high = mid }
    }
    return low
}

/**
 * The IEEE 754 binary64 bits of a finite, non-zero number, as JavaScript
 * holds it, in exact arithmetic: scaling by a power of two is exact, so
 * the significand is read off as an integer rather than approximated. A
 * subnormal has no leading bit and is scaled straight to its integer
 * significand; a normal number's exponent is {@link exponentOf}. `NaN`,
 * the infinities and the zeros never reach this: each has a spelling of
 * its own in {@link f64Literal}.
 *
 * @type {(v: number) => bigint}
 */
const f64Bits = v => {
    const sign = v < 0 ? 1n << 63n : 0n
    const a = Math.abs(v)
    // scaled in two exact steps: `2 ** 1074` itself is past the largest double
    if (a < 2 ** -1022) { return sign | BigInt(a * 2 ** 1023 * 2 ** 51) }
    const exponent = exponentOf(a)
    const fraction = BigInt((a / 2 ** exponent - 1) * 2 ** 52)
    return sign | BigInt(exponent + 1023) << 52n | fraction
}

/**
 * An `f64` literal. `NaN`, the two infinities and `-0` are the constants
 * Rust names them by, `-0` being the one zero `toString` loses; a safe
 * integer is its digits, `42f64`, which is exact, reads as the value, and
 * is never one of the constants clippy's `approx_constant` names; every
 * other number — a fraction, an integer past `2 ** 53` — is its bits,
 * `f64::from_bits(0x…)`, sixteen hex digits, exact by construction, with
 * nothing for clippy to read as an approximation and no reliance on the
 * two languages agreeing on shortest round-trip printing. A single
 * all-bits spelling was weighed and set aside: it made the generated
 * operator corpus outgrow the 128 KiB a `writeUtf8File` can write, where
 * integers are most of its numbers.
 *
 * @type {(v: number) => string}
 */
export const f64Literal = v => {
    if (Number.isNaN(v)) { return 'f64::NAN' }
    if (v === Infinity) { return 'f64::INFINITY' }
    if (v === -Infinity) { return 'f64::NEG_INFINITY' }
    if (Object.is(v, -0)) { return '-0f64' }
    return Number.isSafeInteger(v)
        ? `${v}f64`
        : `f64::from_bits(0x${f64Bits(v).toString(16).padStart(16, '0')})`
}

const i64Min = -(2n ** 63n)
const i64Max = 2n ** 63n - 1n

/**
 * An `i64` literal, or the refusal of a value the type cannot hold, rather
 * than a silent truncation.
 *
 * @type {(v: bigint) => Result<string, unknown>}
 */
export const i64Literal = v => v < i64Min || v > i64Max ? error(v) : ok(v.toString())

/**
 * A `snake_case` Rust identifier from a `camelCase` name.
 *
 * Only the casing is converted: a name that is not already a valid identifier
 * stays invalid, so callers pass names they control.
 *
 * @type {(v: string) => string}
 */
export const snakeCase = v => [...v].map(c => {
    const lower = c.toLowerCase()
    return c === lower ? c : `_${lower}`
}).join('')
