const list = require('../../types/list/module.f.cjs')
const fjsonTokenizer = require('../../js/tokenizer/module.f.cjs')

/**
 * @typedef {|
* fjsonTokenizer.SimpleToken |
* fjsonTokenizer.StringToken |
* fjsonTokenizer.NumberToken |
* fjsonTokenizer.ErrorToken
* } JsonToken
*/

/** @type {(input: fjsonTokenizer.FjsonToken) => JsonToken} */
const mapToken = input =>
{
    switch(input.kind)
    {
        case "{":
        case "}":
        case ":":
        case ",":
        case "[":
        case "]":
        case "true":
        case "false":
        case "null":
        case "string":
        case "number":
        case "error": return input
        default: return { kind: "error", message: "invalid token" }
    }
}

/** @type {(input: list.List<number>) => list.List<JsonToken>} */
const tokenize = input => list.map(mapToken)(fjsonTokenizer.tokenize(input))

module.exports = {
    /** @readonly */
    tokenize
}
