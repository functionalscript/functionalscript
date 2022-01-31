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
 * readonly value: string
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

/** @typedef {{readonly kind: ''}} ErrorToken */
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

/** @typedef {undefined} TokenizerState */

/** @typedef {number|undefined} JsonCharacter */

/** @type {operator.StateScan<JsonCharacter, TokenizerState, JsonToken>} */
const tokenizeOp = state => input => input === undefined ? tokenizeEof(state) : tokenizeUtfChar(state)(input)

/** @type {operator.StateScan<number, TokenizerState, JsonToken>} */
const tokenizeUtfChar = state => input => 
{
    return todo()
}

/** @type {(state: TokenizerState) => readonly[JsonToken, TokenizerState]} */
const tokenizeEof = state =>
{
    return todo()
}

/** @type {(input: list.List<JsonCharacter>) => list.List<JsonToken>} */
const tokenize = input => list.stateScan(tokenizeOp)(undefined)(input)

module.exports = {
    /** @readonly */
    tokenize,
}
