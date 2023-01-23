const parser = require('./module.f.cjs')
const tokenizer = require('../tokenizer/module.f.cjs')
const { toArray } = require('../../types/list/module.f.cjs')
const json = require('../module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const encoding = require('../../text/utf16/module.f.cjs');

/** @type {(s: string) => readonly tokenizer.JsonToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = json.stringify(sort)

module.exports = {
    testing: [
        () => {
            const tokenList = tokenizeString('')
            const result = parser.parse(tokenList)
            if (result[0] !== 'error') { throw result }
        },
        () => {
            const tokenList = tokenizeString('null')
            const result = parser.parse(tokenList)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== null) { throw result }
        },
        () => {
            const tokenList = tokenizeString('true')
            const result = parser.parse(tokenList)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== true) { throw result }
        },
        () => {
            const tokenList = tokenizeString('false')
            const result = parser.parse(tokenList)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== false) { throw result }
        },
        () => {
            const tokenList = tokenizeString('0.1')
            const result = parser.parse(tokenList)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 0.1) { throw result }
        },
        () => {
            const tokenList = tokenizeString('1.1e+2')
            const result = parser.parse(tokenList)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 110) { throw result }
        },
        () => {
            const tokenList = tokenizeString('"abc"')
            const result = parser.parse(tokenList)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 'abc') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[1]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[1]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[[]]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[0,[1,[2,[]]],3]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[0,[1,[2,[]]],3]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[{}]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"a":true,"b":false,"c":null}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":true,"b":false,"c":null}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"a":{"b":{"c":["d"]}}}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":{"b":{"c":["d"]}}}]') { throw result }
        },
    ]
}