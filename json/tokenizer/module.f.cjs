const list = require('../../types/list/module.f.cjs')
const jsTokenizer = require('../../js/tokenizer/module.f.cjs')

/**
 * @typedef {|
* jsTokenizer.SimpleToken |
* jsTokenizer.StringToken |
* jsTokenizer.NumberToken |
* jsTokenizer.ErrorToken
* } JsonToken
*/

/** @type {(input: jsTokenizer.JsToken) => JsonToken} */
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
const tokenize = input => list.map(mapToken)(jsTokenizer.tokenize(input))

module.exports = {
    /** @readonly */
    tokenize
}
