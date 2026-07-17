import { countRefs, stringify, stringifyAsTree } from './module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { setProperty } from '../../media/json/module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

export const proof = {
    stringify: [
        {
            testPrimitives: () => {
                const djs = [1, 2, 2, 2, true, false, undefined, null, 3n, "str"]
                const refs = countRefs(djs)
                assertEq(refs.size, 3)
                const refsBigInt = stringifyAsTree(sort)(refs.get(3n))
                assertEq(refsBigInt, '[0,1]')
                const refsString = stringifyAsTree(sort)(refs.get("str"))
                assertEq(refsString, '[1,1]')
                const refsRoot = stringifyAsTree(sort)(refs.get(djs))
                assertEq(refsRoot, '[2,1]')
                assertEq(refs.get(null), undefined)
            },
            testArray: () => {
                const array = [null]
                const djs = [array, array, array]
                const refs = countRefs(djs)
                assertEq(refs.size, 2)
                const refsArray = stringifyAsTree(sort)(refs.get(array))
                assertEq(refsArray, '[0,3]')
                const refsRoot = stringifyAsTree(sort)(refs.get(djs))
                assertEq(refsRoot, '[1,1]')
            },
            testObj: () => {
                const obj = { "a": 1, "b": 2 }
                const djs = [obj, obj, 1]
                const refs = countRefs(djs)
                assertEq(refs.size, 2)
                const refsObj = stringifyAsTree(sort)(refs.get(obj))
                assertEq(refsObj, '[0,2]')
                const refsRoot = stringifyAsTree(sort)(refs.get(djs))
                assertEq(refsRoot, '[1,1]')
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
                assertEq(result, '1234567890n')
            }
        },
        {
            stringify: () => {
                const arr = [0n, 1, 2n]
                const result = stringifyAsTree(sort)(arr)
                assertEq(result, '[0n,1,2n]')
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
