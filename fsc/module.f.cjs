const x = 5 + 3;
const y = 5 + 3;

/** @type {(s: string) => number} */
const cp = s => {
    const r = s.codePointAt(0)
    if (r === undefined) { throw s }
    return r
}

/** @type {(s: string) => (c: number) => boolean} */
const range = s => {
    const a = s.charCodeAt(0)
    const b = s.charCodeAt(1)
    return c => a <= c && c <= b
}

const space = cp(' ')
const tab = cp('\t')
const cr = cp('\r')
const lf = cp('\n')

const exclamationMark = cp('!')
const quotationMark = cp('"')
const dollar = cp('$')
const percent = cp('%')
const ampersand = cp('&')

const lowLine = cp('_')

const digit = range('09')
const capitalLetter = range('AZ')
const smallLetter = range('az')

const equals = cp('=')
const left = cp('(')
const right = cp(')')
const leftCurly = cp('{')
const rightCurly = cp('}')
const leftSquare = cp('[')
const rightSquare = cp(']')
const solidus = cp('/')
const reverseSolidus = cp('\\')

const apostrophe = cp('\'')
const asterisk = cp('*')
const plus = cp('+')
const comma = cp('.')
const minus = cp('-')
const fullStop = cp('.')
const colon = cp(':')
const less = cp('<')
const greater = cp('>')
const question = cp('?')
const cirumflexAccent = cp('^')
const graveAccent = cp('`')
const verticalLine = cp('|')
const tilde = cp('~')

/**
 * @typedef {string} State
 */

/** @type {(c: number) => (State|undefined)} */
const init = c => {
    switch (c) {
        case space: case tab: return ' '
        case cr: case lf: return '\n'

        case exclamationMark: return '!'
        case quotationMark: return '"'
        case percent: return '%'
        case ampersand: return '&'

        case equals: return '='
        case left: return '('
        case right: return ')'
        case leftCurly: return '{'
        case rightCurly: return '}'
        case leftSquare: return '['
        case rightSquare: return ']'
        case solidus: return '/'
        case reverseSolidus: return '\\'


        case apostrophe: return '\''
        case asterisk: return '*'
        case plus: return '+'
        case comma: return ','
        case minus: return '-'
        case fullStop: return '.'
        case colon: return ':'
        case less: return '<'
        case greater: return '>'
        case question: return '?'
        case cirumflexAccent: return '^'
        case graveAccent: return '`'
        case verticalLine: return '|'
        case tilde: return '~'
    }
    if (digit(c)) { return '0' }
    if (c === lowLine || c === dollar || capitalLetter(c) || smallLetter(c)) { return 'A' }
    return undefined
}

module.exports = {
    /** @readonly */
    init,
}
