/**
 * Provides ASCII code point constants and helpers for creating numeric code points and inclusive ranges.
 *
 * @module
 */

/** @import { Range } from '../../types/range/module.f.mjs' */

/** @type {(s: string) => (i: number) => number} */
const at = s => i => {
    const r = s.codePointAt(i)
    if (r === void 0) { throw s }
    return r
}

/** Returns the code point value of the first character in a string. @type {(s: string) => number} */
export const one = s => at(s)(0)

/** Returns an inclusive code point range from the first two characters in a string. @type {(s: string) => Range} */
export const range = s => {
    const f = at(s)
    const f0 = f(0)
    if (s.length === 1) { return [f0, f0] }
    return [f0, f(1)]
}

// 0x00..

/** 0x08 */
export const backspace = one('\b')

/** 0x09 */
export const ht = one('\t')

/** 0x0A */
export const lf = one('\n')

/** 0x0C */
export const ff = one('\f')

/** 0x0D */
export const cr = one('\r')

// 0x20..

/** 0x20 */
export const space = one(' ')

/** 0x21 */
export const exclamationMark = one('!')

/** 0x22 */
export const quotationMark = one('"')

/** 0x23 */
export const numberSign = one('#')

/** 0x24 */
export const dollarSign = one('$')

/** 0x25 */
export const percentSign = one('%')

/** 0x26 */
export const ampersand = one('&')

/** 0x27 */
export const apostrophe = one("'")

/** 0x28 */
export const leftParenthesis = one('(')

/** 0x29 */
export const rightParenthesis = one(')')

/** 0x2A */
export const asterisk = one('*')

/** 0x2B */
export const plusSign = one('+')

/** 0x2C */
export const comma = one(',')

/** 0x2D */
export const hyphenMinus = one('-')

/** 0x2E */
export const fullStop = one('.')

/** 0x2F */
export const solidus = one('/')

// 0x30..

/** 0x30..0x39 */
export const digitRange = range('09')

/** 0x30 */
export const digit0 = one('0')

/** 0x31 */
export const digit1 = one('1')

/** 0x32 */
export const digit2 = one('2')

/** 0x33 */
export const digit3 = one('3')

/** 0x34 */
export const digit4 = one('4')

/** 0x35 */
export const digit5 = one('5')

/** 0x36 */
export const digit6 = one('6')

/** 0x37 */
export const digit7 = one('7')

/** 0x38 */
export const digit8 = one('8')

/** 0x39 */
export const digit9 = one('9')

/** 0x3A */
export const colon = one(':')

/** 0x3B */
export const semicolon = one(';')

/** 0x3C */
export const lessThanSign = one('<')

/** 0x3D */
export const equalsSign = one('=')

/** 0x3E */
export const greaterThanSign = one('>')

/** 0x3F */
export const questionMark = one('?')

// 0x40..

/** 0x40 */
export const commercialAt = one('@')

/** 0x41..0x5A */
export const latinCapitalLetterRange = range('AZ')

/** 0x41 */
export const latinCapitalLetterA = one('A')

/** 0x45 */
export const latinCapitalLetterE = one('E')

/** 0x46 */
export const latinCapitalLetterF = one('F')

/** 0x5B */
export const leftSquareBracket = one('[')

/** 0x5C */
export const reverseSolidus = one('\\')

/** 0x5D */
export const rightSquareBracket = one(']')

/** 0x5E */
export const circumflexAccent = one('^')

/** 0x5F */
export const lowLine = one('_')

// 0x60..

/** 0x60 */
export const graveAccent = one('`')

/** 0x61..0x7A */
export const latinSmallLetterRange = range('az')

/** 0x61 */
export const latinSmallLetterA = one('a')

/** 0x62 */
export const latinSmallLetterB = one('b')

/** 0x65 */
export const latinSmallLetterE = one('e')

/** 0x66 */
export const latinSmallLetterF = one('f')

/** 0x6E */
export const latinSmallLetterN = one('n')

/** 0x72 */
export const latinSmallLetterR = one('r')

/** 0x74 */
export const latinSmallLetterT = one('t')

/** 0x75 */
export const latinSmallLetterU = one('u')

/** 0x7A */
export const latinSmallLetterZ = one('z')

/** 0x7B */
export const leftCurlyBracket = one('{')

/** 0x7C */
export const verticalLine = one('|')

/** 0x7D */
export const rightCurlyBracket = one('}')

/** 0x7E */
export const tilde = one('~')
