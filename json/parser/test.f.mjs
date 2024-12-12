import * as parser from './module.f.mjs'
import * as tokenizer from '../tokenizer/module.f.mjs'
import list from '../../types/list/module.f.mjs'
const { toArray } = list
import * as json from '../module.f.mjs'
import o from '../../types/object/module.f.mjs'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.mjs'

/** @type {(s: string) => readonly tokenizer.JsonToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = json.stringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",null]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('true')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",true]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('false')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",false]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('0.1')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",0.1]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('1.1e+2')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",110]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('"abc"')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok","abc"]') { throw result }
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
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('"123')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[,]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[1 2]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[1,,2]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[]]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('["a"')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[1,]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[,1]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[:]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString(']')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{,}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{1:2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1"2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1"::2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1":2,,"3":4')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{}}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1":2')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1":2,}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{,"1":2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[{]}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{[}]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('10-5')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
    ]
}