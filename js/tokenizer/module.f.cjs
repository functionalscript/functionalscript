const operator = require('../../types/function/operator/module.f.cjs')
const range_map = require('../../types/range_map/module.f.cjs')
const { merge, fromRange, get } = range_map
const list = require('../../types/list/module.f.cjs')
const _range = require('../../types/range/module.f.cjs')
const { one } = _range
const { empty, stateScan, flat, toArray, reduce: listReduce, scan } = list
const bigfloat = require('../../types/bigfloat/module.f.cjs')
const { fromCharCode } = String
const {
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
} = require('../../text/ascii/module.f.cjs')

/**
 * @typedef {{
* readonly kind: 'string'
* readonly value: string
* }} StringToken
* */

/**
* @typedef {{
* readonly kind: 'number'
* readonly value: string
* readonly bf: bigfloat.BigFloat
* }} NumberToken
* */

/**
* @typedef {{
* readonly kind: 'bigint'
* readonly value: bigint
* }} BigIntToken
* */

/** @typedef {{readonly kind: 'error', message: ErrorMessage}} ErrorToken */

/** @typedef {{readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | 'true' | 'false' | 'null'}} SimpleToken */

/**
 * @typedef {{
* readonly kind: 'id'
* readonly value: string
* }} IdToken
* */

/**
 * @typedef {|
* {readonly kind: '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=' } |
* {readonly kind: '+' | '-' | '*' | '/' | '%' | '++' | '--' | '**' } |
* {readonly kind: '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '**='} |
* {readonly kind: '&' | '|' | '^' | '~' | '<<' | '>>' | '>>>' } |
* {readonly kind: '&=' | '|=' | '^=' | '<<=' | '>>=' | '>>>='} |
* {readonly kind: '&&' | '||' | '!' } |
* {readonly kind: '&&=' | '||=' | '??=' } |
* {readonly kind: '?' | '?.' | '.' | '=>'}
* } OperatorToken
*/

/**
 * @typedef {|
* SimpleToken |
* StringToken |
* NumberToken |
* ErrorToken |
* IdToken |
* BigIntToken |
* OperatorToken
* } JsToken
*/

const rangeOneNine = range('19')

const rangeSetWhiteSpace = [
    one(ht),
    one(lf),
    one(cr),
    one(space)
]

const rangeSetTerminalForNumber = [
    one(ht),
    one(lf),
    one(cr),
    one(space),
    one(quotationMark),
    one(comma),
    one(leftCurlyBracket),
    one(rightCurlyBracket),
    one(leftSquareBracket),
    one(rightSquareBracket),
    one(colon)
]

const rangeSmallAF = range('af')
const rangeCapitalAF = range('AF')

const rangeIdStart = [
    latinSmallLetterRange,
    latinCapitalLetterRange,
    one(lowLine),
    one(dollarSign)
]

const opStart = [
    one(exclamationMark),
    one(percentSign),
    one(ampersand),
    one(asterisk),
    one(lessThanSign),
    one(equalsSign),
    one(greaterThanSign),
    one(questionMark),
    one(circumflexAccent),
    one(verticalLine),
    one(tilde),
    one(plusSign),
    one(fullStop),
    one(solidus)
]

const rangeId = [digitRange, ...rangeIdStart]

/**
 * @typedef {|
 * InitialState |
 * ParseIdState |
 * ParseStringState |
 * ParseEscapeCharState |
 * ParseUnicodeCharState |
 * ParseNumberState |
 * InvalidNumberState |
 * ParseOperatorState |
 * EofState
 * } TokenizerState
 */

/**
 * @typedef {|
  * '" are missing' |
 * 'unescaped character' |
 * 'invalid hex value' |
 * 'unexpected character' |
 * 'invalid number' |
 * 'invalid token' |
 * 'eof'
 * } ErrorMessage
 */

/** @typedef {{ readonly kind: 'initial'}} InitialState */

/** @typedef {{ readonly kind: 'id', readonly value: string}} ParseIdState */

/** @typedef {{ readonly kind: 'string', readonly value: string}} ParseStringState */

/** @typedef {{ readonly kind: 'escapeChar', readonly value: string}} ParseEscapeCharState */

/** @typedef {{ readonly kind: 'op', readonly value: string}} ParseOperatorState */

/**
 * @typedef {{
 *  readonly kind: 'unicodeChar'
 *  readonly value: string
 *  readonly unicode: number
 *  readonly hexIndex: number
 * }} ParseUnicodeCharState
 */

/**
 * @typedef {{
 *  readonly kind: 'number',
 *  readonly numberKind: '0' | '-' | 'int' | '.' | 'fractional' | 'e' | 'e+' | 'e-' | 'expDigits' | 'bigint'
 *  readonly value: string
 *  readonly b: ParseNumberBuffer
 * }} ParseNumberState
 */

/**
 * @typedef {{
*  readonly s: -1n | 1n
*  readonly m: bigint
*  readonly f: number
*  readonly es: -1 | 1
*  readonly e: number
* }} ParseNumberBuffer
*/

/** @typedef {{ readonly kind: 'invalidNumber'}} InvalidNumberState */

/** @typedef {{ readonly kind: 'eof'}} EofState */

/** @typedef {number|null} CharCodeOrEof */

/** @typedef {(input: number) => readonly[list.List<JsToken>, TokenizerState]} ToToken */

/**
 * @template T
 * @typedef {(state: T) => ToToken} CreateToToken<T>
 */

/** @typedef {list.List<_range.Range>} RangeSet */

/**
 * @template T
 * @typedef {(def: CreateToToken<T>) => (RangeMapToToken<T>)} RangeFunc<T>
 */

/**
 * @template T
 * @typedef {range_map.RangeMapArray<CreateToToken<T>>} RangeMapToToken<T>
 */

/** @type {(old: string) => (input: number) => string} */
const appendChar = old => input => `${old}${fromCharCode(input)}`

/** @type {<T>(def: CreateToToken<T>) => (a: CreateToToken<T>) => (b: CreateToToken<T>) => CreateToToken<T>} */
const union = def => a => b => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}

/** @type {<T>(def:  CreateToToken<T>) => range_map.RangeMerge<CreateToToken<T>>} */
const rangeMapMerge = def => merge({
    union: union(def),
    equal: operator.strictEqual,
})

/** @type {<T>(r: _range.Range) => (f: CreateToToken<T>) => RangeFunc<T>} */
const rangeFunc = r => f => def => fromRange(def)(r)(f)

/** @type {<T>(def:  CreateToToken<T>) => (operator.Scan<RangeFunc<T>, RangeMapToToken<T>>)} */
const scanRangeOp = def => f => [f(def), scanRangeOp(def)]

/** @type {<T>(def: CreateToToken<T>) => (a: list.List<RangeFunc<T>>) => RangeMapToToken<T>} */
const reduceRangeMap = def => a => {
    const rm = scan(scanRangeOp(def))(a)
    return toArray(listReduce(rangeMapMerge(def))(empty)(rm))
}

/** @type {<T>(def:  CreateToToken<T>) => (f:  CreateToToken<T>) => (operator.Scan<_range.Range, RangeMapToToken<T>>)} */
const scanRangeSetOp = def => f => r => [fromRange(def)(r)(f), scanRangeSetOp(def)(f)]

/** @type {<T>(rs: list.List<_range.Range>) => (f: CreateToToken<T>) => RangeFunc<T>} */
const rangeSetFunc = rs => f => def => {
    const rm = scan(scanRangeSetOp(def)(f))(rs)
    return toArray(listReduce(rangeMapMerge(def))(empty)(rm))
}

/** @type {<T>(def: CreateToToken<T>) => (a: list.List<RangeFunc<T>>) => CreateToToken<T>} */
const create = def => a => {
    /** @typedef {typeof def extends CreateToToken<infer T> ? T : never} T */
    const i = reduceRangeMap(def)(a)
    /** @type {(v: number) => (i: RangeMapToToken<T>) => (v: T) => ToToken} */
    const x = get(def)
    return v => c => x(c)(i)(v)(c)
}

/** @type {(digit: number) => bigint} */
const digitToBigInt = d => BigInt(d - digit0)

/** @type {(digit: number) => ParseNumberBuffer} */
const startNumber = digit => ({ s: 1n, m: digitToBigInt(digit), f: 0, es: 1, e: 0 })

/** @type {ParseNumberBuffer} */
const startNegativeNumber = { s: -1n, m: 0n, f: 0, es: 1, e: 0 }

/** @type {(digit: number) => (b: ParseNumberBuffer) => ParseNumberBuffer} */
const addIntDigit = digit => b => ({ ... b, m: b.m * 10n + digitToBigInt(digit)})

/** @type {(digit: number) => (b: ParseNumberBuffer) => ParseNumberBuffer} */
const addFracDigit = digit => b => ({ ... b, m: b.m * 10n + digitToBigInt(digit), f: b.f - 1})

/** @type {(digit: number) => (b: ParseNumberBuffer) => ParseNumberBuffer} */
const addExpDigit = digit => b =>  ({ ... b, e: b.e * 10 + digit - digit0})

/** @type {(s: ParseNumberState) => JsToken} */
const bufferToNumberToken = ({numberKind, value, b}) =>
{
    if (numberKind === 'bigint')
        return { kind: 'bigint', value: b.s * b.m }
    return { kind: 'number', value: value, bf: [b.s * b.m, b.f + b.es * b.e] }
}

/**
 * @typedef {{
*  readonly map: OperatorTransitionMap,
*  readonly def: JsToken
* }} OperatorTransition
*/

/** @typedef {{ readonly[input in number]: readonly[list.List<JsToken>, TokenizerState] }} OperatorTransitionMap */

/**
 * @typedef {{
*  readonly[state in string]: OperatorTransition
* }} OperatorDfa
*/

/** @type {OperatorDfa} */
const operatorDfa = {}

/** @type {(state: InitialState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const initialStateOp = create(state => () => [[{ kind: 'error', message: 'unexpected character' }], state])([
    rangeFunc(rangeOneNine)(() => input => [empty, { kind: 'number', value: fromCharCode(input), b: startNumber(input), numberKind: 'int' }]),
    rangeSetFunc(rangeIdStart)(() => input => [empty, { kind: 'id', value: fromCharCode(input) }]),
    rangeSetFunc(rangeSetWhiteSpace)(state => () => [empty, state]),
    rangeFunc(one(leftCurlyBracket))(state => () => [[{ kind: '{' }], state]),
    rangeFunc(one(rightCurlyBracket))(state => () => [[{ kind: '}' }], state]),
    rangeFunc(one(colon))(state => () => [[{ kind: ':' }], state]),
    rangeFunc(one(comma))(state => () => [[{ kind: ',' }], state]),
    rangeFunc(one(leftSquareBracket))(state => () => [[{ kind: '[' }], state]),
    rangeFunc(one(rightSquareBracket))(state => () => [[{ kind: ']' }], state]),
    rangeFunc(one(quotationMark))(() => () => [empty, { kind: 'string', value: '' }]),
    rangeFunc(one(digit0))(() => input => [empty, { kind: 'number', value: fromCharCode(input), b: startNumber(input), numberKind: '0' }]),
    rangeFunc(one(hyphenMinus))(() => input => [empty, { kind: 'number', value: fromCharCode(input), b: startNegativeNumber, numberKind: '-' }])
])

/** @type {() => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const invalidNumberToToken = () => input =>
{
    const next = tokenizeOp({ kind: 'initial' })(input)
    return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const fullStopToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: '.' }]
        default: return tokenizeOp({ kind: 'invalidNumber' })(input)
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const digit0ToToken = state => input => {
    switch (state.numberKind) {
        case '0': return tokenizeOp({ kind: 'invalidNumber' })(input)
        case '-': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: '0' }]
        case '.':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addFracDigit(input)(state.b), numberKind: 'fractional' }]
        case 'e':
        case 'e+':
        case 'e-':
        case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addExpDigit(input)(state.b), numberKind: 'expDigits' }]
        default: return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addIntDigit(input)(state.b), numberKind: state.numberKind }]
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const digit19ToToken = state => input => {
    switch (state.numberKind) {
        case '0': return tokenizeOp({ kind: 'invalidNumber' })(input)
        case '.':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addFracDigit(input)(state.b), numberKind: 'fractional' }]
        case 'e':
        case 'e+':
        case 'e-':
        case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addExpDigit(input)(state.b), numberKind: 'expDigits' }]
        default: return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addIntDigit(input)(state.b), numberKind: 'int' }]
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const expToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int':
        case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: 'e' }]
        default: return tokenizeOp({ kind: 'invalidNumber' })(input)
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const hyphenMinusToToken = state => input => {
    switch (state.numberKind) {
        case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: { ... state.b, es: -1}, numberKind: 'e-' }]
        default: return tokenizeOp({ kind: 'invalidNumber' })(input)
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const plusSignToToken = state => input => {
    switch (state.numberKind) {
        case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: 'e+' }]
        default: return tokenizeOp({ kind: 'invalidNumber' })(input)
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const terminalToToken = state => input => {
    switch (state.numberKind) {
        case '-':
        case '.':
        case 'e':
        case 'e+':
        case 'e-':
            {
                const next = tokenizeOp({ kind: 'initial' })(input)
                return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
            }
        default:
            {
                const next = tokenizeOp({ kind: 'initial' })(input)
                return [{ first: bufferToNumberToken(state), tail: next[0] }, next[1]]
            }
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const bigintToToken = state => input => {
    switch (state.numberKind) {
        case '0':
        case 'int':
            {
                return [empty, { kind: 'number', value: state.value, b: state.b, numberKind: 'bigint' }]
            }
        default:
            {
                const next = tokenizeOp({ kind: 'initial' })(input)
                return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
            }
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
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

/** @type {(state: InvalidNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const invalidNumberStateOp = create(() => () => [empty, { kind: 'invalidNumber' }])([
    rangeSetFunc(rangeSetTerminalForNumber)(() => input => {
        const next = tokenizeOp({ kind: 'initial' })(input)
        return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
    })
])

/** @type {(state: ParseStringState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseStringStateOp = create(state => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }])([
    rangeFunc(one(quotationMark))(state => () => [[{ kind: 'string', value: state.value }], { kind: 'initial' }]),
    rangeFunc(one(reverseSolidus))(state => () => [empty, { kind: 'escapeChar', value: state.value }])
])

/** @type {(state: ParseEscapeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseEscapeDefault = state => input => {
    const next = tokenizeOp({ kind: 'string', value: state.value })(input)
    return [{ first: { kind: 'error', message: 'unescaped character' }, tail: next[0] }, next[1]]
}

/** @type {(state: ParseEscapeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseEscapeCharStateOp = create(parseEscapeDefault)([
    rangeSetFunc([one(quotationMark), one(reverseSolidus), one(solidus)])(state => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }]),
    rangeFunc(one(latinSmallLetterB))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(backspace) }]),
    rangeFunc(one(latinSmallLetterF))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ff) }]),
    rangeFunc(one(latinSmallLetterN))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(lf) }]),
    rangeFunc(one(latinSmallLetterR))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(cr) }]),
    rangeFunc(one(latinSmallLetterT))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ht) }]),
    rangeFunc(one(latinSmallLetterU))(state => () => [empty, { kind: 'unicodeChar', value: state.value, unicode: 0, hexIndex: 0 }]),
])

/** @type {(state: ParseUnicodeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseUnicodeCharDefault = state => input => {
    const next = tokenizeOp({ kind: 'string', value: state.value })(input)
    return [{ first: { kind: 'error', message: 'invalid hex value' }, tail: next[0] }, next[1]]
}

/** @type {(offser: number) => (state: ParseUnicodeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseUnicodeCharHex = offset => state => input => {
    const hexValue = input - offset
    const newUnicode = state.unicode | (hexValue << (3 - state.hexIndex) * 4)
    return [empty, state.hexIndex === 3 ?
        { kind: 'string', value: appendChar(state.value)(newUnicode) } :
        { kind: 'unicodeChar', value: state.value, unicode: newUnicode, hexIndex: state.hexIndex + 1 }]
}

/** @type {(state: ParseUnicodeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseUnicodeCharStateOp = create(parseUnicodeCharDefault)([
    rangeFunc(digitRange)(parseUnicodeCharHex(digit0)),
    rangeFunc(rangeSmallAF)(parseUnicodeCharHex(latinSmallLetterA - 10)),
    rangeFunc(rangeCapitalAF)(parseUnicodeCharHex(latinCapitalLetterA - 10))
])

/** @type {(s: string) => JsToken} */
const idToToken = s => {
    switch (s) {
        case 'true': return { kind: 'true' }
        case 'false': return { kind: 'false' }
        case 'null': return { kind: 'null' }
        default: return { kind: 'id', value: s }
    }
}

/** @type {(state: ParseIdState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseIdDefault = state => input => {
    const keyWordToken = idToToken(state.value)
    const next = tokenizeOp({ kind: 'initial' })(input)
    return [{ first: keyWordToken, tail: next[0] }, next[1]]
}

/** @type {(state: ParseIdState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseIdStateOp = create(parseIdDefault)([
    rangeSetFunc(rangeId)(state => input => [empty, { kind: 'id', value: appendChar(state.value)(input) }])
])

/** @type {(state: ParseOperatorState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const parseOperatorStateOp = state => input => {
    const t = operatorDfa[state.value]
    const m = t.map[input]
    if (m !== undefined)
        return m
    const next = tokenizeOp({ kind: 'initial' })(input)
    return [{ first: t.def, tail: next[0] }, next[1]]
}

/** @type {(state: EofState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]} */
const eofStateOp = create(state => () => [[{ kind: 'error', message: 'eof' }], state])([])

/** @type {operator.StateScan<number, TokenizerState, list.List<JsToken>>} */
const tokenizeCharCodeOp = state => {
    switch (state.kind) {
        case 'initial': return initialStateOp(state)
        case 'id': return parseIdStateOp(state)
        case 'string': return parseStringStateOp(state)
        case 'escapeChar': return parseEscapeCharStateOp(state)
        case 'unicodeChar': return parseUnicodeCharStateOp(state)
        case 'invalidNumber': return invalidNumberStateOp(state)
        case 'number': return parseNumberStateOp(state)
        case 'op': return parseOperatorStateOp(state)
        case 'eof': return eofStateOp(state)
    }
}

/** @type {(state: TokenizerState) => readonly[list.List<JsToken>, TokenizerState]} */
const tokenizeEofOp = state => {
    switch (state.kind) {
        case 'initial': return [empty, { kind: 'eof' }]
        case 'id': return [[idToToken(state.value)], { kind: 'eof' }]
        case 'string':
        case 'escapeChar':
        case 'unicodeChar': return [[{ kind: 'error', message: '" are missing' }], { kind: 'eof' }]
        case 'invalidNumber': return [[{ kind: 'error', message: 'invalid number' }], { kind: 'eof' }]
        case 'number':
            switch (state.numberKind) {
                case '-':
                case '.':
                case 'e':
                case 'e+':
                case 'e-': return [[{ kind: 'error', message: 'invalid number' }], { kind: 'invalidNumber', }]
                default: return [[bufferToNumberToken(state)], { kind: 'eof' }]
            }
        case 'op': return [[operatorDfa[state.value].def], { kind: 'eof' }]
        case 'eof': return [[{ kind: 'error', message: 'eof' }], state]
    }
}

/** @type {operator.StateScan<CharCodeOrEof, TokenizerState, list.List<JsToken>>} */
const tokenizeOp = state => input => input === null ? tokenizeEofOp(state) : tokenizeCharCodeOp(state)(input)

const scanTokenize = stateScan(tokenizeOp)

const initial = scanTokenize({ kind: 'initial' })

/** @type {(input: list.List<number>) => list.List<JsToken>} */
const tokenize = input => flat(initial(flat([/** @type {list.List<CharCodeOrEof>} */(input), [null]])))

module.exports = {
    /** @readonly */
    tokenize
}
