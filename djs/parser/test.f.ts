import * as parser from './module.f.ts'
import * as tokenizer from '../tokenizer/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import * as o from '../../types/object/module.f.ts'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.ts'
import * as djsSerializer from '../serializer/module.f.ts'
const { djsModuleStringify } = djsSerializer

const tokenizeString
    : (s: string) => readonly tokenizer.DjsToken[]
    = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringifyDjsModule = djsModuleStringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default null') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default true')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default true') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default false')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default false') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default undefined')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default undefined') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 0.1')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default 0.1') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default 110') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default "abc"')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default "abc"') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default []')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default []') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default [1]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [[]]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default [[]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default [0,[1,[2,[]]],3]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default {}') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default [{}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default {"a":true,"b":false,"c":null,"d":undefined}') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default {"a":{"b":{"c":["d"]}}}') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default 1234567890n') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default [1234567890n]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('export default')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected end') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default "123')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [,]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [1 2]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [1,,2]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default []]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default ["a"')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected end') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [1,]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [,1]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [:]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default ]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {,}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {1:2}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1"2}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1"::2}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2,,"3":4')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {}}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected end') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2,}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {,"1":2}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default }')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default [{]}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default {[}]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default 10-5')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
    ],
    validWhiteSpaces:[
        () => {
            const tokenList = tokenizeString(' export default [ 0 , 1 , 2 ] ')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default [0,1,2]') { throw result }
        },
        () => {
            const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default {"a":0,"b":1}') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default [0,1,2]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default {"a":0,"b":1}') { throw result }
        },
    ],
    invalidModule:[
        () => {
            const tokenList = tokenizeString('null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('module=null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('export default = null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
    ],
    validWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default 3')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'const c0 = 1\nconst c1 = 2\nexport default 3') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default b')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'const c0 = 1\nconst c1 = 2\nexport default c1') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default [b,a,b]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'const c0 = 1\nconst c1 = 2\nexport default [c1,c0,c1]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default {"1st":b,"2nd":a,"3rd":b}')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'const c0 = 1\nconst c1 = 2\nexport default {"1st":c1,"2nd":c0,"3rd":c1}') { throw result }
        },
    ],
    invalidWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 const b = 2 export default 3')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('const = 1 \n const b = 2 \n export default 3')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const a = 2 \n export default 3')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'duplicate id') { throw obj }
        },
    ],
    validWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n export default a')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'import a0 from "test/test.f.mjs"\nexport default a0') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import b from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'import a0 from "first/test.f.mjs"\nimport a1 from "second/test.f.mjs"\nexport default [a1,a0,a1]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const b = null \n export default [b, a, b]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'import a0 from "test/test.f.mjs"\nconst c0 = null\nexport default [c0,a0,c0]') { throw result }
        },
    ],
    invalidWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" export default a')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a from \n export default a')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a "test/test.f.mjs" \n export default a')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import from "test/test.f.mjs" \n export default a')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'unexpected token') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import a from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'duplicate id') { throw obj }
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const a = null \n export default null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'error') { throw obj }
            if (obj[1] !== 'duplicate id') { throw obj }
        },
    ],
    comments: [
        () => {
            const tokenList = tokenizeString('export //comment \n default /* comment */ null //comment')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default null') { throw result }
        },
    ]
}
