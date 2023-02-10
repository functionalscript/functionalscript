const tokenizer = require('./module.f.cjs')
const { toArray, countdown } = require('../../types/list/module.f.cjs')
const json = require('../module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const encoding = require('../../text/utf16/module.f.cjs');

/** @type {(s: string) => readonly tokenizer.JsonToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = json.stringify(sort)

module.exports = {
    testing: [
        () => {
            const result = tokenizeString('')
            if (result.length !== 0) { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{'))
            if (result !== '[{"kind":"{"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('}'))
            if (result !== '[{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(':'))
            if (result !== '[{"kind":":"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(','))
            if (result !== '[{"kind":","}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('['))
            if (result !== '[{"kind":"["}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(']'))
            if (result !== '[{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ᄑ'))
            if (result !== '[{"kind":"error","message":"unexpected character"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('err'))
            if (result !== '[{"kind":"error","message":"invalid keyword"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{e}'))
            if (result !== '[{"kind":"{"},{"kind":"error","message":"invalid keyword"},{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ \t\n\r}'))
            if (result !== '[{"kind":"{"},{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('true'))
            if (result !== '[{"kind":"true"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('tru'))
            if (result !== '[{"kind":"error","message":"invalid keyword"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('false'))
            if (result !== '[{"kind":"false"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('null'))
            if (result !== '[{"kind":"null"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[null]'))
            if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('""'))
            if (result !== '[{"kind":"string","value":""}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value"'))
            if (result !== '[{"kind":"string","value":"value"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value'))
            if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value1" "value2"'))
            if (result !== '[{"kind":"string","value":"value1"},{"kind":"string","value":"value2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"'))
            if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\\\"'))
            if (result !== '[{"kind":"string","value":"\\\\"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\""'))
            if (result !== '[{"kind":"string","value":"\\""}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\/"'))
            if (result !== '[{"kind":"string","value":"/"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\x"'))
            if (result !== '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"x"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\'))
            if (result !== '[{"kind":"error","message":"\\" are missing"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\b\\f\\n\\r\\t"'))
            if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\u1234"'))
            if (result !== '[{"kind":"string","value":"ሴ"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uaBcDEeFf"'))
            if (result !== '[{"kind":"string","value":"ꯍEeFf"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uEeFg"'))
            if (result !== '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"g"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0'))
            if (result !== '[{"e":0,"kind":"number","m":0,"value":"0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[0]'))
            if (result !== '[{"kind":"["},{"e":0,"kind":"number","m":0,"value":"0"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('00'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0abc,'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":","}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890'))
            if (result !== '[{"e":0,"kind":"number","m":1234567890,"value":"1234567890"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{90}'))
            if (result !== '[{"kind":"{"},{"e":0,"kind":"number","m":90,"value":"90"},{"kind":"}"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1 2'))
            if (result !== '[{"e":0,"kind":"number","m":1,"value":"1"},{"e":0,"kind":"number","m":2,"value":"2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0. 2'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"e":0,"kind":"number","m":2,"value":"2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('10-0'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('9a:'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":":"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-10'))
            if (result !== '[{"e":0,"kind":"number","m":-10,"value":"-10"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0'))
            if (result !== '[{"e":0,"kind":"number","m":0,"value":"-0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-00'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-.123'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0.01'))
            if (result !== '[{"e":-2,"kind":"number","m":1,"value":"0.01"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.9'))
            if (result !== '[{"e":-1,"kind":"number","m":-9,"value":"-0.9"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.]'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.34'))
            if (result !== '[{"e":-2,"kind":"number","m":1234,"value":"12.34"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.00'))
            if (result !== '[{"e":-2,"kind":"number","m":-1200,"value":"-12.00"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.]'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"]"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e1'))
            if (result !== '[{"e":1,"kind":"number","m":0,"value":"0e1"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e+2'))
            if (result !== '[{"e":2,"kind":"number","m":0,"value":"0e+2"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-0'))
            if (result !== '[{"e":0,"kind":"number","m":0,"value":"0e-0"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12e0000'))
            if (result !== '[{"e":0,"kind":"number","m":12,"value":"12e0000"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12e-0001'))
            if (result !== '[{"e":-1,"kind":"number","m":-12,"value":"-12e-0001"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.34e1234'))
            if (result !== '[{"e":1232,"kind":"number","m":-1234,"value":"-12.34e1234"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-'))
            if (result !== '[{"kind":"error","message":"invalid number"}]') { throw result }
        },
    ],
    stress: () => {
        const n = 10_000
        const list = countdown(n)
        const result = tokenizer.tokenize(list)
        //if (toArray(result).length !== 9929) { throw result }
    }
}