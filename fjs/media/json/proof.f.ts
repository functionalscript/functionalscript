import { parse, setProperty, stringify } from './common/module.f.ts'
import { sort } from '../../types/object/module.f.mjs'
import { identity } from '../../types/function/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    setProperty: [
        () => {
            if (setProperty("Hello")([])({}) !== "Hello") { throw 'error' }
        },
        () => {
            // src === null: should treat as empty object
            const x = stringify(sort)(setProperty("Hello")(['a'])(null))
            if (x !== '{"a":"Hello"}') { throw x }
        },
        () => {
            // typeof src !== 'object': primitive src treated as empty object
            const x = stringify(sort)(setProperty("Hello")(['a'])(42 as unknown as null))
            if (x !== '{"a":"Hello"}') { throw x }
        },
        () => {
            // src instanceof Array: array src treated as empty object
            const x = stringify(sort)(setProperty("Hello")(['a'])([1, 2] as unknown as null))
            if (x !== '{"a":"Hello"}') { throw x }
        },
    ],
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
    ],
    undefined: () => {
        assertEq(stringify(sort)({ x: undefined }), '{}')
    },
    parse: {
        ok: () => {
            const [t, v] = parse('{"a":[1,true,null],"b":"x"}')
            assertEq(t, 'ok')
            assertEq(stringify(sort)(v), '{"a":[1,true,null],"b":"x"}')
        },
        // Malformed input is an error value, not a throw.
        error: () => {
            const [t] = parse('{')
            assertEq(t, 'error')
        },
    },
}
