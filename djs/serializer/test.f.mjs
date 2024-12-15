import * as parser from '../parser/module.f.mjs'
import * as tokenizer from '../tokenizer/module.f.mjs'
import * as list from '../../types/list/module.f.mjs'
const { toArray } = list
import * as djsSerializer from './module.f.mjs'
const { djsConstStringify } = djsSerializer
import * as o from '../../types/object/module.f.mjs'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.mjs'

/** @type {(s: string) => readonly tokenizer.DjsToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringifyDjsConst = djsConstStringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            if (obj[1][1].length !== 1) { throw obj }
            const result = stringifyDjsConst(obj[1][1][0])
            if (result !== 'null') { throw result }
        },
        // () => {
        //     const tokenList = tokenizeString('export default true')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[true]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default false')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[false]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default undefined')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[undefined]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default 0.1')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[0.1]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default 1.1e+2')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[110]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default "abc"')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],["abc"]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default []')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default [1]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[1]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default [[]]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[["array",[]]]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default [0,[1,[2,[]]],3]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[0,["array",[1,["array",[2,["array",[]]]]]],3]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default {}')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[{}]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default [{}]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[{}]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined}')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[{"a":true,"b":false,"c":null,"d":undefined}]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}}')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[{"a":{"b":{"c":["array",["d"]]}}}]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default 1234567890n')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[1234567890n]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('export default [1234567890n]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[1234567890n]]]]]') { throw result }
        // }
    ],
    validWhiteSpaces:[
        // () => {
        //     const tokenList = tokenizeString(' export default [ 0 , 1 , 2 ] ')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[0,1,2]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[{"a":0,"b":1}]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[["array",[0,1,2]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[{"a":0,"b":1}]]]') { throw result }
        // },
    ],
    validModule:[
        // () => {
        //     const tokenList = tokenizeString('export default null')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[null]]]') { throw result }
        // },
    ],    
    validWithConst:[
        // () => {
        //     const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default 3')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[1,2,3]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default b')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[1,2,["cref",1]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default [b,a,b]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[1,2,["array",[["cref",1],["cref",0],["cref",1]]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default {"1st":b,"2nd":a,"3rd":b}')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[1,2,{"1st":["cref",1],"2nd":["cref",0],"3rd":["cref",1]}]]]') { throw result }
        // },
    ],    
    validWithArgs:[
        // () => {
        //     const tokenList = tokenizeString('import a from "test/test.f.mjs" \n export default a')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[["test/test.f.mjs"],[["aref",0]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import b from "second/test.f.mjs" \n export default [b, a, b]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[["first/test.f.mjs","second/test.f.mjs"],[["array",[["aref",1],["aref",0],["aref",1]]]]]]') { throw result }
        // },
        // () => {
        //     const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const b = null \n export default [b, a, b]')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[["test/test.f.mjs"],[null,["array",[["cref",0],["aref",0],["cref",0]]]]]]') { throw result }
        // },
    ],    
    comments: [
        // () => {
        //     const tokenList = tokenizeString('export //comment \n default /* comment */ null //comment')
        //     const obj = parser.parse(tokenList)
        //     const result = stringify(obj)
        //     if (result !== '["ok",[[],[null]]]') { throw result }
        // },
    ]
}