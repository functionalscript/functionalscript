const tokenizer = require('.')
const list = require('../../types/list')
const json = require('..')
const { sort } = require('../../types/object')

/** @type {(a: number) => string} */
const toHexString = x => x.toString(16)

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

/** @type {(s: string) => list.List<tokenizer.JsonCharacter>} */
const toCharacters = s =>
{   
    let characters = [];
    for(var i = 0; i < s.length; i++) {
        var char = s.charCodeAt(i);
        characters.push(s.charCodeAt(i))
    }
    /** @type {list.List<tokenizer.JsonCharacter>} */
    const jsonCharacters = characters
    return list.concat(jsonCharacters)([undefined])
}

/** @type {(value: tokenizer.JsonToken) => boolean} */
const definedTokenPredicate = token =>token !== undefined 

/** @type {(s: string) => readonly tokenizer.JsonToken[]} */
const tokenizeString = s =>
{   
    const characters = toCharacters(s)
    const tokens = tokenizer.tokenize(characters)
    return list.toArray(list.filter(definedTokenPredicate)(tokenizer.tokenize(characters)))
}

{
    const result = tokenizeString('')
    if (result.length !== 0){ throw result }
}

{
    const result = tokenizeString('{')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== '{') { throw result }
}

{
    const result = tokenizeString('}')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== '}') { throw result }
}

{
    const result = tokenizeString(':')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== ':') { throw result }
}

{
    const result = tokenizeString(',')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== ',') { throw result }
}

{
    const result = tokenizeString('[')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== '[') { throw result }
}

{
    const result = tokenizeString(']')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== ']') { throw result }
}

{
    const result = tokenizeString('err')
    if (result.length !== 3){ throw result }
    if (result[0]?.kind !== 'error') { throw result }
    if (result[1]?.kind !== 'error') { throw result }
    if (result[2]?.kind !== 'error') { throw result }
}

{
    const result = tokenizeString('{e}')
    if (result.length !== 3){ throw result }
    if (result[0]?.kind !== '{') { throw result }
    if (result[1]?.kind !== 'error') { throw result }
    if (result[2]?.kind !== '}') { throw result }
}

{
    const result = tokenizeString('{ \t\n\r}')
    if (result.length !== 2){ throw result }
    if (result[0]?.kind !== '{') { throw result }
    if (result[1]?.kind !== '}') { throw result }
}

{
    const result = tokenizeString('true')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'true') { throw result }
}

{
    const result = tokenizeString('tru1')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'error') { throw result }
}

{
    const result = tokenizeString('false')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'false') { throw result }
}

{
    const result = tokenizeString('null')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'null') { throw result }
}

{
    const result = tokenizeString('[null]')
    if (result.length !== 3){ throw result }
    if (result[0]?.kind !== '[') { throw result }
    if (result[1]?.kind !== 'null') { throw result }
    if (result[2]?.kind !== ']') { throw result }
}

{
    const result = tokenizeString('""')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
    if (list.length(result[0].chars) !== 0) { throw result }
}

{
    const result = tokenizeString('"value"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
    if (list.length(result[0].chars) !== 5) { throw result }
}

{
    const result = tokenizeString('"value1" "value2"')
    if (result.length !== 2){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
    if (result[1]?.kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'error') { throw result }
}

{
    const result = tokenizeString('"\\\\"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"\\""')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"\\/"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"\\b\\f\\n\\r\\t"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
}

{
    const tokens = tokenizeString('"\\u1234"')
    if (tokens.length !== 1){ throw tokens }
    if (tokens[0]?.kind !== 'string') { throw tokens }
    const result = stringify(list.toArray(tokens[0].chars).map(toHexString))
    if (result !== '["1234"]') { throw result }
}

{
    const tokens = tokenizeString('"\\uaBcD"')
    if (tokens.length !== 1){ throw tokens }
    if (tokens[0]?.kind !== 'string') { throw tokens }
    const result = stringify(list.toArray(tokens[0].chars).map(toHexString))
    if (result !== '["abcd"]') { throw result }
}

{
    const tokens = tokenizeString('"\\uEeFfAaBb"')
    if (tokens.length !== 1){ throw tokens }
    if (tokens[0]?.kind !== 'string') { throw tokens }
    const result = stringify(list.toArray(tokens[0].chars).map(toHexString))
    if (result !== '["eeff","41","61","42","62"]') { throw result }
}

{
    const tokens = tokenizeString('"\\uEeFg"')
    if (tokens.length === 0){ throw tokens }
    if (tokens[0]?.kind !== 'error') { throw tokens }
}