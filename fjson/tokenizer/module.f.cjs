const list = require('../../types/list/module.f.cjs')
const jsTokenizer = require('../../js/tokenizer/module.f.cjs')

/**
 * @typedef {|
* jsTokenizer.SimpleToken |
* jsTokenizer.StringToken |
* jsTokenizer.NumberToken |
* jsTokenizer.ErrorToken |
* jsTokenizer.IdToken |
* jsTokenizer.BigIntToken
* } FjsonToken
*/

/** @type {(input: jsTokenizer.JsToken) => FjsonToken} */
const mapToken = input =>
{
    switch(input.kind)
    {
        case "id":
        case "bigint":
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

/** @type {(input: list.List<number>) => list.List<FjsonToken>} */
const tokenize = input => list.map(mapToken)(jsTokenizer.tokenize(input))

module.exports = {
    /** @readonly */
    tokenize
}