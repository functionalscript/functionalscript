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
 * @module
 *
 * @example
 *
 * ```js
 * import { f64Literal, i64Literal, stringLiteral } from './module.f.mjs'
 *
 * stringLiteral('a"b') // '"a\\"b"'
 * f64Literal(-0)       // '-0f64'
 * i64Literal(-456n)    // '-456'
 * ```
 */

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
 * A double-quoted Rust string literal.
 *
 * A lone surrogate passes through as it stands, which no Rust literal can
 * hold — [strings a Rust literal cannot
 * spell](./todo/strings-rust-cannot-spell.md).
 *
 * @type {(v: string) => string}
 */
export const stringLiteral = v => `"${[...v].map(character).join('')}"`

/**
 * An `f64` literal.
 *
 * `toString` already prints the shortest round-tripping decimal and Rust
 * parses decimal float literals the same way JavaScript does, so the digits
 * carry over unchanged. Only the three non-finite values and `-0` — which
 * `toString` prints as `0` — need spelling out. The `f64` suffix keeps whole
 * numbers from lexing as integers.
 *
 * @type {(v: number) => string}
 */
export const f64Literal = v => {
    if (Number.isNaN(v)) { return 'f64::NAN' }
    if (v === Infinity) { return 'f64::INFINITY' }
    if (v === -Infinity) { return 'f64::NEG_INFINITY' }
    return `${Object.is(v, -0) ? '-0' : v.toString()}f64`
}

const i64Min = -(2n ** 63n)
const i64Max = 2n ** 63n - 1n

/**
 * An `i64` literal. Throws for a value the type cannot hold, rather than
 * silently truncating it.
 *
 * @type {(v: bigint) => string}
 */
export const i64Literal = v => {
    if (v < i64Min || v > i64Max) { throw ['bigint out of i64 range', v] }
    return v.toString()
}

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
