const tokenizer = require('.')
const list = require('../../types/list')
const json = require('..')

/** @type {(s: string) => list.List<tokenizer.JsonCharacter>} */
const toCharacters = s =>
{
    /** @type {list.List<tokenizer.JsonCharacter>} */   
    const charCodes = list.toCharCodes(s)
    return list.concat(charCodes)([undefined])
} 

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
    if (result[0].kind !== '{') { throw result }
}

{
    const result = tokenizeString('}')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== '}') { throw result }
}

{
    const result = tokenizeString(':')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== ':') { throw result }
}

{
    const result = tokenizeString(',')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== ',') { throw result }
}

{
    const result = tokenizeString('[')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== '[') { throw result }
}

{
    const result = tokenizeString(']')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== ']') { throw result }
}

{
    const result = tokenizeString('ᄑ')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'unexpected character') { throw result }
}

{
    const result = tokenizeString('err')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid keyword') { throw result }
}

{
    const result = tokenizeString('{e}')
    if (result.length !== 3){ throw result }
    if (result[0].kind !== '{') { throw result }
    if (result[1].kind !== 'error') { throw result }
    if (result[1].message !== 'invalid keyword') { throw result }
    if (result[2].kind !== '}') { throw result }
}

{
    const result = tokenizeString('{ \t\n\r}')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== '{') { throw result }
    if (result[1].kind !== '}') { throw result }
}

{
    const result = tokenizeString('true')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'true') { throw result }
}

{
    const result = tokenizeString('tru')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid keyword') { throw result }
}

{
    const result = tokenizeString('false')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'false') { throw result }
}

{
    const result = tokenizeString('null')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'null') { throw result }
}

{
    const result = tokenizeString('[null]')
    if (result.length !== 3){ throw result }
    if (result[0].kind !== '[') { throw result }
    if (result[1].kind !== 'null') { throw result }
    if (result[2].kind !== ']') { throw result }
}

{
    const result = tokenizeString('""')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
    if (result[0].value !== '') { throw result }
}

{
    const result = tokenizeString('"value"')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
    if (result[0].value !== 'value') { throw result }
}

{
    const result = tokenizeString('"value')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== '" are missing') { throw result }
}

{
    const result = tokenizeString('"value1" "value2"')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== 'string') { throw result }
    if (result[1].kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== '" are missing') { throw result }
}

{
    const result = tokenizeString('"\\\\"')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"\\""')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"\\/"')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"\\x"')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'unescaped character') { throw result }
    if (result[1].kind !== 'string') { throw result }
    if (result[1].value !== 'x') { throw result }
}

{
    const result = tokenizeString('"\\')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== '" are missing') { throw result }
}

{
    const result = tokenizeString('"\\b\\f\\n\\r\\t"')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
}

{
    const result = tokenizeString('"\\u1234"')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
    if (result[0].value !== 'ሴ') { throw result }
}

{
    const result = tokenizeString('"\\uaBcDEeFf"')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'string') { throw result }
    if (result[0].value !== 'ꯍEeFf') { throw result }
}

{
    const result = tokenizeString('"\\uEeFg"')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid hex value') { throw result }
    if (result[1].kind !== 'string') { throw result }
    if (result[1].value !== 'g') { throw result }
}

{
    const result = tokenizeString('0')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '0') { throw result }
}

{
    const result = tokenizeString('[0]')
    if (result.length !== 3){ throw result }
    if (result[0].kind !== '[') { throw result }
    if (result[1].kind !== 'number') { throw result }
    if (result[1].value !== '0') { throw result }
    if (result[2].kind !== ']') { throw result }
}

{
    const result = tokenizeString('00')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}

{
    const result = tokenizeString('0abc,')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
    if (result[1].kind !== ',') { throw result }
}

{
    const result = tokenizeString('1234567890')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '1234567890') { throw result }
}

{
    const result = tokenizeString('{90}')
    if (result.length !== 3){ throw result }
    if (result[0].kind !== '{') { throw result }
    if (result[1].kind !== 'number') { throw result }
    if (result[1].value !== '90') { throw result }
    if (result[2].kind !== '}') { throw result }
}

{
    const result = tokenizeString('10-0')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}

{
    const result = tokenizeString('9e:')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
    if (result[1].kind !== ':') { throw result }
}

{
    const result = tokenizeString('-10')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '-10') { throw result }
}

{
    const result = tokenizeString('-0')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '-0') { throw result }
}

{
    const result = tokenizeString('-00')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}