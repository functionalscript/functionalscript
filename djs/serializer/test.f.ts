import { countRefs, stringifyWithConst, stringifyWithoutConst } from './module.f.ts'
import * as list from '../../types/object/module.f.ts'
const { sort } = list
import { identity } from '../../types/function/module.f.ts'
import * as json from '../../json/module.f.ts'

export default {

    stringifyWithConst: [
        {
            testPrimitives: () => {
                const djs = [1, 2, 2, 2, true, false, undefined, null, 3n, "str"]
                const refs = countRefs(djs)
                if (refs.size !== 3) { throw refs.size }
                const refsBigInt = stringifyWithoutConst(sort)(refs.get(3n))
                if (refsBigInt !== '[0,1,false]') { throw refsBigInt }
                const refsString = stringifyWithoutConst(sort)(refs.get("str"))
                if (refsString !== '[1,1,false]') { throw refsString }
                const refsRoot = stringifyWithoutConst(sort)(refs.get(djs))
                if (refsRoot !== '[2,1,false]') { throw refsRoot }
                if (refs.get(null) !== undefined) { throw refs.get(null) }
            },
            testArray: () => {
                const array = [null]
                const djs = [array, array, array]
                const refs = countRefs(djs)
                if (refs.size !== 2) { throw refs.size }
                const refsArray = stringifyWithoutConst(sort)(refs.get(array))
                if (refsArray !== '[0,3,false]') { throw refsArray }
                const refsRoot = stringifyWithoutConst(sort)(refs.get(djs))
                if (refsRoot !== '[1,1,false]') { throw refsRoot }
            },
            testObj: () => {
                const obj = { "a": 1, "b": 2 }
                const djs = [obj, obj, 1]
                const refs = countRefs(djs)
                if (refs.size !== 2) { throw refs.size }
                const refsObj = stringifyWithoutConst(sort)(refs.get(obj))
                if (refsObj !== '[0,2,false]') { throw refsObj }
                const refsRoot = stringifyWithoutConst(sort)(refs.get(djs))
                if (refsRoot !== '[1,1,false]') { throw refsRoot }
            },
        },
        {
            testSort: () => {
                const obj = { "a": 1, "c": 2n, "b": [undefined, null, true, false] }
                const djs = [obj, obj, 1]
                const res = stringifyWithConst(sort)(djs)
                if (res !== 'const c2 = {"a":1,"b":[undefined,null,true,false],"c":2n}\nexport default [c2,c2,1]') { throw res }
            },
            testIdentity: () => {
                const obj = { "a": 1, "c": 2n, "b": [undefined, null, true, false] }
                const djs = [obj, obj, 1]
                const res = stringifyWithConst(identity)(djs)
                if (res !== 'const c2 = {"a":1,"c":2n,"b":[undefined,null,true,false]}\nexport default [c2,c2,1]') { throw res }
            },
        }
    ],
    stringifyWithoutConst: [
        {
            sort: () => {
                const r = json.setProperty("Hello")(['a'])({})
                const x = stringifyWithoutConst(sort)(r)
                if (x !== '{"a":"Hello"}') { throw x }
            },
            identity: () => {
                const x = stringifyWithoutConst(identity)(json.setProperty("Hello")(['a'])({}))
                if (x !== '{"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const x = stringifyWithoutConst(sort)(json.setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"a":"Hello","b":12,"c":[]}') { throw x }
            },
            identity: () => {
                const x = stringifyWithoutConst(identity)(json.setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"c":[],"b":12,"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = json.setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringifyWithoutConst(sort)(_1)
                if (_2 !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw _2 }
            },
            identity: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = json.setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringifyWithoutConst(identity)(_1)
                if (_2 !== '{"a":{"y":[24],"x":"Hello"},"c":[],"b":12}') { throw _2 }
            }
        },
        {
            stringify: () => {
                const bi = 1234567890n
                const result = stringifyWithoutConst(sort)(bi)
                if (result !== '1234567890n') { throw result }
            }
        },
        {
            stringify: () => {
                const arr = [0n, 1, 2n]
                const result = stringifyWithoutConst(sort)(arr)
                if (result !== '[0n,1,2n]') { throw result }
            }
        },
        {
            stringify: () => {
                const obj = { "a": 0n, "b": 1, "c": 2n }
                const result = stringifyWithoutConst(sort)(obj)
                if (result !== '{"a":0n,"b":1,"c":2n}') { throw result }
            }
        }
    ]
}