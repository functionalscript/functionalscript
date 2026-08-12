/**
 * JavaScript tokenizer built as a range-map state machine over code points,
 * producing tokens for keywords, identifiers, punctuators, comments, strings,
 * and numeric literals (including `BigFloat`).
 *
 * @module
 */

/** @import { Scan, StateScan } from '../../types/function/operator/types.ts' */
import { strictEqual } from '../../types/function/operator/module.f.mjs'
/** @import { RangeMapArray, RangeMerge } from '../../types/range_map/types.ts' */
import { merge, fromRange, get } from '../../types/range_map/module.f.mjs'
/** @import { List } from '../../types/list/types.ts' */
import { empty, stateScan, flat, toArray, reduce as listReduce, scan, map as listMap } from '../../types/list/module.f.mjs'
import { at, fromEntries } from '../../types/ordered_map/module.f.mjs'
/** @import { Entry } from '../../types/ordered_map/types.ts' */
/** @import { Range as NumberRange } from '../../types/range/types.ts' */
import { one } from '../../types/range/module.f.mjs'
import {
    range,
    //
    backspace,
    ht,
    lf,
    ff,
    cr,
    //
    exclamationMark,
    percentSign,
    ampersand,
    asterisk,
    lessThanSign,
    equalsSign,
    greaterThanSign,
    questionMark,
    circumflexAccent,
    verticalLine,
    tilde,
    //
    space,
    quotationMark,
    leftParenthesis,
    rightParenthesis,
    plusSign,
    comma,
    hyphenMinus,
    fullStop,
    solidus,
    //
    digitRange,
    digit0,
    colon,
    //
    latinCapitalLetterRange,
    latinCapitalLetterA,
    latinCapitalLetterE,
    //
    leftSquareBracket,
    reverseSolidus,
    rightSquareBracket,
    lowLine,
    //
    latinSmallLetterRange,
    latinSmallLetterA,
    latinSmallLetterB,
    latinSmallLetterE,
    latinSmallLetterF,
    latinSmallLetterN,
    latinSmallLetterR,
    latinSmallLetterT,
    latinSmallLetterU,
    //
    leftCurlyBracket,
    rightCurlyBracket,
    dollarSign
}  from '../../text/ascii/module.f.mjs'
import { todo, assertEq } from '../../asserts/module.f.mjs'
/** @import {
    StringToken,
    NumberToken,
    BigIntToken,
    ErrorToken,
    WhitespaceToken,
    NewLineToken,
    IdToken,
    CommentToken,
    EofToken,
    JsToken,
    TokenMetadata,
    JsTokenWithMetadata,
    _TokenizerStateWithMetadata,
    _TokenizerState,
    _ErrorMessage,
    _InitialState,
    _ParseIdState,
    _ParseWhitespaceState,
    _ParseNewLineState,
    _ParseStringState,
    _ParseEscapeCharState,
    _ParseOperatorState,
    _ParseCommentState,
    _ParseUnicodeCharState,
    _ParseNumberState,
    _ParseNumberBuffer,
    _InvalidNumberState,
    _EofState,
    _CharCodeOrEof,
    _ToToken,
    _CreateToToken,
    _RangeFunc,
    _RangeMapToToken,
} from './types.ts' */

const { fromCharCode } = String

const rangeOneNine = range('19')

const rangeSetNewLine = [
    one(lf),
    one(cr)
]

const rangeSetWhiteSpace = [
    one(ht),
    one(space)
]

const rangeSetTerminalForNumber = [
    ...rangeSetWhiteSpace,
    ...rangeSetNewLine,
    one(exclamationMark),
    one(percentSign),
    one(ampersand),
    one(leftParenthesis),
    one(rightParenthesis),
    one(asterisk),
    one(comma),
    one(solidus),
    one(colon),
    one(lessThanSign),
    one(equalsSign),
    one(greaterThanSign),
    one(questionMark),
    one(circumflexAccent),
    one(leftSquareBracket),
    one(rightSquareBracket),
    one(leftCurlyBracket),
    one(verticalLine),
    one(rightCurlyBracket),
    one(tilde),
]

const rangeSmallAF = range('af')
const rangeCapitalAF = range('AF')

const rangeIdStart = [
    latinSmallLetterRange,
    latinCapitalLetterRange,
    one(lowLine),
    one(dollarSign)
]

const rangeOpStart = [
    one(exclamationMark),
    one(percentSign),
    one(ampersand),
    one(leftParenthesis),
    one(rightParenthesis),
    one(asterisk),
    one(plusSign),
    one(comma),
    one(hyphenMinus),
    one(fullStop),
    one(solidus),
    one(colon),
    one(lessThanSign),
    one(equalsSign),
    one(greaterThanSign),
    one(questionMark),
    one(circumflexAccent),
    one(leftSquareBracket),
    one(rightSquareBracket),
    one(leftCurlyBracket),
    one(verticalLine),
    one(rightCurlyBracket),
    one(tilde)
]

const rangeId = [digitRange, ...rangeIdStart]

/** @type {(old: string) => (input: number) => string} */
const appendChar = old => input => `${old}${fromCharCode(input)}`

/**
 * @template T
 * @param {_CreateToToken<T>} def
 * @returns {(a: _CreateToToken<T>) => (b: _CreateToToken<T>) => _CreateToToken<T>}
 */
const union = def => a => b => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}

/**
 * @template T
 * @param {_CreateToToken<T>} def
 * @returns {RangeMerge<_CreateToToken<T>>}
 */
const rangeMapMerge = def => merge({
    union: union(def),
    equal: strictEqual,
    def,
})

/**
 * @template T
 * @param {NumberRange} r
 * @returns {(f: _CreateToToken<T>) => _RangeFunc<T>}
 */
const rangeFunc = r => f => def => fromRange(def)(f)(r)

/**
 * @template T
 * @param {_CreateToToken<T>} def
 * @returns {Scan<_RangeFunc<T>, _RangeMapToToken<T>>}
 */
const scanRangeOp = def => f => [f(def), scanRangeOp(def)]

/**
 * @template T
 * @param {_CreateToToken<T>} def
 * @returns {(a: List<_RangeFunc<T>>) => _RangeMapToToken<T>}
 */
const reduceRangeMap = def => a => {
    const rm = scan(scanRangeOp(def))(a)
    return toArray(listReduce(rangeMapMerge(def))(empty)(rm))
}

/**
 * @template T
 * @param {_CreateToToken<T>} def
 * @returns {(f: _CreateToToken<T>) => Scan<NumberRange, _RangeMapToToken<T>>}
 */
const scanRangeSetOp = def => f => r => [fromRange(def)(f)(r), scanRangeSetOp(def)(f)]

/**
 * @template T
 * @param {List<NumberRange>} rs
 * @returns {(f: _CreateToToken<T>) => _RangeFunc<T>}
 */
const rangeSetFunc = rs => f => def => {
    const rm = scan(scanRangeSetOp(def)(f))(rs)
    return toArray(listReduce(rangeMapMerge(def))(empty)(rm))
}

/**
 * @template T
 * @param {_CreateToToken<T>} def
 * @returns {(a: List<_RangeFunc<T>>) => _CreateToToken<T>}
 */
const create = def => a => {
    const x = get(def)(reduceRangeMap(def)(a))
    return v => c => x(c)(v)(c)
}

/** @type {(digit: number) => bigint} */
const digitToBigInt = d => BigInt(d - digit0)

/** @type {(digit: number) => _ParseNumberBuffer} */
const startNumber = digit => ({ s: 1n, m: digitToBigInt(digit), f: 0, es: 1, e: 0 })

/** @type {(digit: number) => (b: _ParseNumberBuffer) => _ParseNumberBuffer} */
const addIntDigit = digit => b => ({ ...b, m: b.m * 10n + digitToBigInt(digit) })

/** @type {(digit: number) => (b: _ParseNumberBuffer) => _ParseNumberBuffer} */
const addFracDigit = digit => b => ({ ...b, m: b.m * 10n + digitToBigInt(digit), f: b.f - 1 })

/** @type {(digit: number) => (b: _ParseNumberBuffer) => _ParseNumberBuffer} */
const addExpDigit = digit => b => ({ ...b, e: b.e * 10 + digit - digit0 })

/** @type {(s: _ParseNumberState) => JsToken} */
const bufferToNumberToken = ({ numberKind, value, b }) => {
    if (numberKind === 'bigint')
        return { kind: 'bigint', value: b.s * b.m }
    return { kind: 'number', value: value, bf: [b.s * b.m, b.f + b.es * b.e] }
}

/**
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#keywords
 */
/** @type {List<Entry<JsToken>>} */
const keywordEntries = [
    ['arguments', { kind: 'arguments' }],
    ['await', { kind: 'await' }],
    ['break', { kind: 'break' }],
    ['case', { kind: 'case' }],
    ['catch', { kind: 'catch' }],
    ['class', { kind: 'class' }],
    ['const', { kind: 'const' }],
    ['continue', { kind: 'continue' }],
    ['debugger', { kind: 'debugger' }],
    ['default', { kind: 'default' }],
    ['delete', { kind: 'delete' }],
    ['do', { kind: 'do' }],
    ['else', { kind: 'else' }],
    ['enum', { kind: 'enum' }],
    ['eval', { kind: 'eval' }],
    ['export', { kind: 'export' }],
    ['extends', { kind: 'extends' }],
    ['false', { kind: 'false' }],
    ['finally', { kind: 'finally' }],
    ['for', { kind: 'for' }],
    ['function', { kind: 'function' }],
    ['if', { kind: 'if' }],
    ['implements', { kind: 'implements' }],
    ['import', { kind: 'import' }],
    ['in', { kind: 'in' }],
    ['instanceof', { kind: 'instanceof' }],
    ['interface', { kind: 'interface' }],
    ['let', { kind: 'let' }],
    ['new', { kind: 'new' }],
    ['null', { kind: 'null' }],
    ['package', { kind: 'package' }],
    ['private', { kind: 'private' }],
    ['protected', { kind: 'protected' }],
    ['public', { kind: 'public' }],
    ['return', { kind: 'return' }],
    ['static', { kind: 'static' }],
    ['super', { kind: 'super' }],
    ['switch', { kind: 'switch' }],
    ['this', { kind: 'this' }],
    ['throw', { kind: 'throw' }],
    ['true', { kind: 'true' }],
    ['try', { kind: 'try' }],
    ['typeof', { kind: 'typeof' }],
    ['undefined', { kind: 'undefined' }],
    ['var', { kind: 'var' }],
    ['void', { kind: 'void' }],
    ['while', { kind: 'while' }],
    ['with', { kind: 'with' }],
    ['yield', { kind: 'yield' }],
]

const keywordMap = fromEntries(keywordEntries)

/** @type {(token: JsToken) => boolean} */
export const isKeywordToken = token => at(token.kind)(keywordMap) !== null

/**
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators
 */
/** @type {List<Entry<JsToken>>} */
const operatorEntries = [
    ['!', { kind: '!' }],
    ['!=', { kind: '!=' }],
    ['!==', { kind: '!==' }],
    ['%', { kind: '%' }],
    ['%=', { kind: '%=' }],
    ['&', { kind: '&' }],
    ['&&', { kind: '&&' }],
    ['&&=', { kind: '&&=' }],
    ['&=', { kind: '&=' }],
    ['(', { kind: '(' }],
    [')', { kind: ')' }],
    ['*', { kind: '*' }],
    ['**', { kind: '**' }],
    ['**=', { kind: '**=' }],
    ['*=', { kind: '*=' }],
    ['+', { kind: '+' }],
    ['++', { kind: '++' }],
    ['+=', { kind: '+=' }],
    [',', { kind: ',' }],
    ['-', { kind: '-' }],
    ['--', { kind: '--' }],
    ['-=', { kind: '-=' }],
    ['.', { kind: '.' }],
    ['/', { kind: '/' }],
    ['/=', { kind: '/=' }],
    [':', { kind: ':' }],
    ['<', { kind: '<' }],
    ['<<', { kind: '<<' }],
    ['<<=', { kind: '<<=' }],
    ['<=', { kind: '<=' }],
    ['=', { kind: '=' }],
    ['==', { kind: '==' }],
    ['===', { kind: '===' }],
    ['=>', { kind: '=>' }],
    ['>', { kind: '>' }],
    ['>=', { kind: '>=' }],
    ['>>', { kind: '>>' }],
    ['>>=', { kind: '>>=' }],
    ['>>>', { kind: '>>>' }],
    ['>>>=', { kind: '>>>=' }],
    ['?', { kind: '?' }],
    ['?.', { kind: '?.' }],
    ['??', { kind: '??' }],
    ['??=', { kind: '??=' }],
    ['^', { kind: '^' }],
    ['^=', { kind: '^=' }],
    ['[', { kind: '[' }],
    [']', { kind: ']' }],
    ['{', { kind: '{' }],
    ['|', { kind: '|' }],
    ['|=', { kind: '|=' }],
    ['||', { kind: '||' }],
    ['||=', { kind: '||=' }],
    ['}', { kind: '}' }],
    ['~', { kind: '~' }]
]

const operatorMap = fromEntries(operatorEntries)

/** @type {(op: string) => JsToken} */
const getOperatorToken = op => at(op)(operatorMap) ?? { kind: 'error', message: 'invalid token' }

/** @type {(op: string) => boolean} */
const hasOperatorToken = op => at(op)(operatorMap) !== null

/** @type {(state: _InitialState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const initialStateOp = create(
    /** @type {_CreateToToken<_TokenizerState>} */ (state => () => [[{ kind: 'error', message: 'unexpected character' }], state])
)([
    rangeFunc(rangeOneNine)(/** @type {_CreateToToken<_TokenizerState>} */ (() => input => [empty, { kind: 'number', value: fromCharCode(input), b: startNumber(input), numberKind: 'int' }])),
    rangeSetFunc(rangeIdStart)(/** @type {_CreateToToken<_TokenizerState>} */ (() => input => [empty, { kind: 'id', value: fromCharCode(input) }])),
    rangeSetFunc(rangeSetWhiteSpace)(/** @type {_CreateToToken<_TokenizerState>} */ (() => () => [empty, { kind: 'ws' }])),
    rangeSetFunc(rangeSetNewLine)(/** @type {_CreateToToken<_TokenizerState>} */ (() => () => [empty, { kind: 'nl' }])),
    rangeFunc(one(quotationMark))(/** @type {_CreateToToken<_TokenizerState>} */ (() => () => [empty, { kind: 'string', value: '' }])),
    rangeFunc(one(digit0))(/** @type {_CreateToToken<_TokenizerState>} */ (() => input => [empty, { kind: 'number', value: fromCharCode(input), b: startNumber(input), numberKind: '0' }])),
    rangeSetFunc(rangeOpStart)(/** @type {_CreateToToken<_TokenizerState>} */ (() => input => [empty, { kind: 'op', value: fromCharCode(input) }]))
])

/** @type {_CreateToToken<_ParseNumberState>} */
const invalidNumberToToken = () => input => {
    const next = tokenizeOp(input, { kind: 'initial' })
    return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
}

/** @type {_CreateToToken<_ParseNumberState>} */
const fullStopToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: '.' }]
        default: return tokenizeOp(input, { kind: 'invalidNumber' })
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const digit0ToToken = state => input => {
    switch (state.numberKind) {
        case '0': return tokenizeOp(input, { kind: 'invalidNumber' })
        case '.':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addFracDigit(input)(state.b), numberKind: 'fractional' }]
        case 'e':
        case 'e+':
        case 'e-':
        case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addExpDigit(input)(state.b), numberKind: 'expDigits' }]
        default: return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addIntDigit(input)(state.b), numberKind: state.numberKind }]
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const digit19ToToken = state => input => {
    switch (state.numberKind) {
        case '0': return tokenizeOp(input, { kind: 'invalidNumber' })
        case '.':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addFracDigit(input)(state.b), numberKind: 'fractional' }]
        case 'e':
        case 'e+':
        case 'e-':
        case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addExpDigit(input)(state.b), numberKind: 'expDigits' }]
        default: return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addIntDigit(input)(state.b), numberKind: 'int' }]
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const expToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: 'e' }]
        default: return tokenizeOp(input, { kind: 'invalidNumber' })
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const hyphenMinusToToken = state => input => {
    switch (state.numberKind) {
        case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: { ...state.b, es: -1 }, numberKind: 'e-' }]
        default: return terminalToToken(state)(input)
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const plusSignToToken = state => input => {
    switch (state.numberKind) {
        case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: 'e+' }]
        default: return tokenizeOp(input, { kind: 'invalidNumber' })
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const terminalToToken = state => input => {
    switch (state.numberKind) {
        case '.':
        case 'e':
        case 'e+':
        case 'e-':
            {
                const next = tokenizeOp(input, { kind: 'initial' })
                return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
            }
        default:
            {
                const next = tokenizeOp(input, { kind: 'initial' })
                return [{ first: bufferToNumberToken(state), tail: next[0] }, next[1]]
            }
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const bigintToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int':
            {
                return [empty, { kind: 'number', value: state.value, b: state.b, numberKind: 'bigint' }]
            }
        default:
            {
                const next = tokenizeOp(input, { kind: 'initial' })
                return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
            }
    }
}

/** @type {(state: _ParseNumberState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseNumberStateOp = create(invalidNumberToToken)([
    rangeFunc(one(fullStop))(fullStopToToken),
    rangeFunc(one(digit0))(digit0ToToken),
    rangeFunc(rangeOneNine)(digit19ToToken),
    rangeSetFunc([one(latinSmallLetterE), one(latinCapitalLetterE)])(expToToken),
    rangeFunc(one(hyphenMinus))(hyphenMinusToToken),
    rangeFunc(one(plusSign))(plusSignToToken),
    rangeSetFunc(rangeSetTerminalForNumber)(terminalToToken),
    rangeFunc(one(latinSmallLetterN))(bigintToToken),
])

/** @type {(state: _InvalidNumberState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const invalidNumberStateOp = create(
    /** @type {_CreateToToken<_InvalidNumberState>} */ (() => () => [empty, { kind: 'invalidNumber' }])
)([
    rangeSetFunc(rangeSetTerminalForNumber)(/** @type {_CreateToToken<_InvalidNumberState>} */ (() => input => {
        const next = tokenizeOp(input, { kind: 'initial' })
        return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
    }))
])

/** @type {readonly NumberRange[]} */
const rangeSetStringControl = [
    [0x00, 0x09],
    [0x0b, 0x0c],
    [0x0e, 0x1f],
]

/** @type {(state: _ParseStringState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseStringStateOp = create(
    /** @type {_CreateToToken<_ParseStringState>} */ (state => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }])
)([
    rangeFunc(one(quotationMark))(/** @type {_CreateToToken<_ParseStringState>} */ (state => () => [[{ kind: 'string', value: state.value }], { kind: 'initial' }])),
    rangeFunc(one(reverseSolidus))(/** @type {_CreateToToken<_ParseStringState>} */ (state => () => [empty, { kind: 'escapeChar', value: state.value }])),
    rangeSetFunc(rangeSetNewLine)(/** @type {_CreateToToken<_ParseStringState>} */ (() => () => [[{ kind: 'error', message: 'unterminated string literal' }], { kind: 'nl' }])),
    rangeSetFunc(rangeSetStringControl)(/** @type {_CreateToToken<_ParseStringState>} */ (state => () => [[{ kind: 'error', message: 'unescaped control character in string' }], { kind: 'string', value: state.value }]))
])

/** @type {_CreateToToken<_ParseEscapeCharState>} */
const parseEscapeDefault = state => input => {
    const next = tokenizeOp(input, { kind: 'string', value: state.value })
    return [{ first: { kind: 'error', message: 'unescaped character' }, tail: next[0] }, next[1]]
}

/** @type {(state: _ParseEscapeCharState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseEscapeCharStateOp = create(parseEscapeDefault)([
    rangeSetFunc([one(quotationMark), one(reverseSolidus), one(solidus)])(/** @type {_CreateToToken<_ParseEscapeCharState>} */ (state => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }])),
    rangeFunc(one(latinSmallLetterB))(/** @type {_CreateToToken<_ParseEscapeCharState>} */ (state => () => [empty, { kind: 'string', value: appendChar(state.value)(backspace) }])),
    rangeFunc(one(latinSmallLetterF))(/** @type {_CreateToToken<_ParseEscapeCharState>} */ (state => () => [empty, { kind: 'string', value: appendChar(state.value)(ff) }])),
    rangeFunc(one(latinSmallLetterN))(/** @type {_CreateToToken<_ParseEscapeCharState>} */ (state => () => [empty, { kind: 'string', value: appendChar(state.value)(lf) }])),
    rangeFunc(one(latinSmallLetterR))(/** @type {_CreateToToken<_ParseEscapeCharState>} */ (state => () => [empty, { kind: 'string', value: appendChar(state.value)(cr) }])),
    rangeFunc(one(latinSmallLetterT))(/** @type {_CreateToToken<_ParseEscapeCharState>} */ (state => () => [empty, { kind: 'string', value: appendChar(state.value)(ht) }])),
    rangeFunc(one(latinSmallLetterU))(/** @type {_CreateToToken<_ParseEscapeCharState>} */ (state => () => [empty, { kind: 'unicodeChar', value: state.value, unicode: 0, hexIndex: 0 }])),
])

/** @type {_CreateToToken<_ParseUnicodeCharState>} */
const parseUnicodeCharDefault = state => input => {
    const next = tokenizeOp(input, { kind: 'string', value: state.value })
    return [{ first: { kind: 'error', message: 'invalid hex value' }, tail: next[0] }, next[1]]
}

/** @type {(offset: number) => _CreateToToken<_ParseUnicodeCharState>} */
const parseUnicodeCharHex = offset => state => input => {
    const hexValue = input - offset
    const newUnicode = state.unicode | (hexValue << (3 - state.hexIndex) * 4)
    return [empty, state.hexIndex === 3 ?
        { kind: 'string', value: appendChar(state.value)(newUnicode) } :
        { kind: 'unicodeChar', value: state.value, unicode: newUnicode, hexIndex: state.hexIndex + 1 }]
}

/** @type {(state: _ParseUnicodeCharState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseUnicodeCharStateOp = create(parseUnicodeCharDefault)([
    rangeFunc(digitRange)(parseUnicodeCharHex(digit0)),
    rangeFunc(rangeSmallAF)(parseUnicodeCharHex(latinSmallLetterA - 10)),
    rangeFunc(rangeCapitalAF)(parseUnicodeCharHex(latinCapitalLetterA - 10))
])

/** @type {(s: string) => JsToken} */
const idToToken = s => at(s)(keywordMap) ?? { kind: 'id', value: s }

/** @type {_CreateToToken<_ParseIdState>} */
const parseIdDefault = state => input => {
    const keyWordToken = idToToken(state.value)
    const next = tokenizeOp(input, { kind: 'initial' })
    return [{ first: keyWordToken, tail: next[0] }, next[1]]
}

/** @type {(state: _ParseIdState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseIdStateOp = create(parseIdDefault)([
    rangeSetFunc(rangeId)(/** @type {_CreateToToken<_ParseIdState>} */ (state => input => [empty, { kind: 'id', value: appendChar(state.value)(input) }]))
])

/** @type {(state: _ParseOperatorState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseOperatorStateOp = state => input => {
    const nextStateValue = appendChar(state.value)(input)
    switch (nextStateValue) {
        case '//': return [empty, { kind: '//', value: '', newLine: false }]
        case '/*': return [empty, { kind: '/*', value: '', newLine: false }]
        default: {
            if (hasOperatorToken(nextStateValue))
                return [empty, { kind: 'op', value: nextStateValue }]
            const next = tokenizeOp(input, { kind: 'initial' })
            return [{ first: getOperatorToken(state.value), tail: next[0] }, next[1]]
        }
    }
}

/** @type {(state: _ParseCommentState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseSinglelineCommentStateOp = create(
    /** @type {_CreateToToken<_ParseCommentState>} */ (state => input => [empty, { ...state, value: appendChar(state.value)(input) }])
)([
    rangeSetFunc(rangeSetNewLine)(/** @type {_CreateToToken<_ParseCommentState>} */ (state => () => [[{ kind: '//', value: state.value }], { kind: 'nl' }]))
])

/** @type {(state: _ParseCommentState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseMultilineCommentStateOp = create(
    /** @type {_CreateToToken<_ParseCommentState>} */ (state => input => [empty, { ...state, value: appendChar(state.value)(input) }])
)([
    rangeFunc(one(asterisk))(/** @type {_CreateToToken<_ParseCommentState>} */ (state => () => [empty, { ...state, kind: '/**' }])),
    rangeSetFunc(rangeSetNewLine)(/** @type {_CreateToToken<_ParseCommentState>} */ (state => input => [empty, { ...state, value: appendChar(state.value)(input), newLine: true }])),
])

/** @type {(state: _ParseCommentState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseMultilineCommentAsteriskStateOp = create(
    /** @type {_CreateToToken<_ParseCommentState>} */ (state => input => [empty, { ...state, kind: '/*', value: appendChar(appendChar(state.value)(asterisk))(input) }])
)([
    rangeFunc(one(asterisk))(/** @type {_CreateToToken<_ParseCommentState>} */ (state => () => [empty, { ...state, value: appendChar(state.value)(asterisk) }])),
    rangeSetFunc(rangeSetNewLine)(/** @type {_CreateToToken<_ParseCommentState>} */ (state => input => [empty, { kind: '/*', value: appendChar(appendChar(state.value)(asterisk))(input), newLine: true }])),
    rangeFunc(one(solidus))(/** @type {_CreateToToken<_ParseCommentState>} */ (state => () => {
        /** @type {List<JsToken>} */
        const tokens = state.newLine ? [{ kind: '/*', value: state.value }, { kind: 'nl' }] : [{ kind: '/*', value: state.value }]
        return [tokens, { kind: 'initial' }]
    }))
])

/** @type {_CreateToToken<_ParseWhitespaceState>} */
const parseWhitespaceDefault = () => input => {
    const next = tokenizeOp(input, { kind: 'initial' })
    return [{ first: { kind: 'ws' }, tail: next[0] }, next[1]]
}

/** @type {(state: _ParseWhitespaceState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseWhitespaceStateOp = create(parseWhitespaceDefault)([
    rangeSetFunc(rangeSetWhiteSpace)(/** @type {_CreateToToken<_ParseWhitespaceState>} */ (state => () => [empty, state])),
    rangeSetFunc(rangeSetNewLine)(/** @type {_CreateToToken<_ParseWhitespaceState>} */ (() => () => [empty, { kind: 'nl' }]))
])

/** @type {_CreateToToken<_ParseNewLineState>} */
const parseNewLineDefault = () => input => {
    const next = tokenizeOp(input, { kind: 'initial' })
    return [{ first: { kind: 'nl' }, tail: next[0] }, next[1]]
}

/** @type {(state: _ParseNewLineState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseNewLineStateOp = create(parseNewLineDefault)([
    rangeSetFunc(rangeSetWhiteSpace)(/** @type {_CreateToToken<_ParseNewLineState>} */ (state => () => [empty, state])),
    rangeSetFunc(rangeSetNewLine)(/** @type {_CreateToToken<_ParseNewLineState>} */ (state => () => [empty, state]))
])

/** @type {(state: _EofState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const eofStateOp = create(
    /** @type {_CreateToToken<_EofState>} */ (state => () => [[{ kind: 'error', message: 'eof' }], state])
)([])

/** @type {StateScan<number, _TokenizerState, List<JsToken>>} */
const tokenizeCharCodeOp = (input, state) => {
    switch (state.kind) {
        case 'initial': return initialStateOp(state)(input)
        case 'id': return parseIdStateOp(state)(input)
        case 'string': return parseStringStateOp(state)(input)
        case 'escapeChar': return parseEscapeCharStateOp(state)(input)
        case 'unicodeChar': return parseUnicodeCharStateOp(state)(input)
        case 'invalidNumber': return invalidNumberStateOp(state)(input)
        case 'number': return parseNumberStateOp(state)(input)
        case 'op': return parseOperatorStateOp(state)(input)
        case '//': return parseSinglelineCommentStateOp(state)(input)
        case '/*': return parseMultilineCommentStateOp(state)(input)
        case '/**': return parseMultilineCommentAsteriskStateOp(state)(input)
        case 'ws': return parseWhitespaceStateOp(state)(input)
        case 'nl': return parseNewLineStateOp(state)(input)
        case 'eof': return eofStateOp(state)(input)
    }
}

/** @type {(state: _TokenizerState) => readonly [List<JsToken>, _TokenizerState]} */
const tokenizeEofOp = state => {
    switch (state.kind) {
        case 'initial': return [[{ kind: 'eof' }], { kind: 'eof' }]
        case 'id': return [[idToToken(state.value), { kind: 'eof' }], { kind: 'eof' }]
        case 'string':
        case 'escapeChar':
        case 'unicodeChar': return [[{ kind: 'error', message: '" are missing' }, { kind: 'eof' }], { kind: 'eof' }]
        case 'invalidNumber': return [[{ kind: 'error', message: 'invalid number' }, { kind: 'eof' }], { kind: 'eof' }]
        case 'number':
            switch (state.numberKind) {
                case '.':
                case 'e':
                case 'e+':
                case 'e-': return [[{ kind: 'error', message: 'invalid number' }, { kind: 'eof' }], { kind: 'eof', }]
            }
            return [[bufferToNumberToken(state), { kind: 'eof' }], { kind: 'eof' }]
        case 'op': return [[getOperatorToken(state.value), { kind: 'eof' }], { kind: 'eof' }]
        case '//': return [[{ kind: '//', value: state.value }, { kind: 'eof' }], { kind: 'eof' }]
        case '/*':
        case '/**': return [[{ kind: 'error', message: '*/ expected' }, { kind: 'eof' }], { kind: 'eof', }]
        case 'ws': return [[{ kind: 'ws' }, { kind: 'eof' }], { kind: 'eof' }]
        case 'nl': return [[{ kind: 'nl' }, { kind: 'eof' }], { kind: 'eof' }]
        case 'eof': return [[{ kind: 'error', message: 'eof' }, { kind: 'eof' }], state]
    }
}

/** @type {StateScan<_CharCodeOrEof, _TokenizerState, List<JsToken>>} */
const tokenizeOp = (input, state) => input === null ? tokenizeEofOp(state) : tokenizeCharCodeOp(input, state)

/** @type {(metadata: TokenMetadata) => (token: JsToken) => JsTokenWithMetadata} */
const mapTokenWithMetadata = metadata => token => { return { token, metadata } }

/** @type {StateScan<_CharCodeOrEof, _TokenizerStateWithMetadata, List<JsTokenWithMetadata>>} */
const tokenizeWithPositionOp = (input, { state, metadata }) => {
    if (input == null) {
        const newState = tokenizeEofOp(state)
        return [listMap(mapTokenWithMetadata(metadata))(newState[0]), { state: newState[1], metadata }]
    }

    const newState = tokenizeCharCodeOp(input, state)
    const isNewLine = input == lf
    const newMetadata = { path: metadata.path, line: isNewLine ? metadata.line + 1 : metadata.line, column: isNewLine ? 1 : metadata.column + 1 }
    return [listMap(mapTokenWithMetadata(metadata))(newState[0]), { state: newState[1], metadata: newMetadata }]
}

const scanTokenize = stateScan(tokenizeWithPositionOp)

/** @type {(input: List<number>) => (path: string) => List<JsTokenWithMetadata>} */
export const tokenize = input => path => {
    const scan = scanTokenize({ state: { kind: 'initial' }, metadata: { path, line: 1, column: 1 } })
    return flat(scan(flat(/** @type {List<List<number | null>>} */ ([input, [null]]))))
}

export const proof = {
    // `getOperatorToken` is only ever called with a value already confirmed to be
    // a known operator (`hasOperatorToken`, or a single char from `rangeOpStart`),
    // so its `??` fallback is unreachable through `tokenize`. Call it directly
    // with a non-operator string to cover that branch.
    getOperatorTokenInvalid: () => {
        const result = getOperatorToken('@')
        assertEq(result.kind, 'error')
    },
    throw: {
        // union throws when two distinct non-default handlers are merged for the same range;
        // this path is unreachable through the public API (no overlapping ranges in practice).
        unionConflict: () => {
            const def = (/** @type {undefined} */ _) => todo
            const a = (/** @type {undefined} */ _) => todo
            const b = (/** @type {undefined} */ _) => todo
            union(def)(a)(b)
        }
    }
}
