import parser from './module.f.mjs'
import tokenizer, * as tokenizerT from '../tokenizer/module.f.mjs'
import list from '../../types/list/module.f.mjs'
const { toArray } = list
import djs from '../module.f.mjs'
import o from '../../types/object/module.f.mjs'
const { sort } = o
import encoding from '../../text/utf16/module.f.mjs'

/** @type {(s: string) => readonly tokenizerT.DjsToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = djs.stringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",null]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default true')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",true]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default false')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",false]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 0.1')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",0.1]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",110]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default "abc"')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok","abc"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default []')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[1]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [[]]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[0,[1,[2,[]]],3]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":true,"b":false,"c":null}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":{"b":{"c":["d"]}}}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",1234567890n]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[1234567890n]]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('export default')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default "123')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [,]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1 2]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1,,2]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default []]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default ["a"')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1,]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [,1]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [:]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default ]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {,}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {1:2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"1"2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"1"::2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2,,"3":4')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {}}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2,}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {,"1":2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default }')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{]}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {[}]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 10-5')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
    ],
    validWhiteSpaces:[
        () => {
            const tokenList = tokenizeString('export default [ 0 , 1 , 2 ]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[0,1,2]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default { "a" : 0 , "b" : 1 }')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":0,"b":1}]') { throw result }
        },
    ],
    validModule:[
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",null]') { throw result }
        },
    ],
    invalidModule:[
        () => {
            const tokenList = tokenizeString('null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module=null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default = null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
    ]
}