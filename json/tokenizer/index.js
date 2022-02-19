const { todo } = require('../../dev')
const operator = require('../../types/function/operator')
const { concat } = require('../../types/list')
const list = require('../../types/list')

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
 * }} NumberToken
 * */

/** @typedef {{readonly kind: 'error', message: ErrorMessage}} ErrorToken */

/** @typedef {{readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | 'true' | 'false' | 'null'}} SimpleToken */

/**
 * @typedef {|
 * SimpleToken |
 * StringToken |
 * NumberToken |
 * ErrorToken
 * } JsonToken
 */

const leftBrace = 0x7b
const rightBrace = 0x7d
const colon = 0x3a
const comma = 0x2c
const leftBracket = 0x5b
const rightBracket = 0x5d

const quotationMark = 0x22
const digit0 = 0x30
const digit1 = 0x31
const digit9 = 0x39
const signPlus = 0x2b
const signMinus = 0x2d
const decimalPoint = 0x2e

const horizontalTab = 0x09
const newLine = 0x0a
const carriageReturn = 0x0d
const space = 0x20

const backslach = 0x5c
const slash = 0x2f
const backspace = 0x08
const formfeed = 0x0c

const capitalLetterA = 0x41
const capitalLetterE = 0x45
const capitalLetterF = 0x46

const letterA = 0x61
const letterB = 0x62
const letterE = 0x65
const letterF = 0x66
const letterN = 0x6e
const letterR = 0x72
const letterT = 0x74
const letterU = 0x75
const letterZ = 0x7a

/**
 * @typedef {|
 * InitialState |
 * ParseKeywordState |
 * ParseStringState |
 * ParseEscapeCharState |
 * ParseUnicodeCharState |
 * ParseNumberState |
 * InvalidNumberState |
 * EofState
 * } TokenizerState
 */

/**
 * @typedef {|
 * 'invalid keyword' |
 * '" are missing' |
 * 'unescaped character' |
 * 'invalid hex value' |
 * 'unexpected character' |
 * 'invalid number' |
 * 'eof'
 * } ErrorMessage
 */

/** @typedef {{ readonly kind: 'initial'}} InitialState */

/** @typedef {{ readonly kind: 'keyword', readonly value: string}} ParseKeywordState */

/** @typedef {{ readonly kind: 'string', readonly value: string}} ParseStringState */

/** @typedef {{ readonly kind: 'escapeChar', readonly value: string}} ParseEscapeCharState */

/** @typedef {{ readonly kind: 'unicodeChar', readonly value: string, readonly unicode: number, readonly hexIndex: number}} ParseUnicodeCharState */

/**
 *  @typedef {{
 * readonly kind: 'number',
 * readonly numberKind: '0' | '-' | 'int' | '.' | 'fractional' | 'e' | 'e+' | 'e-' | 'expDigits'
 * readonly value: string
 * }} ParseNumberState
 *  */

/** @typedef {{ readonly kind: 'invalidNumber'}} InvalidNumberState */

/** @typedef {{ readonly kind: 'eof'}} EofState */

/** @typedef {number|undefined} CharCodeOrEof */

/** @type {(old: string) => (input: CharCodeOrEof) => string} */
const appendChar = old => input => input === undefined ? old : operator.concat(charToString(input))(old)

/** @type {(input: CharCodeOrEof) => string} */
const charToString = input => input === undefined ? '' : String.fromCharCode(input)

/** @type {(state: InitialState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const initialStateOp = initialState => input =>
{
    if (input >= digit1 && input <= digit9)
    {
        return [undefined, { kind: 'number', value: charToString(input), numberKind: 'int'}]
    }
    if (input >= letterA && input <= letterZ)
    {
        return [undefined, { kind: 'keyword', value: charToString(input)}]
    }
    switch(input)
    {
        case leftBrace: return [[{kind: '{'}], initialState]
        case rightBrace: return [[{kind: '}'}], initialState]
        case colon: return [[{kind: ':'}], initialState]
        case comma: return [[{kind: ','}], initialState]
        case leftBracket: return [[{kind: '['}], initialState]
        case rightBracket: return [[{kind: ']'}], initialState]
        case quotationMark: return[undefined, {kind: 'string', value: ''}]
        case digit0: return [undefined, { kind: 'number', value: charToString(input), numberKind: '0'}]
        case signMinus: return [undefined, { kind: 'number', value: charToString(input), numberKind: '-'}]
        case horizontalTab:
        case newLine:
        case carriageReturn:
        case space: return[undefined, initialState]
        default: return [[{kind: 'error', message: 'unexpected character'}], initialState]
    }
}

/** @type {(state: ParseNumberState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseNumberStateOp = state => input =>
{
    if (input === decimalPoint)
    {
        switch (state.numberKind)
        {
            case '0':
            case 'int': return [undefined, {kind: 'number', value: appendChar(state.value)(input), numberKind: '.'}]
            default: return tokenizeOp({kind: 'invalidNumber'})(input)
        }
    }
    if (input === digit0)
    {
        switch (state.numberKind)
        {
            case '0': return tokenizeOp({kind: 'invalidNumber'})(input)
            case '-': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: '0'}]
            case '.': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'fractional'}]
            case 'e':
            case 'e+':
            case 'e-': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'expDigits'}]
            default: return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: state.numberKind}]
        }
    }
    if (input >= digit1 && input <= digit9)
    {
        switch (state.numberKind)
        {
            case '0': return tokenizeOp({kind: 'invalidNumber'})(input)
            case '-': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'int'}]
            case '.': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'fractional'}]
            case 'e':
            case 'e+':
            case 'e-': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'expDigits'}]
            default: return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: state.numberKind}]
        }
    }
    if (input === letterE || input === capitalLetterE)
    {
        switch (state.numberKind)
        {
            case '0':
            case 'int':
            case 'fractional': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'e'}]
            default: return tokenizeOp({kind: 'invalidNumber'})(input)
        }
    }
    if (input === signMinus)
    {
        switch (state.numberKind)
        {
            case 'e': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'e-'}]
            default: return tokenizeOp({kind: 'invalidNumber'})(input)
        }
    }
    if (input === signPlus)
    {
        switch (state.numberKind)
        {
            case 'e': return [undefined, {kind:'number', value: appendChar(state.value)(input), numberKind: 'e+'}]
            default: return tokenizeOp({kind: 'invalidNumber'})(input)
        }
    }
    if (isTerminalForNumber(input))
    {
        switch (state.numberKind)
        {
            case '-':
            case '.':
            case 'e':
            case 'e+':
            case 'e-':
            {
                const next = tokenizeOp({kind: 'initial'})(input)
                return [{first: {kind: 'error', message: 'invalid number'}, tail: next[0]}, next[1]]
            }
            default:
            {
                const next = tokenizeOp({kind: 'initial'})(input)
                return [{first: {kind: 'number', value: state.value}, tail: next[0]}, next[1]]
            }
        }
    }
    return tokenizeOp({kind: 'invalidNumber'})(input)
}

/** @type {(char: number) => boolean} */
const isTerminalForNumber = char =>
{
    switch (char)
    {
        case quotationMark:
        case comma:
        case leftBrace:
        case rightBrace:
        case leftBracket:
        case rightBracket:
        case colon: return true
        default: return false
    }
}

/** @type {(state: InvalidNumberState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const invalidNumberStateOp = state => input =>
{
    if (isTerminalForNumber(input))
    {
        const next = tokenizeOp({kind: 'initial'})(input)
        return [{first: {kind: 'error', message: 'invalid number'}, tail: next[0]}, next[1]]
    }
    return [undefined, {kind: 'invalidNumber'}]
}

/** @type {(state: ParseStringState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseStringStateOp = state => input =>
{
    switch(input)
    {
        case quotationMark: return[[{kind: 'string', value: state.value}], {kind: 'initial'}]
        case backslach: return [undefined, {kind:'escapeChar', value: state.value}]
        default: return [undefined, {kind:'string', value: appendChar(state.value)(input)}]
    }
}

/** @type {(state: ParseEscapeCharState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseEscapeCharStateOp = state => input =>
{
    switch(input)
    {
        case quotationMark:
        case backslach:
        case slash: return [undefined, {kind: 'string', value: appendChar(state.value)(input)}]
        case letterB: return [undefined, {kind: 'string', value: appendChar(state.value)(backspace)}]
        case letterF: return [undefined, {kind: 'string', value: appendChar(state.value)(formfeed)}]
        case letterN: return [undefined, {kind: 'string', value: appendChar(state.value)(newLine)}]
        case letterR: return [undefined, {kind: 'string', value: appendChar(state.value)(carriageReturn)}]
        case letterT: return [undefined, {kind: 'string', value: appendChar(state.value)(horizontalTab)}]
        case letterU: return [undefined, {kind: 'unicodeChar', value: state.value, unicode: 0, hexIndex: 0}]
        default: {
            const next = tokenizeOp({kind: 'string', value: state.value})(input)
            return [{first: {kind: 'error', message: 'unescaped character'}, tail: next[0]}, next[1]]
        }
    }
}

/** @type {(hex: number) => number|undefined} */
const hexDigitToNumber = hex =>
{
    if (hex >= digit0 && hex <= digit9) { return hex - digit0 }
    if (hex >= capitalLetterA && hex <= capitalLetterF) { return hex - capitalLetterA + 10 }
    if (hex >= letterA && hex <= letterF) { return hex - letterA + 10 }
}

/** @type {(state: ParseUnicodeCharState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseUnicodeCharStateOp = state => input =>
{
    const hexValue = hexDigitToNumber(input)
    if (hexValue === undefined)
    {
        const next = tokenizeOp({kind: 'string', value: state.value})(input)
        return [{first: {kind: 'error', message: 'invalid hex value'}, tail: next[0]}, next[1]]
    }
    const newUnicode = state.unicode | (hexValue << (3 - state.hexIndex) * 4)
        return [undefined, state.hexIndex === 3 ?
            {kind: 'string', value: appendChar(state.value)(newUnicode)} :
            {kind: 'unicodeChar', value: state.value, unicode: newUnicode, hexIndex: state.hexIndex + 1}]
}

/** @type {(s: string) => JsonToken} */
const stringToKeywordToken = s =>
{
    switch(s)
    {
        case 'true': return {kind: 'true'}
        case 'false': return {kind: 'false'}
        case 'null': return {kind: 'null'}
        default: return {kind: 'error', message: 'invalid keyword'}
    }
}

/** @type {(state: ParseKeywordState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseKeyWordStateOp = state => input =>
{
    if (input >= letterA && input <= letterZ)
    {
        return [undefined, {kind: 'keyword', value: appendChar(state.value)(input)}]
    }
    const keyWordToken = stringToKeywordToken(state.value)
    const next = tokenizeOp({kind: 'initial'})(input)
    return [{first: keyWordToken, tail: next[0]}, next[1]]
}

/** @type {(state: EofState) => (input: number) => readonly[list.List<JsonToken>, TokenizerState]} */
const eofStateOp = state => input => [[{kind: 'error', message: 'eof'}], state]

/** @type {operator.StateScan<number, TokenizerState, list.List<JsonToken>>} */
const tokenizeCharCodeOp = state => {
    switch(state.kind)
    {
        case 'initial': return initialStateOp(state)
        case 'keyword': return parseKeyWordStateOp(state)
        case 'string': return parseStringStateOp(state)
        case 'escapeChar': return parseEscapeCharStateOp(state)
        case 'unicodeChar': return parseUnicodeCharStateOp(state)
        case 'invalidNumber': return invalidNumberStateOp(state)
        case 'number': return parseNumberStateOp(state)
        case 'eof': return eofStateOp(state)
    }
}

/** @type {(state: TokenizerState) => readonly[list.List<JsonToken>, TokenizerState]} */
const tokenizeEofOp = state => {
    switch(state.kind)
    {
        case 'initial': return[undefined, {kind: 'eof'}]
        case 'keyword': return [[stringToKeywordToken(state.value)], {kind: 'eof'}]
        case 'string':
        case 'escapeChar':
        case 'unicodeChar': return [[{kind: 'error', message: '" are missing'}], {kind: 'eof'}]
        case 'invalidNumber': return [[{kind: 'error', message: 'invalid number'}], {kind: 'eof'}]
        case 'number':
            switch (state.numberKind)
            {
                case '-':
                case '.':
                case 'e':
                case 'e+':
                case 'e-': return [[{kind: 'error', message: 'invalid number'}], {kind: 'invalidNumber', }]
                default: return [[{kind: 'number', value: state.value}], {kind: 'eof'}]
            }
        case 'eof': return [[{kind: 'error', message: 'eof'}], state]
    }
}

/** @type {operator.StateScan<CharCodeOrEof, TokenizerState, list.List<JsonToken>>} */
const tokenizeOp = state => input => input === undefined ? tokenizeEofOp(state) : tokenizeCharCodeOp(state)(input)

/** @type {(input: list.List<CharCodeOrEof>) => list.List<JsonToken>} */
const tokenize = input => list.flat(list.stateScan(tokenizeOp)({kind: 'initial'})(input))

module.exports = {
    /** @readonly */
    tokenize,
}
