const { todo } = require('../../dev')
const operator = require('../../types/function/operator')
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
 * readonly chars: list.List<number>
 * }} StringToken 
 * */

/** 
 * @typedef {{
 * readonly kind: 'number'
 * readonly value: number
 * }} NumberToken 
 * */

/** @typedef {{readonly kind: 'true'}} TrueToken */

/** @typedef {{readonly kind: 'false'}} FalseToken */

/** @typedef {{readonly kind: 'null'}} NullToken */

/** @typedef {{readonly kind: 'error'}} ErrorToken */

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
 * ErrorToken |
 * undefined
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
const letterE = 0x65;
const letterF = 0x66;
const letterL = 0x6c;
const letterN = 0x6e;
const letterR = 0x72;
const letterS = 0x73;
const letterT = 0x74;
const letterU = 0x75;

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

/** @typedef {(input: JsonCharacter) => readonly[JsonToken, TokenizerState]} TokenizerState */

/** @typedef {number|undefined} JsonCharacter */

/**
 *  @typedef {{
 * readonly pattern: number[]
 * readonly success: JsonToken
 * }} ParseWordContext
 */

/**
 *  @typedef {{
 * readonly chars: list.List<number>
 * }} ParseStringContext
 */

/** @type {TokenizerState} */
const initialState = input => 
{
    switch(input)
    {
        case leftBrace: return [leftBraceToken, initialState]
        case rightBrace: return [rightBraceToken, initialState]
        case colon: return [colonToken, initialState]
        case comma: return [commaToken, initialState]
        case leftBracket: return [leftBracketToken, initialState]
        case rightBracket: return [rightBracketToken, initialState]
        case letterT: return [undefined, parseTrueState]
        case letterF: return [undefined, parseFalseState]
        case letterN: return [undefined, parseNullState]
        case quotationMark: return[undefined, parseStringState({chars:[]})]
        case digit0: return todo()
        case digit1: 
        case digit2:
        case digit3:
        case digit4:
        case digit5:
        case digit6:
        case digit7:
        case digit8:
        case digit9: return todo()
        case signPlus:
        case signMinus: return todo()
        case horizontalTab:
        case newLine:
        case carriageReturn:
        case space: return[undefined, initialState]
        case undefined: return[undefined, eofState]
        default: return [{kind: 'error'}, initialState]
    }
}

/** @type {(context: ParseStringContext) => (input: JsonCharacter) => readonly[JsonToken, TokenizerState]} */
const parseStringState = context => input =>
{
    switch(input)
    {
        case quotationMark: return[{kind: 'string', chars: context.chars}, initialState]
        case backslach: return [undefined, parseEscapeCharState(context)]
        case undefined: return [{kind: 'error'}, eofState]
        default: return [undefined, parseStringState({chars: list.concat(context.chars)([input])})]
    }
}

/** @type {(context: ParseStringContext) => (input: JsonCharacter) => readonly[JsonToken, TokenizerState]} */
const parseEscapeCharState = context => input =>
{
    switch(input)
    {
        case quotationMark:
        case backslach:
        case slash: return [undefined, parseStringState({chars: list.concat(context.chars)([input])})]
        case letterB: return [undefined, parseStringState({chars: list.concat(context.chars)([backspace])})]
        case letterF: return [undefined, parseStringState({chars: list.concat(context.chars)([formfeed])})]
        case letterN: return [undefined, parseStringState({chars: list.concat(context.chars)([newLine])})]
        case letterR: return [undefined, parseStringState({chars: list.concat(context.chars)([carriageReturn])})]
        case letterT: return [undefined, parseStringState({chars: list.concat(context.chars)([horizontalTab])})]
        case letterU: return [undefined, parseUnicodeCharState(context)(0)(0)]
        case undefined: return [{kind: 'error'}, eofState]
        default: return [{kind: 'error'}, initialState]
    }
}

/** @type {(hex: number) => number|undefined} */
const hexDigitToNumber = hex =>
{
    if (hex >= digit0 && hex <= digit9) return hex - digit0;
    else if (hex >= capitalLetterA && hex <= capitalLetterF) return hex - capitalLetterA + 10;
    else if (hex >= letterA && hex <= letterF) return hex - letterA + 10;
}

/** @type {(context: ParseStringContext) => (unicode: number) => (hexIndex: number) => (input: JsonCharacter) => readonly[JsonToken, TokenizerState]} */
const parseUnicodeCharState = context => unicode => hexIndex => input =>
{
    if (input === undefined)
    {
        return [{kind: 'error'}, eofState]
    } 
    else
    {
        const hexValue = hexDigitToNumber(input)
        if (hexValue === undefined)
        {
            return [{kind: 'error'}, initialState]
        } 
        else
        {
            const newUnicode = unicode | (hexValue << (3 - hexIndex) * 4)
            return [undefined, hexIndex == 3 ? 
                parseStringState({chars: list.concat(context.chars)([newUnicode])}) :
                parseUnicodeCharState(context)(newUnicode)(hexIndex + 1)]
        }
    }
}

/** @type {(context: ParseWordContext) => (index: number) => (input: JsonCharacter) => readonly[JsonToken, TokenizerState]} */
const parseWordState = context => index => input => 
{
    switch(input)
    {
        case context.pattern[index]: return index == context.pattern.length - 1 ? [context.success, initialState] : [undefined, parseWordState(context)(index + 1)]
        case undefined: return [{kind: 'error'}, eofState]
        default: return [{kind: 'error'}, initialState]
    }
}

/** @type {ParseWordContext} */
const parseTrueContext = { pattern: [ letterR, letterU, letterE], success: {kind: 'true'}}

/** @type {TokenizerState} */
const parseTrueState = parseWordState(parseTrueContext)(0)

/** @type {ParseWordContext} */
const parseFalseContext = { pattern: [ letterA, letterL, letterS, letterE], success: {kind: 'false'}}

/** @type {TokenizerState} */
const parseFalseState = parseWordState(parseFalseContext)(0)

/** @type {ParseWordContext} */
const parseNullContext = { pattern: [ letterU, letterL, letterL], success: {kind: 'null'}}

/** @type {TokenizerState} */
const parseNullState = parseWordState(parseNullContext)(0)

/** @type {TokenizerState} */
const eofState = input => [{kind: 'error'}, eofState]

/** @type {operator.StateScan<JsonCharacter, TokenizerState, JsonToken>} */
const tokenizeOp = state => input => state(input)

/** @type {(input: list.List<JsonCharacter>) => list.List<JsonToken>} */
const tokenize = input => list.stateScan(tokenizeOp)(initialState)(input)

module.exports = {
    /** @readonly */
    tokenize,
}
