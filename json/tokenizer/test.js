const tokenizer = require('.')
const list = require('../../types/list')
const json = require('..')
const { sort } = require('../../types/object')

/** @type {(s: string) => list.List<tokenizer.JsonCharacter>} */
const toCharacters = s =>
{
    /** @type {list.List<tokenizer.JsonCharacter>} */   
    const charCodes = list.toCharCodes(s)
    return list.concat(charCodes)([undefined])
}

/** @type {(value: tokenizer.JsonToken) => boolean} */
const definedTokenPredicate = token =>token !== undefined 

/** @type {(s: string) => readonly tokenizer.JsonToken[]} */
const tokenizeString = s =>
{   
    const characters = toCharacters(s)
    const tokens = tokenizer.tokenize(characters)
    return list.toArray(tokenizer.tokenize(characters))
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
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'error') { throw result }
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
    const result = tokenizeString('tru')
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
    if (result[0].value !== '') { throw result }
}

{
    const result = tokenizeString('"value"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
    if (result[0].value !== 'value') { throw result }
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
    const result = tokenizeString('"\\u1234"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
    if (result[0].value !== 'ሴ') { throw result }
}

{
    const result = tokenizeString('"\\uaBcDEeFf"')
    if (result.length !== 1){ throw result }
    if (result[0]?.kind !== 'string') { throw result }
    if (result[0].value !== 'ꯍEeFf') { throw result }
}

{
    const result = tokenizeString('"\\uEeFg"')
    if (result.length === 0){ throw result }
    if (result[0]?.kind !== 'error') { throw result }
}