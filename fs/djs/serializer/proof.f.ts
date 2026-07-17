import { countRefs, stringify, stringifyAsTree } from './module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { setProperty } from '../../media/json/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

export const proof = {
    stringify: [
        {
            testPrimitives: () => {
                const djs = [1, 2, 2, 2, true, false, undefined, null, 3n, "str"]
                const refs = countRefs(djs)
                assert(refs.size === 3, refs.size)
                const refsBigInt = stringifyAsTree(sort)(refs.get(3n))
                assert(refsBigInt === '[0,1]', refsBigInt)
                const refsString = stringifyAsTree(sort)(refs.get("str"))
                assert(refsString === '[1,1]', refsString)
                const refsRoot = stringifyAsTree(sort)(refs.get(djs))
                assert(refsRoot === '[2,1]', refsRoot)
                assert(refs.get(null) === undefined, refs.get(null))
            },
            testArray: () => {
                const array = [null]
                const djs = [array, array, array]
                const refs = countRefs(djs)
                assert(refs.size === 2, refs.size)
                const refsArray = stringifyAsTree(sort)(refs.get(array))
                assert(refsArray === '[0,3]', refsArray)
                const refsRoot = stringifyAsTree(sort)(refs.get(djs))
                assert(refsRoot === '[1,1]', refsRoot)
            },
            testObj: () => {
                const obj = { "a": 1, "b": 2 }
                const djs = [obj, obj, 1]
                const refs = countRefs(djs)
                assert(refs.size === 2, refs.size)
                const refsObj = stringifyAsTree(sort)(refs.get(obj))
                assert(refsObj === '[0,2]', refsObj)
                const refsRoot = stringifyAsTree(sort)(refs.get(djs))
                assert(refsRoot === '[1,1]', refsRoot)
            },
        },
        {
            testSort: () => {
                const obj = { "a": 1, "c": 2n, "b": [undefined, null, true, false] }
                const djs = [obj, obj, 1]
                const res = stringify(sort)(djs)
                if (res !== 'const c2 = {"a":1,"b":[undefined,null,true,false],"c":2n}\nexport default [c2,c2,1]') { throw res }
            },
            testIdentity: () => {
                const obj = { "a": 1, "c": 2n, "b": [undefined, null, true, false] }
                const djs = [obj, obj, 1]
                const res = stringify(identity)(djs)
                if (res !== 'const c2 = {"a":1,"c":2n,"b":[undefined,null,true,false]}\nexport default [c2,c2,1]') { throw res }
            },
        }
    ],
    stringifyAsTree: [
        {
            sort: () => {
                const r = setProperty("Hello")(['a'])({})
                const x = stringifyAsTree(sort)(r)
                if (x !== '{"a":"Hello"}') { throw x }
            },
            identity: () => {
                const x = stringifyAsTree(identity)(setProperty("Hello")(['a'])({}))
                if (x !== '{"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const x = stringifyAsTree(sort)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"a":"Hello","b":12,"c":[]}') { throw x }
            },
            identity: () => {
                const x = stringifyAsTree(identity)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"c":[],"b":12,"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringifyAsTree(sort)(_1)
                if (_2 !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw _2 }
            },
            identity: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringifyAsTree(identity)(_1)
                if (_2 !== '{"a":{"y":[24],"x":"Hello"},"c":[],"b":12}') { throw _2 }
            }
        },
        {
            stringify: () => {
                const bi = 1234567890n
                const result = stringifyAsTree(sort)(bi)
                assert(result === '1234567890n', result)
            }
        },
        {
            stringify: () => {
                const arr = [0n, 1, 2n]
                const result = stringifyAsTree(sort)(arr)
                assert(result === '[0n,1,2n]', result)
            }
        },
        {
            stringify: () => {
                const obj = { "a": 0n, "b": 1, "c": 2n }
                const result = stringifyAsTree(sort)(obj)
                if (result !== '{"a":0n,"b":1,"c":2n}') { throw result }
            }
        }
    ]
}
