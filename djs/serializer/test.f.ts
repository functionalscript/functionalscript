import * as json from '../../json/module.f.ts'
import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as f from '../../types/function/module.f.ts'
const { identity } = f
import * as serializer from './module.f.ts'

export default {
    stringify: [
        {
            sort: () => {
                const r = json.setProperty("Hello")(['a'])({})
                const x = serializer.stringify(sort)(r)
                if (x !== '{"a":"Hello"}') { throw x }
            },
            identity: () => {
                const x = serializer.stringify(identity)(json.setProperty("Hello")(['a'])({}))
                if (x !== '{"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const x = serializer.stringify(sort)(json.setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"a":"Hello","b":12,"c":[]}') { throw x }
            },
            identity: () => {
                const x = serializer.stringify(identity)(json.setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"c":[],"b":12,"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = json.setProperty("Hello")(['a', 'x'])(_0)
                const _2 = serializer.stringify(sort)(_1)
                if (_2 !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw _2 }
            },
            identity: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = json.setProperty("Hello")(['a', 'x'])(_0)
                const _2 = serializer.stringify(identity)(_1)
                if (_2 !== '{"a":{"y":[24],"x":"Hello"},"c":[],"b":12}') { throw _2 }
            }
        },
        {
            stringify: () => {
                const bi = 1234567890n
                const result = serializer.stringify(sort)(bi)
                if (result !== '1234567890n') { throw result }
            }
        },
        {
            stringify: () => {
                const arr = [0n, 1, 2n]
                const result = serializer.stringify(sort)(arr)
                if (result !== '[0n,1,2n]') { throw result }
            }
        },
        {
            stringify: () => {
                const obj = {"a": 0n, "b": 1, "c": 2n}
                const result = serializer.stringify(sort)(obj)
                if (result !== '{"a":0n,"b":1,"c":2n}') { throw result }
            }
        }
    ]
}
