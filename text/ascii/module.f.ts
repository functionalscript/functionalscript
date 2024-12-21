import * as _range from '../../types/range/module.f.mjs'

const at
    : (s: string) => (i: number) => number
    = s => i => {
    const r = s.codePointAt(i)
    if (r === void 0) { throw s }
    return r
}

export const one
    : (s: string) => number
    = s => at(s)(0)

export const range
    : (s: string) => _range.Range
    = s => {
    const f = at(s)
    const f0 = f(0)
    if (s.length === 1) { return [f0, f0] }
    return [f0, f(1)]
}

export const ascii = {
    // 0x00..

    /** @readonly 0x08 */
    backspace: one('\b'),

    /** @readonly 0x09 */
    ht: one('\t'),

    /** @readonly 0x0A */
    lf: one('\n'),

    /** @readonly 0x0C */
    ff: one('\f'),
    /** @readonly 0x0D */
    cr: one('\r'),

    // 0x20..

    /** @readonly 0x20 */
    space: one(' '),

    /** @readonly 0x21 */
    exclamationMark: one('!'),

    /** @readonly 0x22 */
    quotationMark: one('"'),

    /** @readonly 0x23 */
    numberSign: one('#'),

    /** @readonly 0x24 */
    dollarSign: one('$'),

    /** @readonly 0x25 */
    percentSign: one('%'),

    /** @readonly 0x26 */
    ampersand: one('&'),

    /** @readonly 0x27 */
    apostrophe: one("'"),

    /** @readonly 0x28 */
    leftParenthesis: one('('),

    /** @readonly 0x29 */
    rightParenthesis: one(')'),

    /** @readonly 0x2A */
    asterisk: one('*'),

    /** @readonly 0x2B */
    plusSign: one('+'),

    /** @readonly 0x2C */
    comma: one(','),

    /** @readonly 0x2D */
    hyphenMinus: one('-'),

    /** @readonly 0x2E */
    fullStop: one('.'),

    /** @readonly 0x2F */
    solidus: one('/'),

    // 0x30..

    /** @readonly 0x30..0x39 */
    digitRange: range('09'),

    /** @readonly 0x30 */
    digit0: one('0'),

    /** @readonly 0x31 */
    digit1: one('1'),

    /** @readonly 0x32 */
    digit2: one('2'),

    /** @readonly 0x33 */
    digit3: one('3'),

    /** @readonly 0x34 */
    digit4: one('4'),

    /** @readonly 0x35 */
    digit5: one('5'),

    /** @readonly 0x36 */
    digit6: one('6'),

    /** @readonly 0x37 */
    digit7: one('7'),

    /** @readonly 0x38 */
    digit8: one('8'),

    /** @readonly 0x39 */
    digit9: one('9'),

    /** @readonly 0x3A */
    colon: one(':'),

    /** @readonly 0x3B */
    semicolon: one(';'),

    /** @readonly 0x3C */
    lessThanSign: one('<'),

    /** @readonly 0x3D */
    equalsSign: one('='),

    /** @readonly 0x3E */
    greaterThanSign: one('>'),

    /** @readonly 0x3F */
    questionMark: one('?'),

    // 0x40..

    /** @readonly 0x40 */
    commercialAt: one('@'),

    /** @readonly 0x41..0x5A */
    latinCapitalLetterRange: range('AZ'),

    /** @readonly 0x41 */
    latinCapitalLetterA: one('A'),

    /** @readonly 0x45 */
    latinCapitalLetterE: one('E'),

    /** @readonly 0x46 */
    latinCapitalLetterF: one('F'),

    /** @readonly 0x5B */
    leftSquareBracket: one('['),

    /** @readonly 0x5C */
    reverseSolidus: one('\\'),

    /** @readonly 0x5D */
    rightSquareBracket: one(']'),

    /** @readonly 0x5E */
    circumflexAccent: one('^'),

    /** @readonly 0x5F */
    lowLine: one('_'),

    // 0x60..

    /** @readonly 0x60 */
    graveAccent: one('`'),

    /** @readonly 0x61..0x7A */
    latinSmallLetterRange: range('az'),

    /** @readonly 0x61 */
    latinSmallLetterA: one('a'),

    /** @readonly 0x62 */
    latinSmallLetterB: one('b'),

    /** @readonly 0x65 */
    latinSmallLetterE: one('e'),

    /** @readonly 0x66 */
    latinSmallLetterF: one('f'),

    /** @readonly 0x6E */
    latinSmallLetterN: one('n'),

    /** @readonly 0x72 */
    latinSmallLetterR: one('r'),

    /** @readonly 0x74 */
    latinSmallLetterT: one('t'),

    /** @readonly 0x75 */
    latinSmallLetterU: one('u'),

    /** @readonly 0x7A */
    latinSmallLetterZ: one('z'),

    /** @readonly 0x7B */
    leftCurlyBracket: one('{'),

    /** @readonly 0x7C */
    verticalLine: one('|'),

    /** @readonly 0x7D */
    rightCurlyBracket: one('}'),

    /** @readonly 0x7E */
    tilde: one('~'),
}
