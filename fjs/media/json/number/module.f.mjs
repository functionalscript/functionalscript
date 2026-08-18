/**
 * Bounded lexical analysis of a JSON number token.
 *
 * `NumberToken.value` is the canonical lossless numeric source, and these
 * helpers read it **without narrowing it first**: every operation here costs
 * at most the length of the token, so a valid JSON number is classified
 * correctly whatever its magnitude. In particular no helper builds a
 * coefficient bigint, converts an arbitrary exponent to `number`, or evaluates
 * a power such as `10 ** exponent`.
 *
 * That matters for schema-directed consumers, which have to decide questions
 * such as "is this token an integer?" *before* a materializer rounds the value
 * into `number`: `1.00000000000000001` and `1` are the same `number` but
 * different tokens.
 *
 * @module
 *
 * @import { Sign } from '../../../types/function/compare/types.ts'
 * @import { NumberLexeme } from './types.ts'
 */

import { cmp } from '../../../types/function/compare/module.f.mjs'

/**
 * Splits a JSON number token into its lexical parts.
 *
 * The token is grammar-validated by the tokenizer —
 * `-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?` — so this is a split, not a
 * validation.
 *
 * @type {(value: string) => NumberLexeme}
 */
export const numberLexeme = value => {
    const sign = value.startsWith('-') ? '-' : ''
    const unsigned = value.slice(sign.length)
    // at most one of 'e'/'E' can occur, so whichever `indexOf` finds is it
    const lowerE = unsigned.indexOf('e')
    const eIndex = lowerE < 0 ? unsigned.indexOf('E') : lowerE
    const coefficient = eIndex < 0 ? unsigned : unsigned.slice(0, eIndex)
    const expText = eIndex < 0 ? '' : unsigned.slice(eIndex + 1)
    const dotIndex = coefficient.indexOf('.')
    const int = dotIndex < 0 ? coefficient : coefficient.slice(0, dotIndex)
    const frac = dotIndex < 0 ? '' : coefficient.slice(dotIndex + 1)
    const expSign = expText.startsWith('-')
        ? '-'
        : expText.startsWith('+') ? '+' : ''
    return { sign, int, frac, expSign, exp: expText.slice(expSign.length) }
}

/**
 * Whether the lexeme is bare integer syntax: no `.` and no `e` / `E`.
 *
 * The distinction is lexical, not mathematical — `1e3` is not bare integer
 * syntax even though its value is the integer `1000`.
 *
 * @type {(lexeme: NumberLexeme) => boolean}
 */
export const isBareInteger = ({ frac, exp }) => frac === '' && exp === ''

/** @type {(digits: string) => string} */
const stripLeadingZeros = digits => {
    let i = 0
    while (i < digits.length && digits[i] === '0') { i += 1 }
    return digits.slice(i)
}

/** @type {(digits: string) => number} */
const trailingZeroCount = digits => {
    let n = 0
    while (n < digits.length && digits[digits.length - 1 - n] === '0') { n += 1 }
    return n
}

/**
 * Compares arbitrarily long non-negative digit text against an ordinary
 * non-negative integer, in the length of that text.
 *
 * Leading zeros are dropped, so equal-length digit strings compare
 * numerically as strings and unequal lengths are decided by length alone.
 * `bound` therefore never has to be turned into digit text long enough to
 * match `digits`, and `digits` never has to become a number.
 *
 * @type {(digits: string) => (bound: number) => Sign}
 */
const compareDigits = digits => bound => {
    const a = stripLeadingZeros(digits)
    const b = stripLeadingZeros(`${bound}`)
    const byLength = cmp(a.length)(b.length)
    return byLength === 0 ? cmp(a)(b) : byLength
}

/**
 * Whether the lexeme's exponent is at least `bound`, an ordinary integer
 * small enough to have come from the token's own length.
 *
 * The exponent itself is never converted: its sign decides which side of the
 * comparison can already be answered, and only its digit text is compared —
 * so `1e-99999999999999999999` is settled by looking at the sign and a length,
 * not by representing that exponent.
 *
 * @type {(lexeme: NumberLexeme) => (bound: number) => boolean}
 */
const exponentAtLeast = ({ expSign, exp }) => bound =>
    expSign === '-'
        // a negative exponent reaches `bound` only if `bound` is not positive
        // and the exponent's magnitude stays within `-bound`
        ? bound <= 0 && compareDigits(exp)(-bound) <= 0
        // a non-negative exponent (`''` — an absent exponent — included, since
        // its digit text is then empty and compares as zero) always reaches a
        // non-positive `bound`
        : bound <= 0 || compareDigits(exp)(bound) >= 0

/**
 * Whether the lexeme spells a mathematical integer.
 *
 * This is the exact question, not the lexical one: `1e3` and `1.00` are
 * integral while `1.5` is not. It stays bounded by the token's length.
 *
 * The value is `coefficient × 10 ** (exponent - fractionDigits)`, so it is an
 * integer exactly when the exponent shifts the decimal point no further right
 * than the coefficient's own trailing zeros allow. Both sides of that
 * comparison — the fraction-digit count and the trailing-zero count — are
 * bounded by the token, so the exponent only ever has to be compared against a
 * small number.
 *
 * A zero coefficient is the simple case: zero is integral for any exponent, so
 * the exponent is not examined at all.
 *
 * @type {(lexeme: NumberLexeme) => boolean}
 */
export const isIntegral = lexeme => {
    const { int, frac } = lexeme
    const coefficient = `${int}${frac}`
    const zeros = trailingZeroCount(coefficient)
    return zeros === coefficient.length || exponentAtLeast(lexeme)(frac.length - zeros)
}
