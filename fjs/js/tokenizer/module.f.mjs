/**
 * JavaScript tokenizer built as a range-map state machine over code points,
 * producing tokens for keywords, identifiers, punctuators, comments, strings,
 * and numeric literals.
 *
 * Numeric scanning is lexeme-first: a `number` token carries the exact source
 * text and no derived numeric value, so tokenization stays bounded by the
 * input and never fails because a coefficient or exponent is too large for a
 * runtime numeric type.
 *
 * @module
 *
 * @import { Reduce, Scan, StateScan } from '../../types/function/operator/types.ts'
 * @import { RangeMerge } from '../../types/range_map/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Entry } from '../../types/ordered_map/types.ts'
 * @import { Range as NumberRange } from '../../types/range/types.ts'
 * @import { JsToken, TokenMetadata, JsTokenWithMetadata, _TokenizerStateWithMetadata, _TokenizerState, _ErrorMessage, _InitialState, _ParseIdState, _ParseWhitespaceState, _ParseNewLineState, _ParseStringState, _ParseEscapeCharState, _ParseOperatorState, _ParseCommentState, _ParseUnicodeCharState, _ParseNumberState, _InvalidNumberState, _EofState, _CharCodeOrEof, _ToToken, _CreateToToken, _RangeFunc, _RangeMapToToken, TriviaKind, } from './types.ts'
 */

import { strictEqual } from '../../types/function/operator/module.f.mjs'
import { merge, fromRange, get } from '../../types/range_map/module.f.mjs'
import { empty, stateScan, flat, toArray, reduce as listReduce, scan, map as listMap } from '../../types/list/module.f.mjs'
import { keywords } from '../keywords/module.f.mjs'
import { simpleEscapes } from '../string_escape/module.f.mjs'
import { at, fromEntries } from '../../types/ordered_map/module.f.mjs'
import { one } from '../../types/range/module.f.mjs'
import {
    range,
    //
    ht,
    lf,
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
    hexDigitValue,
    //
    latinCapitalLetterRange,
    latinCapitalLetterE,
    //
    leftSquareBracket,
    reverseSolidus,
    rightSquareBracket,
    lowLine,
    //
    latinSmallLetterRange,
    latinSmallLetterE,
    latinSmallLetterN,
    latinSmallLetterU,
    //
    leftCurlyBracket,
    rightCurlyBracket,
    dollarSign
}  from '../../text/ascii/module.f.mjs'
import { todo, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

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
 * @type {<T>(a: T) => Reduce<T>}
 */
const unionX = def => a => b => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}

/**
 * @type {<T>(a: _CreateToToken<T>) => Reduce<_CreateToToken<T>>}
 */
const union = unionX

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

/**
 * Turns a completed numeric scanning state into its token.
 *
 * A `number` token carries the lexeme and nothing else — deriving a numeric
 * value is each consumer's own policy, so no valid literal can fail to
 * tokenize because its coefficient or exponent exceeds a runtime numeric
 * limit. A `bigint` literal is the one case where the value *is* the token:
 * `123n` means that bigint, so it is constructed here from the same lexeme.
 *
 * @type {(s: _ParseNumberState) => JsToken}
 */
const stateToNumberToken = ({ numberKind, value }) =>
    numberKind === 'bigint'
        ? { kind: 'bigint', value: BigInt(value) }
        : { kind: 'number', value }

/**
 * Derived from the one source of truth for JavaScript keywords,
 * `fjs/js/keywords` — FunctionalScript is a strict subset of JavaScript, so
 * the tokenizer recognizes exactly that module's `keywords`.
 */
/** @type {List<Entry<JsToken>>} */
const keywordEntries = keywords.map(kind =>
    // every keyword kind is a `JsToken` kind by construction: `_KeywordToken`
    // derives its kinds from this same `keywords` list
    [kind, /** @type {JsToken} */ ({ kind })])

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
    state => () => [[{ kind: 'error', message: 'unexpected character' }], state]
)([
    rangeFunc(rangeOneNine)(() => input => [empty, { kind: 'number', value: fromCharCode(input), numberKind: 'int' }]),
    rangeSetFunc(rangeIdStart)(() => input => [empty, { kind: 'id', value: fromCharCode(input) }]),
    rangeSetFunc(rangeSetWhiteSpace)(() => () => [empty, { kind: 'ws' }]),
    rangeSetFunc(rangeSetNewLine)(() => () => [empty, { kind: 'nl' }]),
    rangeFunc(one(quotationMark))(() => () => [empty, { kind: 'string', value: '' }]),
    rangeFunc(one(digit0))(() => input => [empty, { kind: 'number', value: fromCharCode(input), numberKind: '0' }]),
    rangeSetFunc(rangeOpStart)(() => input => [empty, { kind: 'op', value: fromCharCode(input) }])
])

/** @type {_CreateToToken<_ParseNumberState>} */
const invalidNumberToToken = () => input => {
    const next = tokenizeCharCodeOp(input, { kind: 'initial' })
    return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
}

/** @type {_CreateToToken<_ParseNumberState>} */
const fullStopToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: '.' }]
        default: return tokenizeCharCodeOp(input, { kind: 'invalidNumber' })
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const digit0ToToken = state => input => {
    switch (state.numberKind) {
        case '0': return tokenizeCharCodeOp(input, { kind: 'invalidNumber' })
        case '.':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'fractional' }]
        case 'e':
        case 'e+':
        case 'e-':
        case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'expDigits' }]
        default: return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: state.numberKind }]
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const digit19ToToken = state => input => {
    switch (state.numberKind) {
        case '0': return tokenizeCharCodeOp(input, { kind: 'invalidNumber' })
        case '.':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'fractional' }]
        case 'e':
        case 'e+':
        case 'e-':
        case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'expDigits' }]
        default: return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'int' }]
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const expToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'e' }]
        default: return tokenizeCharCodeOp(input, { kind: 'invalidNumber' })
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const hyphenMinusToToken = state => input => {
    switch (state.numberKind) {
        case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'e-' }]
        default: return terminalToToken(state)(input)
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const plusSignToToken = state => input => {
    switch (state.numberKind) {
        case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), numberKind: 'e+' }]
        default: return tokenizeCharCodeOp(input, { kind: 'invalidNumber' })
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
                const next = tokenizeCharCodeOp(input, { kind: 'initial' })
                return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
            }
        default:
            {
                const next = tokenizeCharCodeOp(input, { kind: 'initial' })
                return [{ first: stateToNumberToken(state), tail: next[0] }, next[1]]
            }
    }
}

/** @type {_CreateToToken<_ParseNumberState>} */
const bigintToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int':
            {
                return [empty, { kind: 'number', value: state.value, numberKind: 'bigint' }]
            }
        default:
            {
                const next = tokenizeCharCodeOp(input, { kind: 'initial' })
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
    () => () => [empty, { kind: 'invalidNumber' }]
)([
    rangeSetFunc(rangeSetTerminalForNumber)(() => input => {
        const next = tokenizeCharCodeOp(input, { kind: 'initial' })
        return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
    })
])

/** @type {readonly NumberRange[]} */
const rangeSetStringControl = [
    [0x00, 0x09],
    [0x0b, 0x0c],
    [0x0e, 0x1f],
]

/** @type {(state: _ParseStringState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseStringStateOp = create(
    state => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }]
)([
    rangeFunc(one(quotationMark))(state => () => [[{ kind: 'string', value: state.value }], { kind: 'initial' }]),
    rangeFunc(one(reverseSolidus))(state => () => [empty, { kind: 'escapeChar', value: state.value }]),
    rangeSetFunc(rangeSetNewLine)(() => () => [[{ kind: 'error', message: 'unterminated string literal' }], { kind: 'nl' }]),
    rangeSetFunc(rangeSetStringControl)(state => () => [[{ kind: 'error', message: 'unescaped control character in string' }], { kind: 'string', value: state.value }])
])

/** @type {_CreateToToken<_ParseEscapeCharState>} */
const parseEscapeDefault = state => input => {
    const next = tokenizeCharCodeOp(input, { kind: 'string', value: state.value })
    return [{ first: { kind: 'error', message: 'unescaped character' }, tail: next[0] }, next[1]]
}

/**
 * One dispatch entry per simple escape, appending the code point the letter
 * denotes. The three self-denoting escapes are not special-cased: `\"` appends
 * `"` because that is what the table pairs it with.
 *
 * @type {readonly _RangeFunc<_ParseEscapeCharState>[]}
 */
const simpleEscapeFuncs = simpleEscapes.map(([letter, codePoint]) =>
    rangeFunc(one(letter))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(codePoint) }]))

/** @type {(state: _ParseEscapeCharState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseEscapeCharStateOp = create(parseEscapeDefault)([
    ...simpleEscapeFuncs,
    // `\u` is the one escape whose meaning is not a lookup: the four hex
    // digits that follow decide it, so it starts a state instead.
    rangeFunc(one(latinSmallLetterU))(state => () => [empty, { kind: 'unicodeChar', value: state.value, unicode: 0, hexIndex: 0 }]),
])

/** @type {_CreateToToken<_ParseUnicodeCharState>} */
const parseUnicodeCharDefault = state => input => {
    const next = tokenizeCharCodeOp(input, { kind: 'string', value: state.value })
    return [{ first: { kind: 'error', message: 'invalid hex value' }, tail: next[0] }, next[1]]
}

/**
 * `hexDigitValue` classifies the code point and decodes it in one step, so this
 * state needs no range-map dispatch: a `null` value is exactly the non-hex
 * input the default handler rejects.
 *
 * @type {(state: _ParseUnicodeCharState) => (input: number) => readonly [List<JsToken>, _TokenizerState]}
 */
const parseUnicodeCharStateOp = state => input => {
    const hexValue = hexDigitValue(input)
    if (hexValue === null) { return parseUnicodeCharDefault(state)(input) }
    const newUnicode = state.unicode | (hexValue << (3 - state.hexIndex) * 4)
    return [empty, state.hexIndex === 3 ?
        { kind: 'string', value: appendChar(state.value)(newUnicode) } :
        { kind: 'unicodeChar', value: state.value, unicode: newUnicode, hexIndex: state.hexIndex + 1 }]
}

/** @type {(s: string) => JsToken} */
const idToToken = s => at(s)(keywordMap) ?? { kind: 'id', value: s }

/** @type {_CreateToToken<_ParseIdState>} */
const parseIdDefault = state => input => {
    const keyWordToken = idToToken(state.value)
    const next = tokenizeCharCodeOp(input, { kind: 'initial' })
    return [{ first: keyWordToken, tail: next[0] }, next[1]]
}

/** @type {(state: _ParseIdState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseIdStateOp = create(parseIdDefault)([
    rangeSetFunc(rangeId)(state => input => [empty, { kind: 'id', value: appendChar(state.value)(input) }])
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
            const next = tokenizeCharCodeOp(input, { kind: 'initial' })
            return [{ first: getOperatorToken(state.value), tail: next[0] }, next[1]]
        }
    }
}

/** @type {(state: _ParseCommentState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseSinglelineCommentStateOp = create(
    state => input => [empty, { ...state, value: appendChar(state.value)(input) }]
)([
    rangeSetFunc(rangeSetNewLine)(state => () => [[{ kind: '//', value: state.value }], { kind: 'nl' }])
])

/** @type {(state: _ParseCommentState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseMultilineCommentStateOp = create(
    state => input => [empty, { ...state, value: appendChar(state.value)(input) }]
)([
    rangeFunc(one(asterisk))(state => () => [empty, { ...state, kind: '/**' }]),
    rangeSetFunc(rangeSetNewLine)(state => input => [empty, { ...state, value: appendChar(state.value)(input), newLine: true }]),
])

/** @type {(state: _ParseCommentState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseMultilineCommentAsteriskStateOp = create(
    state => input => [empty, { ...state, kind: '/*', value: appendChar(appendChar(state.value)(asterisk))(input) }]
)([
    rangeFunc(one(asterisk))(state => () => [empty, { ...state, value: appendChar(state.value)(asterisk) }]),
    rangeSetFunc(rangeSetNewLine)(state => input => [empty, { kind: '/*', value: appendChar(appendChar(state.value)(asterisk))(input), newLine: true }]),
    rangeFunc(one(solidus))(state => () => {
        /** @type {List<JsToken>} */
        const tokens = state.newLine ? [{ kind: '/*', value: state.value }, { kind: 'nl' }] : [{ kind: '/*', value: state.value }]
        return [tokens, { kind: 'initial' }]
    })
])

/**
 * The coalescing rule for whitespace/newline trivia: a maximal run collapses
 * to a single token, and a run containing any newline is an `nl`. Equal kinds
 * coalesce; `nl` absorbs `ws`.
 *
 * Exported because `fjs/djs/tokenizer` produces the same token stream and must
 * agree byte for byte — its scanner reaches the same four decisions from
 * grammar tags. This module defines `JsToken`, so the rule is stated here once
 * rather than re-derived on each side with only the proofs to catch a drift.
 *
 * @type {(a: TriviaKind, b: TriviaKind) => TriviaKind}
 */
export const mergeTrivia = (a, b) => a === 'nl' || b === 'nl' ? 'nl' : 'ws'

/**
 * The two trivia states, shared rather than rebuilt, so a run of trivia
 * allocates nothing per character.
 *
 * @type {{ readonly ws: _ParseWhitespaceState, readonly nl: _ParseNewLineState }}
 */
const triviaState = { ws: { kind: 'ws' }, nl: { kind: 'nl' } }

/** @type {_CreateToToken<_ParseWhitespaceState>} */
const parseWhitespaceDefault = () => input => {
    const next = tokenizeCharCodeOp(input, { kind: 'initial' })
    return [{ first: { kind: 'ws' }, tail: next[0] }, next[1]]
}

/** @type {(state: _ParseWhitespaceState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseWhitespaceStateOp = create(parseWhitespaceDefault)([
    rangeSetFunc(rangeSetWhiteSpace)(({ kind }) => () => [empty, triviaState[mergeTrivia(kind, 'ws')]]),
    rangeSetFunc(rangeSetNewLine)(({ kind }) => () => [empty, triviaState[mergeTrivia(kind, 'nl')]])
])

/** @type {_CreateToToken<_ParseNewLineState>} */
const parseNewLineDefault = () => input => {
    const next = tokenizeCharCodeOp(input, { kind: 'initial' })
    return [{ first: { kind: 'nl' }, tail: next[0] }, next[1]]
}

/** @type {(state: _ParseNewLineState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const parseNewLineStateOp = create(parseNewLineDefault)([
    rangeSetFunc(rangeSetWhiteSpace)(({ kind }) => () => [empty, triviaState[mergeTrivia(kind, 'ws')]]),
    rangeSetFunc(rangeSetNewLine)(({ kind }) => () => [empty, triviaState[mergeTrivia(kind, 'nl')]])
])

/** @type {(state: _EofState) => (input: number) => readonly [List<JsToken>, _TokenizerState]} */
const eofStateOp = create(
    state => () => [[{ kind: 'error', message: 'eof' }], state]
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
            return [[stateToNumberToken(state), { kind: 'eof' }], { kind: 'eof' }]
        case 'op': return [[getOperatorToken(state.value), { kind: 'eof' }], { kind: 'eof' }]
        case '//': return [[{ kind: '//', value: state.value }, { kind: 'eof' }], { kind: 'eof' }]
        case '/*':
        case '/**': return [[{ kind: 'error', message: '*/ expected' }, { kind: 'eof' }], { kind: 'eof', }]
        case 'ws': return [[{ kind: 'ws' }, { kind: 'eof' }], { kind: 'eof' }]
        case 'nl': return [[{ kind: 'nl' }, { kind: 'eof' }], { kind: 'eof' }]
        case 'eof': return [[{ kind: 'error', message: 'eof' }, { kind: 'eof' }], state]
    }
}

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
    // `tokenize` appends exactly one trailing `null` after its input, so the
    // scan reaches `{ kind: 'eof' }` only on that final step — nothing ever
    // runs tokenizeCharCodeOp/tokenizeEofOp again afterward with that state.
    // Call each directly to cover their otherwise-unreachable `'eof'` arms.
    tokenizeCharCodeOpAfterEof: () => {
        const [tokens, state] = tokenizeCharCodeOp('a'.charCodeAt(0), { kind: 'eof' })
        assertStructurallySame(toArray(tokens), [{ kind: 'error', message: 'eof' }])
        assertStructurallySame(state, { kind: 'eof' })
    },
    tokenizeEofOpAfterEof: () => {
        const [tokens, state] = tokenizeEofOp({ kind: 'eof' })
        assertStructurallySame(toArray(tokens), [{ kind: 'error', message: 'eof' }, { kind: 'eof' }])
        assertStructurallySame(state, { kind: 'eof' })
    },
    throw: {
        // union throws when two distinct non-default handlers are merged for the same range;
        // this path is unreachable through the public API (no overlapping ranges in practice).
        unionConflict: () => unionX(0)(1)(2)
    }
}
