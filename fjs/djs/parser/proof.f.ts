import { parseFromTokens } from './module.f.ts'
import { tokenize, type DjsTokenWithMetadata } from '../tokenizer/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import { stringify } from '../../media/json/module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

const tokenizeString
    : (s: string) => readonly DjsTokenWithMetadata[]
    = s => toArray(tokenize(stringToList(s))(''))

const stringifyDjsModule = stringifyAsTree(sort)

export const proof = {
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[null]]')
        },
        () => {
            const tokenList = tokenizeString('export default true')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[true]]')
        },
        () => {
            const tokenList = tokenizeString('export default false')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[false]]')
        },
        () => {
            const tokenList = tokenizeString('export default undefined')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[undefined]]')
        },
        () => {
            const tokenList = tokenizeString('export default 0.1')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[0.1]]')
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[110]]')
        },
        () => {
            const tokenList = tokenizeString('export default "abc"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],["abc"]]')
        },
        () => {
            const tokenList = tokenizeString('export default []')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[1]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [[]]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[["array",[]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[0,["array",[1,["array",[2,["array",[]]]]]],3]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[{}]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":true,"b":false,"c":null,"d":undefined}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":{"b":{"c":["array",["d"]]}}}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {a: 1}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":1}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1234567890n]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[1234567890n]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1,]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[1]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {"a":1,}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":1}]]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('export default')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            const tokenList = tokenizeString('export default "123')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        // A literal control character inside a string is not valid JSON
        // syntax (RFC 8259 §7), and DJS string literals are JSON strings.
        () => {
            const tokenList = tokenizeString('export default "\t"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [,]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [1 2]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [1,,2]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default []]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default ["a"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            const tokenList = tokenizeString('export default [,1]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [:]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default ]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {,}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {1:2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1"2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1"::2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2,,"3":4')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {}}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            const tokenList = tokenizeString('export default {,"1":2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default }')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [{]}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {[}]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default 10-5')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
    ],
    errorMetadata: [
        () => {
            // column 17 is the ',' itself — the tokenizer's metadata is start-anchored
            // (each token's own position), unlike the previous tokenizer's metadata, which
            // lagged by one token (an artifact of when its state machine flushed a token).
            const tokenList = tokenizeString('export default [,]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            const errorString = stringify(sort)(obj[1])
            if (errorString !== '{"message":"unexpected token","metadata":{"column":17,"line":1,"path":""}}') { throw errorString }
        },
    ],
    validWhiteSpaces:[
        () => {
            const tokenList = tokenizeString(' export default [ 0 , 1 , 2 ] ')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[0,1,2]]]]')
        },
        () => {
            const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":0,"b":1}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[0,1,2]]]]')
        },
        () => {
            const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":0,"b":1}]]') { throw result }
        },
    ],
    validJson:[
        () => {
            const tokenList = tokenizeString('null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[null]]')
        },
        () => {
            const tokenList = tokenizeString('1')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1]]')
        },
        () => {
            const tokenList = tokenizeString('[]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[]]]]')
        },
        () => {
            const tokenList = tokenizeString('{"valid":"json"}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"valid":"json"}]]') { throw result }
        }
    ],
    invalidModule:[
        () => {
            const tokenList = tokenizeString('module=null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'const not found', obj)
        },
        () => {
            const tokenList = tokenizeString('export null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('export default = null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
    ],
    validWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,3]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default b')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["cref",1]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default [b,a,b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["array",[["cref",1],["cref",0],["cref",1]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default {"1st":b,"2nd":a,"3rd":b}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,{"1st":["cref",1],"2nd":["cref",0],"3rd":["cref",1]}]]') { throw result }
        },
    ],
    invalidWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 const b = 2 export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('const = 1 \n const b = 2 \n export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const a = 2 \n export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
    ],
    validWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[["test/test.f.mjs"],[["aref",0]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import b from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[["first/test.f.mjs","second/test.f.mjs"],[["array",[["aref",1],["aref",0],["aref",1]]]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const b = null \n export default [b, a, b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[["test/test.f.mjs"],[null,["array",[["cref",0],["aref",0],["cref",0]]]]]')
        },
    ],
    invalidWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import a from \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import a "test/test.f.mjs" \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import from "test/test.f.mjs" \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import a from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const a = null \n export default null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
    ],
    comments: [
        () => {
            const tokenList = tokenizeString('export //comment \n default /* comment */ null //comment')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[null]]')
        },
    ]
}
