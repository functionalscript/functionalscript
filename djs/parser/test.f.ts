import * as parser from './module.f.ts'
import * as tokenizer from '../tokenizer/module.f.mjs'
import * as list from '../../types/list/module.f.mjs'
const { toArray } = list
import * as djs from '../module.f.ts'
import * as o from '../../types/object/module.f.mjs'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.mjs'

const tokenizeString
    : (s: string) => readonly tokenizer.DjsToken[]
    = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = djs.stringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[null]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default true')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[true]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default false')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[false]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default undefined')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[undefined]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 0.1')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[0.1]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[110]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default "abc"')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],["abc"]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default []')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[1]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [[]]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[["array",[]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[0,["array",[1,["array",[2,["array",[]]]]]],3]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[{}]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[{}]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[{"a":true,"b":false,"c":null,"d":undefined}]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[{"a":{"b":{"c":["array",["d"]]}}}]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[1234567890n]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[1234567890n]]]]]') { throw result }
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
            const tokenList = tokenizeString(' export default [ 0 , 1 , 2 ] ')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[0,1,2]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[{"a":0,"b":1}]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[["array",[0,1,2]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[{"a":0,"b":1}]]]') { throw result }
        },
    ],
    validModule:[
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[null]]]') { throw result }
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
    ],
    validWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default 3')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[1,2,3]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default b')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[1,2,["cref",1]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default [b,a,b]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[1,2,["array",[["cref",1],["cref",0],["cref",1]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default {"1st":b,"2nd":a,"3rd":b}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[1,2,{"1st":["cref",1],"2nd":["cref",0],"3rd":["cref",1]}]]]') { throw result }
        },
    ],
    invalidWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 const b = 2 export default 3')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const = 1 \n const b = 2 \n export default 3')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const a = 2 \n export default 3')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","duplicate id"]') { throw result }
        },
    ],
    validWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n export default a')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[["test/test.f.mjs"],[["aref",0]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import b from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[["first/test.f.mjs","second/test.f.mjs"],[["array",[["aref",1],["aref",0],["aref",1]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const b = null \n export default [b, a, b]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[["test/test.f.mjs"],[null,["array",[["cref",0],["aref",0],["cref",0]]]]]]') { throw result }
        },
    ],
    invalidWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" export default a')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from \n export default a')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a "test/test.f.mjs" \n export default a')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import from "test/test.f.mjs" \n export default a')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import a from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","duplicate id"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const a = null \n export default null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","duplicate id"]') { throw result }
        },
    ],
    comments: [
        () => {
            const tokenList = tokenizeString('export //comment \n default /* comment */ null //comment')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[],[null]]]') { throw result }
        },
    ]
}
