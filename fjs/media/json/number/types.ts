/**
 * Types for the lexical view of a JSON number token.
 *
 * @module
 */

/**
 * The parts of a JSON number lexeme, each kept as text.
 *
 * Nothing here is narrowed to a runtime numeric type, so a lexeme describes
 * every syntactically valid JSON number — including coefficients larger than
 * the runtime can build as a `bigint` and exponents beyond `number` precision.
 *
 * The empty string means "absent" for both optional parts, which is
 * unambiguous: JSON requires at least one digit after `.` and at least one
 * exponent digit, so a present part is never empty.
 */
export type NumberLexeme = {
    /** `'-'` for a negative number, `''` otherwise. */
    readonly sign: '' | '-'
    /** The integer digits; always at least one digit. */
    readonly int: string
    /** The fraction digits, or `''` when the lexeme has no `.`. */
    readonly frac: string
    /** The exponent sign as written, or `''` when it is omitted. */
    readonly expSign: '' | '+' | '-'
    /** The exponent digits, or `''` when the lexeme has no `e` / `E`. */
    readonly exp: string
}
