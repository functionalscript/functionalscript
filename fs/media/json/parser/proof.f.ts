import { parse } from './module.f.ts'
import { tokenize, type JsonToken } from '../tokenizer/module.f.ts'
import { toArray } from '../../../types/list/module.f.ts'
import { stringify as jsonStringify } from '../module.f.ts'
import { sort } from '../../../types/object/module.f.ts'
import { stringToList } from '../../../text/utf16/module.f.ts'
import { assertEq } from '../../../asserts/module.f.ts'

const tokenizeString
    : (s: string) => readonly JsonToken[]
    = s => toArray(tokenize(stringToList(s)))

const stringify = jsonStringify(sort)

export const proof = {
    valid: [
        () => {
            const tokenList = tokenizeString('null')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",null]')
        },
        () => {
            const tokenList = tokenizeString('true')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",true]')
        },
        () => {
            const tokenList = tokenizeString('false')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",false]')
        },
        () => {
            const tokenList = tokenizeString('0.1')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",0.1]')
        },
        () => {
            const tokenList = tokenizeString('1.1e+2')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",110]')
        },
        () => {
            const tokenList = tokenizeString('"abc"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok","abc"]')
        },
        () => {
            const tokenList = tokenizeString('[]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[]]')
        },
        () => {
            const tokenList = tokenizeString('[1]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[1]]')
        },
        () => {
            const tokenList = tokenizeString('[[]]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[[]]]')
        },
        () => {
            const tokenList = tokenizeString('[0,[1,[2,[]]],3]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["ok",[0,[1,[2,[]]],3]]')
        },
        () => {
            const tokenList = tokenizeString('{}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[{}]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"a":true,"b":false,"c":null}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":true,"b":false,"c":null}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"a":{"b":{"c":["d"]}}}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":{"b":{"c":["d"]}}}]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected end"]')
        },
        // Trailing commas are not valid JSON — strict parser rejects them.
        () => {
            const tokenList = tokenizeString('[1,]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"a":1,}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('"123')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        // A literal control character inside a string is not valid JSON (RFC
        // 8259 §7) even though the shared tokenizer would otherwise accept it.
        () => {
            const tokenList = tokenizeString('"\t"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"a":"\t"}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[,]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[1 2]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[1,,2]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[]]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('["a"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected end"]')
        },
        () => {
            const tokenList = tokenizeString('[,1]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[:]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString(']')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{,}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{1:2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1"2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1"::2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1":2,,"3":4')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{}}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"1":2')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected end"]')
        },
        () => {
            const tokenList = tokenizeString('{,"1":2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{"a":1 "b":2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('[{]}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('{[}]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('10-5')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
        () => {
            const tokenList = tokenizeString('undefined')
            const obj = parse(tokenList)
            const result = stringify(obj)
            assertEq(result, '["error","unexpected token"]')
        },
    ]
}
