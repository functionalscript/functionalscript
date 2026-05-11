import { setProperty, stringify } from './module.f.ts'
import { sort } from '../types/object/module.f.ts'
import { identity } from '../types/function/module.f.ts'

export default {
    setProperty: () => {
        if (setProperty("Hello")([])({}) !== "Hello") { throw 'error' }
    },
    stringify: [
        {
            sort: () => {
                const r = setProperty("Hello")(['a'])({})
                const x = stringify(sort)(r)
                if (x !== '{"a":"Hello"}') { throw x }
            },
            identity: () => {
                const x = stringify(identity)(setProperty("Hello")(['a'])({}))
                if (x !== '{"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const x = stringify(sort)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"a":"Hello","b":12,"c":[]}') { throw x }
            },
            identity: () => {
                const x = stringify(identity)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"c":[],"b":12,"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringify(sort)(_1)
                if (_2 !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw _2 }
            },
            identity: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringify(identity)(_1)
                if (_2 !== '{"a":{"y":[24],"x":"Hello"},"c":[],"b":12}') { throw _2 }
            }
        }
    ]
}
