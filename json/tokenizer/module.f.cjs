const list = require('../../types/list/module.f.cjs')
const { empty, flat, map } = list
const jsTokenizer = require('../../js/tokenizer/module.f.cjs')

/**
 * @typedef {|
* {readonly kind: 'true' | 'false' | 'null'} |
* {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
* jsTokenizer.StringToken |
* jsTokenizer.NumberToken |
* jsTokenizer.ErrorToken
* } JsonToken
*/

/** @type {(input: jsTokenizer.JsToken) => list.List<JsonToken>} */
const mapToken = input =>
{
    switch(input.kind)
    {
        case '{':
        case '}':
        case ':':
        case ',':
        case '[':
        case ']':
        case 'true':
        case 'false':
        case 'null':
        case 'string':
        case 'number':
        case 'error': return [input]
        case 'ws': return empty
        default: return [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: list.List<number>) => list.List<JsonToken>} */
const tokenize = input => flat(map(mapToken)(jsTokenizer.tokenize(input)))

module.exports = {
    /** @readonly */
    tokenize
}
