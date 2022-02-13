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

/** @type {(s: string) => readonly tokenizer.JsonToken[]} */
const tokenizeString = s =>
{   
    const characters = toCharacters(s)
    return list.toArray(tokenizer.tokenize(characters))
}

/** @type {(a: readonly tokenizer.JsonToken[]) => string} */
const stringify = a => json.stringify(sort)(a)

{
    const result = tokenizeString('')
    if (result.length !== 0) { throw result }
}

{
    const result = stringify(tokenizeString('{'))
    if (result !== '[{"kind":"{"}]') { throw result }
}

{
    const result = stringify(tokenizeString('}'))
    if (result !== '[{"kind":"}"}]') { throw result }
}

{
    const result = stringify(tokenizeString(':'))
    if (result !== '[{"kind":":"}]') { throw result }
}

{
    const result = stringify(tokenizeString(','))
    if (result !== '[{"kind":","}]') { throw result }
}

{
    const result = stringify(tokenizeString('['))
    if (result !== '[{"kind":"["}]') { throw result }
}

{
    const result = stringify(tokenizeString(']'))
    if (result !== '[{"kind":"]"}]') { throw result }
}

{
    const result = stringify(tokenizeString('ᄑ'))
    if (result !== '[{"kind":"error","message":"unexpected character"}]') { throw result }
}

{
    const result = stringify(tokenizeString('err'))
    if (result !== '[{"kind":"error","message":"invalid keyword"}]') { throw result }
}

{
    const result = stringify(tokenizeString('{e}'))
    if (result !== '[{"kind":"{"},{"kind":"error","message":"invalid keyword"},{"kind":"}"}]') { throw result }
}

{
    const result = stringify(tokenizeString('{ \t\n\r}'))
    if (result !== '[{"kind":"{"},{"kind":"}"}]') { throw result }
}

{
    const result = stringify(tokenizeString('true'))
    if (result !== '[{"kind":"true"}]') { throw result }
}

{
    const result = stringify(tokenizeString('tru'))
    if (result !== '[{"kind":"error","message":"invalid keyword"}]') { throw result }
}

{
    const result = stringify(tokenizeString('false'))
    if (result !== '[{"kind":"false"}]') { throw result }
}

{
    const result = stringify(tokenizeString('null'))
    if (result !== '[{"kind":"null"}]') { throw result }
}

{
    const result = stringify(tokenizeString('[null]'))
    if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"}]') { throw result }
}

{
    const result = stringify(tokenizeString('""'))
    if (result !== '[{"kind":"string","value":""}]') { throw result }
}

{
    const result = stringify(tokenizeString('"value"'))
    if (result !== '[{"kind":"string","value":"value"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"value'))
    if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"value1" "value2"'))
    if (result !== '[{"kind":"string","value":"value1"},{"kind":"string","value":"value2"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"'))
    if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\\\"'))
    if (result !== '[{"kind":"string","value":"\\\\"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\""'))
    if (result !== '[{"kind":"string","value":"\\""}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\/"'))
    if (result !== '[{"kind":"string","value":"/"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\x"'))
    if (result !== '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"x"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\'))
    if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\b\\f\\n\\r\\t"'))
    if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\u1234"'))
    if (result !== '[{"kind":"string","value":"ሴ"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\uaBcDEeFf"'))
    if (result !== '[{"kind":"string","value":"ꯍEeFf"}]') { throw result }
}

{
    const result = stringify(tokenizeString('"\\uEeFg"'))
    if (result !== '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"g"}]') { throw result }
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
    const result = tokenizeString('9a:')
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

{
    const result = tokenizeString('-.123')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}

{
    const result = tokenizeString('0.01')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '0.01') { throw result }
}

{
    const result = tokenizeString('-0.9')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '-0.9') { throw result }
}

{
    const result = tokenizeString('-0.')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}

{
    const result = tokenizeString('-0.]')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
    if (result[1].kind !== ']') { throw result }
}

{
    const result = tokenizeString('12.34')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '12.34') { throw result }
}

{
    const result = tokenizeString('-12.00')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '-12.00') { throw result }
}

{
    const result = tokenizeString('12.')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}

{
    const result = tokenizeString('12.]')
    if (result.length !== 2){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
    if (result[1].kind !== ']') { throw result }
}

{
    const result = tokenizeString('0e1')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '0e1') { throw result }
}

{
    const result = tokenizeString('0e+2')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '0e+2') { throw result }
}

{
    const result = tokenizeString('0e-0')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'number') { throw result }
    if (result[0].value !== '0e-0') { throw result }
}

{
    const result = tokenizeString('0e')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}

{
    const result = tokenizeString('0e-')
    if (result.length !== 1){ throw result }
    if (result[0].kind !== 'error') { throw result }
    if (result[0].message !== 'invalid number') { throw result }
}