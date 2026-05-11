import { parse } from './module.f.ts'
import { tokenize, type JsonToken } from '../tokenizer/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { stringify as jsonStringify } from '../module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'

const tokenizeString
    : (s: string) => readonly JsonToken[]
    = s => toArray(tokenize(stringToList(s)))

const stringify = jsonStringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('null')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",null]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('true')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",true]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('false')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",false]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('0.1')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",0.1]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('1.1e+2')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",110]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('"abc"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok","abc"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[1]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[1]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[[]]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[0,[1,[2,[]]],3]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[0,[1,[2,[]]],3]]') { throw result }
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
        },
        () => {
            const tokenList = tokenizeString('[1,]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[1]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"a":1,}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":1}]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('"123')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[,]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[1 2]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[1,,2]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[]]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('["a"')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[,1]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[:]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString(']')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{,}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{1:2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1"2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1"::2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1":2,,"3":4')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{}}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{"1":2')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{,"1":2}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('[{]}')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('{[}]')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('10-5')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('undefined')
            const obj = parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
    ]
}
