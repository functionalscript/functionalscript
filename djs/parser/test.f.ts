import * as parser from './module.f.ts'
import * as tokenizer from '../tokenizer/module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { toArray } = list
import { sort } from '../../types/object/module.f.ts'
import * as encoding from '../../text/utf16/module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import { stringify } from '../../json/module.f.ts'

const tokenizeString
    : (s: string) => readonly tokenizer.DjsTokenWithMetadata[]
    = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringifyDjsModule = stringifyAsTree(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[null]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default true')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[true]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default false')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[false]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default undefined')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[undefined]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 0.1')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[0.1]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[110]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default "abc"')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],["abc"]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default []')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[1]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [[]]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[["array",[]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[0,["array",[1,["array",[2,["array",[]]]]]],3]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[{}]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":true,"b":false,"c":null,"d":undefined}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":{"b":{"c":["array",["d"]]}}}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {a: 1}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":1}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1234567890n]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[1234567890n]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1,]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[1]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":1,}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":1}]]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('export default')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected end') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default "123')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [,]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [1 2]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [1,,2]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default []]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default ["a"')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected end') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [,1]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [:]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default ]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {,}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {1:2}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1"2}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1"::2}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2,,"3":4')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {}}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected end') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {,"1":2}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default }')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [{]}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {[}]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default 10-5')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
    ],
    errorMetadata: [
        () => {
            const tokenList = tokenizeString('export default [,]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            const errorString = stringify(sort)(obj[1])
            if (errorString !== '{"message":"unexpected token","metadata":{"column":17,"line":0,"path":""}}') { throw errorString }
        },
    ],
    validWhiteSpaces:[
        () => {
            const tokenList = tokenizeString(' export default [ 0 , 1 , 2 ] ')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[0,1,2]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":0,"b":1}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[0,1,2]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":0,"b":1}]]') { throw result }
        },
    ],
    validJson:[
        () => {
            const tokenList = tokenizeString('null')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[null]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('1')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"valid":"json"}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"valid":"json"}]]') { throw result }
        }
    ],
    invalidModule:[        
        () => {
            const tokenList = tokenizeString('module=null')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'const not found') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export null')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default = null')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
    ],
    validWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default 3')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,3]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default b')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,["cref",1]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default [b,a,b]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,["array",[["cref",1],["cref",0],["cref",1]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default {"1st":b,"2nd":a,"3rd":b}')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,{"1st":["cref",1],"2nd":["cref",0],"3rd":["cref",1]}]]') { throw result }
        },
    ],
    invalidWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 const b = 2 export default 3')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('const = 1 \n const b = 2 \n export default 3')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const a = 2 \n export default 3')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'duplicate id') { throw obj }
        },
    ],
    validWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n export default a')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[["test/test.f.mjs"],[["aref",0]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import b from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[["first/test.f.mjs","second/test.f.mjs"],[["array",[["aref",1],["aref",0],["aref",1]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const b = null \n export default [b, a, b]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[["test/test.f.mjs"],[null,["array",[["cref",0],["aref",0],["cref",0]]]]]') { throw result }
        },
    ],
    invalidWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" export default a')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a from \n export default a')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a "test/test.f.mjs" \n export default a')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import from "test/test.f.mjs" \n export default a')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import a from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'duplicate id') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const a = null \n export default null')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1].message !== 'duplicate id') { throw obj }
        },
    ],
    comments: [
        () => {
            const tokenList = tokenizeString('export //comment \n default /* comment */ null //comment')
            const obj = parser.parseFromTokens(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[null]]') { throw result }
        },
    ]
}
