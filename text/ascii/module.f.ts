import { type Range } from '../../types/range/module.f.ts'

const at
    : (s: string) => (i: number) => number
    = s => i => {
    const r = s.codePointAt(i)
    if (r === void 0) { throw s }
    return r
}

export const one = (s: string): number => at(s)(0)

export const range
    : (s: string) => Range
    = s => {
    const f = at(s)
    const f0 = f(0)
    if (s.length === 1) { return [f0, f0] }
    return [f0, f(1)]
}

// 0x00..

/** 0x08 */
export const backspace: number = one('\b')

/** 0x09 */
export const ht: number = one('\t')

/** 0x0A */
export const lf: number = one('\n')

/** 0x0C */
export const ff: number = one('\f')

/** 0x0D */
export const cr: number = one('\r')

// 0x20..

/** 0x20 */
export const space: number = one(' ')

/** 0x21 */
export const exclamationMark: number = one('!')

/** 0x22 */
export const quotationMark: number = one('"')

/** 0x23 */
export const numberSign: number = one('#')

/** 0x24 */
export const dollarSign: number = one('$')

/** 0x25 */
export const percentSign: number = one('%')

/** 0x26 */
export const ampersand: number = one('&')

/** 0x27 */
export const apostrophe: number = one("'")

/** 0x28 */
export const leftParenthesis: number = one('(')

/** 0x29 */
export const rightParenthesis: number = one(')')

/** 0x2A */
export const asterisk: number = one('*')

/** 0x2B */
export const plusSign: number = one('+')

/** 0x2C */
export const comma: number = one(',')

/** 0x2D */
export const hyphenMinus: number = one('-')

/** 0x2E */
export const fullStop: number = one('.')

/** 0x2F */
export const solidus: number = one('/')

// 0x30..

/** 0x30..0x39 */
export const digitRange: Range = range('09')

/** 0x30 */
export const digit0: number = one('0')

/** 0x31 */
export const digit1: number = one('1')

/** 0x32 */
export const digit2: number = one('2')

/** 0x33 */
export const digit3: number = one('3')

/** 0x34 */
export const digit4: number = one('4')

/** 0x35 */
export const digit5: number = one('5')

/** 0x36 */
export const digit6: number = one('6')

/** 0x37 */
export const digit7: number = one('7')

/** 0x38 */
export const digit8: number = one('8')

/** 0x39 */
export const digit9: number = one('9')

/** 0x3A */
export const colon: number = one(':')

/** 0x3B */
export const semicolon: number = one(';')

/** 0x3C */
export const lessThanSign: number = one('<')

/** 0x3D */
export const equalsSign: number = one('=')

/** 0x3E */
export const greaterThanSign: number = one('>')

/** 0x3F */
export const questionMark: number = one('?')

// 0x40..

/** 0x40 */
export const commercialAt: number = one('@')

/** 0x41..0x5A */
export const latinCapitalLetterRange: Range = range('AZ')

/** 0x41 */
export const latinCapitalLetterA: number = one('A')

/** 0x45 */
export const latinCapitalLetterE: number = one('E')

/** 0x46 */
export const latinCapitalLetterF: number = one('F')

/** 0x5B */
export const leftSquareBracket: number = one('[')

/** 0x5C */
export const reverseSolidus: number = one('\\')

/** 0x5D */
export const rightSquareBracket: number = one(']')

/** 0x5E */
export const circumflexAccent: number = one('^')

/** 0x5F */
export const lowLine: number = one('_')

// 0x60..

/** 0x60 */
export const graveAccent: number = one('`')

/** 0x61..0x7A */
export const latinSmallLetterRange: Range = range('az')

/** 0x61 */
export const latinSmallLetterA: number = one('a')

/** 0x62 */
export const latinSmallLetterB: number = one('b')

/** 0x65 */
export const latinSmallLetterE: number = one('e')

/** 0x66 */
export const latinSmallLetterF: number = one('f')

/** 0x6E */
export const latinSmallLetterN: number = one('n')

/** 0x72 */
export const latinSmallLetterR: number = one('r')

/** 0x74 */
export const latinSmallLetterT: number = one('t')

/** 0x75 */
export const latinSmallLetterU: number = one('u')

/** 0x7A */
export const latinSmallLetterZ: number = one('z')

/** 0x7B */
export const leftCurlyBracket: number = one('{')

/** 0x7C */
export const verticalLine: number = one('|')

/** 0x7D */
export const rightCurlyBracket: number = one('}')

/** 0x7E */
export const tilde: number = one('~')
