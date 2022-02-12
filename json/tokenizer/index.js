const { todo } = require('../../dev')
const operator = require('../../types/function/operator');
const { concat } = require('../../types/list');
const list = require('../../types/list')

/** @typedef {{readonly kind: '{'}} LeftBraceToken */

/** @typedef {{readonly kind: '}'}} RightBraceToken */

/** @typedef {{readonly kind: ':'}} ColonToken */

/** @typedef {{readonly kind: ','}} CommaToken */

/** @typedef {{readonly kind: '['}} LeftBracketToken */

/** @typedef {{readonly kind: ']'}} RightBracketToken */

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

/** @typedef {{readonly kind: 'true'}} TrueToken */

/** @typedef {{readonly kind: 'false'}} FalseToken */

/** @typedef {{readonly kind: 'null'}} NullToken */

/** @typedef {{readonly kind: 'error', message: ErrorMessage}} ErrorToken */

/** 
 * @typedef {|
 * LeftBraceToken |
 * RightBraceToken |
 * ColonToken |
 * CommaToken |
 * LeftBracketToken |
 * RightBracketToken |
 * StringToken |
 * NumberToken |
 * TrueToken |
 * FalseToken |
 * NullToken |
 * ErrorToken
 * } JsonToken
 */

const leftBrace = 0x7b;
const rightBrace = 0x7d;
const colon = 0x3a;
const comma = 0x2c;
const leftBracket = 0x5b;
const rightBracket = 0x5d;

const quotationMark = 0x22;
const digit0 = 0x30;
const digit1 = 0x31;
const digit2 = 0x32;
const digit3 = 0x33;
const digit4 = 0x34;
const digit5 = 0x35;
const digit6 = 0x36;
const digit7 = 0x37;
const digit8 = 0x38;
const digit9 = 0x39;
const signPlus = 0x2b;
const signMinus = 0x2d;
const decimalPoint = 0x2e;

const horizontalTab = 0x09;
const newLine = 0x0a;
const carriageReturn = 0x0d;
const space = 0x20;

const backslach = 0x5c;
const slash = 0x2f;
const backspace = 0x08;
const formfeed = 0x0c;

const capitalLetterA = 0x41;
const capitalLetterF = 0x46;

const letterA = 0x61;
const letterB = 0x62;
const letterF = 0x66;
const letterN = 0x6e;
const letterR = 0x72;
const letterT = 0x74;
const letterU = 0x75;
const letterZ = 0x7a;

/** @type {LeftBraceToken} */
const leftBraceToken = {kind: '{'}

/** @type {RightBraceToken} */
const rightBraceToken = {kind: '}'}

/** @type {ColonToken} */
const colonToken = {kind: ':'}

/** @type {CommaToken} */
const commaToken = {kind: ','}

/** @type {LeftBracketToken} */
const leftBracketToken = {kind: '['}

/** @type {RightBracketToken} */
const rightBracketToken = {kind: ']'}

/** 
 * @typedef {|
 * InitialState |
 * ParseKeywordState |
 * ParseStringState |
 * ParseEscapeCharState |
 * ParseUnicodeCharState |
 * ParseNegativeNumberState |
 * ParseIntegerState |
 * ParseZeroState |
 * ParseFloatState |
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

/** @typedef {{ readonly kind: 'negative', readonly value: string}} ParseNegativeNumberState */

/** @typedef {{ readonly kind: 'integer', readonly value: string}} ParseIntegerState */

/** @typedef {{ readonly kind: 'zero', readonly value: string}} ParseZeroState */

/** @typedef {{ readonly kind: 'float', readonly value: string}} ParseFloatState */

/** @typedef {{ readonly kind: 'invalidNumber'}} InvalidNumberState */

/** @typedef {{ readonly kind: 'eof'}} EofState */

/** @typedef {number|undefined} JsonCharacter */

/** @type {(old: string) => (input: JsonCharacter) => string} */
const appendChar = old => input => input === undefined ? old : operator.concat(old)(charToString(input))

/** @type {(input: JsonCharacter) => string} */
const charToString = input => input === undefined ? '' : list.fromCharCodes([input])

/** @type {(state: InitialState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const initialStateOp = initialState => input => 
{
    if (input === undefined)
    {
        return[undefined, {kind: 'eof'}]
    }
    else if (input >= digit1 && input <= digit9)
    {
        return [undefined, { kind: 'integer', value: charToString(input)}]
    }
    else if (input >= letterA && input <= letterZ)
    {
        return [undefined, { kind: 'keyword', value: charToString(input)}]
    }
    else
    {
        switch(input)
        {
            case leftBrace: return [[leftBraceToken], initialState]
            case rightBrace: return [[rightBraceToken], initialState]
            case colon: return [[colonToken], initialState]
            case comma: return [[commaToken], initialState]
            case leftBracket: return [[leftBracketToken], initialState]
            case rightBracket: return [[rightBracketToken], initialState]
            case quotationMark: return[undefined, {kind: 'string', value: ''}]
            case digit0: return [undefined, { kind: 'zero', value: charToString(input)}]
            case signMinus: return [undefined, { kind: 'negative', value: charToString(input)}]
            case horizontalTab:
            case newLine:
            case carriageReturn:
            case space: return[undefined, initialState]
            default: return [[{kind: 'error', message: 'unexpected character'}], initialState]
        }
    }
}

/** @type {(state: ParseNegativeNumberState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseNegativeNumberStateOp = state => input =>
{
     return todo()
}

/** @type {(state: ParseZeroState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseZeroStateOp = state => input =>
{
    if (input === undefined)
    {
        return [[{kind: 'number', value: state.value}], {kind: 'eof'}]
    }
    else if (input === decimalPoint)
    {
        return [undefined, {kind: 'float', value: state.value}]
    }
    else if (isTerminalForNumber(input))
    {
        const next = tokenizeOp({kind: 'initial'})(input)
        return [{first: {kind: 'number', value: state.value}, tail: next[0]}, next[1]]
    }
    else
    {
        return tokenizeOp({kind: 'invalidNumber'})(input)
    }
}

/** @type {(state: ParseIntegerState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseIntegerStateOp = state => input =>
{
    if (input === undefined)
    {
        return [[{kind: 'number', value: state.value}], {kind: 'eof'}]
    }
    else if (input === decimalPoint)
    {
        return [undefined, {kind: 'float', value: state.value}]
    }
    else if (input >= digit0 && input <= digit9)
    {
        return [undefined, {kind:'integer', value: appendChar(state.value)(input)}]
    }
    else if (isTerminalForNumber(input))
    {
        const next = tokenizeOp({kind: 'initial'})(input)
        return [{first: {kind: 'number', value: state.value}, tail: next[0]}, next[1]]
    }
    else 
    {
        return tokenizeOp({kind: 'invalidNumber'})(input)
    } 
}

/** @type {(state: ParseFloatState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseFloatStateOp = state => input =>
{
    return todo()
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

/** @type {(state: InvalidNumberState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const invalidNumberStateOp = state => input =>
{
    if (input === undefined)
    {
        return [[{kind: 'error', message: 'invalid number'}], {kind: 'eof'}]
    }
    else if (isTerminalForNumber(input)) 
    {
        const next = tokenizeOp({kind: 'initial'})(input)
        return [{first: {kind: 'error', message: 'invalid number'}, tail: next[0]}, next[1]]
    }
    else
    {
        return [undefined, {kind: 'invalidNumber'}]
    }
}

/** @type {(state: ParseStringState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseStringStateOp = state => input =>
{
    switch(input)
    {
        case quotationMark: return[[{kind: 'string', value: state.value}], {kind: 'initial'}]
        case backslach: return [undefined, {kind:'escapeChar', value: state.value}]
        case undefined: return [[{kind: 'error', message: '" are missing'}], {kind: 'eof'}]
        default: return [undefined, {kind:'string', value: appendChar(state.value)(input)}]
    }
}

/** @type {(state: ParseEscapeCharState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
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
        case undefined: return [[{kind: 'error', message: '" are missing'}], {kind: 'eof'}]
        default: {
            const next = tokenizeOp({kind: 'string', value: state.value})(input)
            return [{first: {kind: 'error', message: 'unescaped character'}, tail: next[0]}, next[1]]
        }
    }
}

/** @type {(hex: number) => number|undefined} */
const hexDigitToNumber = hex =>
{
    if (hex >= digit0 && hex <= digit9) return hex - digit0;
    else if (hex >= capitalLetterA && hex <= capitalLetterF) return hex - capitalLetterA + 10;
    else if (hex >= letterA && hex <= letterF) return hex - letterA + 10;
}

/** @type {(state: ParseUnicodeCharState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseUnicodeCharStateOp = state => input =>
{
    if (input === undefined)
    {
        return [[{kind: 'error', message: '" are missing'}], {kind: 'eof'}]
    } 
    else
    {
        const hexValue = hexDigitToNumber(input)
        if (hexValue === undefined)
        {
            const next = tokenizeOp({kind: 'string', value: state.value})(input)
            return [{first: {kind: 'error', message: 'invalid hex value'}, tail: next[0]}, next[1]]
        } 
        else
        {
            const newUnicode = state.unicode | (hexValue << (3 - state.hexIndex) * 4)
            return [undefined, state.hexIndex == 3 ?
                {kind: 'string', value: appendChar(state.value)(newUnicode)} :
                {kind: 'unicodeChar', value: state.value, unicode: newUnicode, hexIndex: state.hexIndex + 1}]
        }
    }
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

/** @type {(state: ParseKeywordState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const parseKeyWordStateOp = state => input => 
{
    if (input === undefined)
    {
        const keyWordToken = stringToKeywordToken(state.value)
        return [[keyWordToken], {kind: 'eof'}]
    }
    else if (input >= letterA && input <= letterZ)
    {
        return [undefined, {kind: 'keyword', value: appendChar(state.value)(input)}]
    }
    else 
    {
        const keyWordToken = stringToKeywordToken(state.value)
        const next = tokenizeOp({kind: 'initial'})(input)
        return [{first: keyWordToken, tail: next[0]}, next[1]]
    }
}

/** @type {(state: EofState) => (input: JsonCharacter) => readonly[list.List<JsonToken>, TokenizerState]} */
const eofStateOp = state => input => [[{kind: 'error', message: 'eof'}], state]

/** @type {operator.StateScan<JsonCharacter, TokenizerState, list.List<JsonToken>>} */
const tokenizeOp = state => input =>
{
    switch(state.kind)
    {
        case 'initial': return initialStateOp(state)(input)
        case 'keyword': return parseKeyWordStateOp(state)(input)
        case 'string': return parseStringStateOp(state)(input)
        case 'escapeChar': return parseEscapeCharStateOp(state)(input)
        case 'unicodeChar': return parseUnicodeCharStateOp(state)(input)
        case 'negative': return parseNegativeNumberStateOp(state)(input)
        case 'integer': return parseIntegerStateOp(state)(input)
        case 'zero': return parseZeroStateOp(state)(input)
        case 'float': return parseFloatStateOp(state)(input)
        case 'invalidNumber': return invalidNumberStateOp(state)(input)
        case 'eof': return eofStateOp(state)(input)
    }
}

/** @type {(input: list.List<JsonCharacter>) => list.List<JsonToken>} */
const tokenize = input => list.flat(list.stateScan(tokenizeOp)({kind: 'initial'})(input))

module.exports = {
    /** @readonly */
    tokenize,
}
