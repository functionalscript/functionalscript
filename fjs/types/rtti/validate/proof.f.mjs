/**
 * @import { ValidationError } from '../common/types.ts'
 * @import { Equal } from '../../ts/types.ts'
 * @import { Ts } from '../ts/types.ts'
 * @import { Unknown as DjsUnknown } from '../../../djs/types.ts'
 * @import { Assert } from '../../../asserts/types.ts'
 */

import { validate } from './module.f.mjs'
import { boolean, number, string, bigint, unknown, array, record, or, option } from '../module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

/** @type {(r: readonly [string, unknown]) => void} */
const assertOk = ([k]) => { assertEq(k, 'ok', 'expected ok') }

/** @type {(r: readonly [string, unknown]) => void} */
const assertError = ([k]) => { assertEq(k, 'error', 'expected error') }

/** @type {(expected: readonly string[]) => (r: readonly [string, unknown]) => void} */
const assertErrorPath = expected =>
    r => {
        assert(r[0] === 'error', 'expected error')
        const e = /** @type {ValidationError} */ (r[1])
        if (e.path.length !== expected.length) { throw `path length ${e.path.length} != ${expected.length}` }
        for (let i = 0; i < expected.length; i++) {
            if (e.path[i] !== expected[i]) { throw `path[${i}] ${e.path[i]} != ${expected[i]}` }
        }
    }

export const proof = {
    boolean: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof boolean>, boolean>>} _RoundTrip */
            assertOk(validate(boolean)(true))
            assertOk(validate(boolean)(false))
        },
        error: () => {
            assertError(validate(boolean)(0))
            assertError(validate(boolean)('true'))
            assertError(validate(boolean)(null))
        },
    },
    number: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof number>, number>>} _RoundTrip */
            assertOk(validate(number)(42))
        },
        error: () => {
            assertError(validate(number)('42'))
            assertError(validate(number)(42n))
        },
    },
    string: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof string>, string>>} _RoundTrip */
            assertOk(validate(string)('hello'))
        },
        error: () => {
            assertError(validate(string)(42))
            assertError(validate(string)(null))
        },
    },
    bigint: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof bigint>, bigint>>} _RoundTrip */
            assertOk(validate(bigint)(4n))
        },
        error: () => {
            assertError(validate(bigint)(4))
            assertError(validate(bigint)('4'))
        },
    },
    unknown: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof unknown>, DjsUnknown>>} _RoundTrip */
            assertOk(validate(unknown)(null))
            assertOk(validate(unknown)(42))
            assertOk(validate(unknown)('hello'))
            assertOk(validate(unknown)(true))
            assertOk(validate(unknown)({}))
            assertOk(validate(unknown)([]))
        },
    },
    const: {
        null: {
            ok: () => {
                /** @typedef {Assert<Equal<Ts<null>, null>>} _RoundTrip */
                assertOk(validate(null)(null))
            },
            error: () => {
                assertError(validate(null)(undefined))
                assertError(validate(null)(0))
            },
        },
        undefined: {
            ok: () => {
                /** @typedef {Assert<Equal<Ts<undefined>, undefined>>} _RoundTrip */
                assertOk(validate(undefined)(undefined))
            },
            error: () => assertError(validate(undefined)(null)),
        },
        number: {
            ok: () => {
                /** @typedef {Assert<Equal<Ts<42>, 42>>} _RoundTrip */
                assertOk(validate(/** @type {const} */ (42))(42))
            },
            error: () => assertError(validate(/** @type {const} */ (42))(43)),
        },
        nan: {
            ok: () => assertOk(validate(NaN)(NaN)),
            error: () => {
                assertError(validate(NaN)(0))
                assertError(validate(/** @type {const} */ (0))(NaN))
                assertError(validate(/** @type {const} */ (42))(NaN))
            },
        },
        infinity: {
            ok: () => {
                assertOk(validate(Infinity)(Infinity))
                assertOk(validate(-Infinity)(-Infinity))
            },
            error: () => {
                assertError(validate(Infinity)(-Infinity))
                assertError(validate(Infinity)(0))
            },
        },
        signedZero: {
            // `Object.is` distinguishes +0 and -0; `===` treats them equal.
            distinct: () => {
                assertError(validate(/** @type {const} */ (0))(-0))
                assertError(validate(-0)(0))
            },
            self: () => {
                assertOk(validate(/** @type {const} */ (0))(0))
                assertOk(validate(-0)(-0))
            },
        },
        string: {
            ok: () => {
                /** @typedef {Assert<Equal<Ts<'hello'>, 'hello'>>} _RoundTrip */
                assertOk(validate(/** @type {const} */ ('hello'))('hello'))
            },
            error: () => assertError(validate(/** @type {const} */ ('hello'))('world')),
        },
        bigint: {
            ok: () => {
                /** @typedef {Assert<Equal<Ts<7n>, 7n>>} _RoundTrip */
                assertOk(validate(/** @type {const} */ (7n))(7n))
            },
            error: () => assertError(validate(/** @type {const} */ (7n))(8n)),
        },
        boolean: {
            ok: () => {
                /** @typedef {Assert<Equal<Ts<true>, true>>} _RoundTrip */
                assertOk(validate(/** @type {const} */ (true))(true))
            },
            error: () => assertError(validate(/** @type {const} */ (true))(false)),
        },
        tuple: {
            ok: () => {
                const t = /** @type {const} */ ([42, 'hello'])
                /** @typedef {Assert<Equal<Ts<typeof t>, readonly[42, 'hello']>>} _RoundTrip */
                assertOk(validate(t)([42, 'hello']))
            },
            // A tuple is closed: `Ts<readonly [42]>` is the exact tuple, and a
            // 2-element array is not assignable to it. Unlike a struct's extra
            // keys, which structural typing does allow — see `struct.extraKeys`.
            extraItems: () => {
                assertError(validate(/** @type {const} */ ([42]))([42, 'extra']))
                assertError(validate(/** @type {const} */ ([42, 'hello']))([42, 'hello', 0]))
            },
            // The other side of the length check. When the missing element's
            // schema rejects `undefined`, the per-element walk already caught
            // this — the length check only moves the report from the first
            // missing index to the root, where the length itself lives.
            missingItems: () => {
                assertErrorPath([])(validate(/** @type {const} */ ([42]))([]))
                assertErrorPath([])(validate(/** @type {const} */ ([42, 'hello']))([42]))
            },
            // But when the missing element's schema *admits* `undefined`, the
            // walk saw a valid value at that index and returned ok. Only the
            // length check rejects these, so these cases — not the ones above —
            // are what pin the short side: with `length <= size` the whole
            // suite still passes without them.
            missingOptionalItems: () => {
                assertError(validate([number, option(string)])([42]))
                assertError(validate([option(number)])([]))
                assertError(validate([unknown])([]))
                // Present-but-undefined is still the declared length, so it
                // stays ok — the check is on length, not on element presence.
                assertOk(validate([number, option(string)])([42, undefined]))
            },
            // An empty tuple schema admits exactly the empty array.
            empty: () => {
                assertOk(validate(/** @type {const} */ ([]))([]))
                assertError(validate(/** @type {const} */ ([]))([1]))
            },
            error: () => {
                assertError(validate(/** @type {const} */ ([42]))([99]))
                assertError(validate(/** @type {const} */ ([42]))({}))
            },
        },
        struct: {
            ok: () => {
                const t = /** @type {const} */ ({ a: 42, b: 'hello' })
                /** @typedef {Assert<Equal<Ts<typeof t>, { readonly a: 42, readonly b: 'hello' }>>} _RoundTrip */
                assertOk(validate(t)({ a: 42, b: 'hello' }))
            },
            extraKeys: () => assertOk(validate(/** @type {const} */ ({ a: /** @type {const} */ (42) }))({ a: 42, b: 'extra' })),
            error: () => {
                assertError(validate(/** @type {const} */ ({ a: 42 }))({ a: 99 }))
                assertError(validate(/** @type {const} */ ({ a: 42 }))([]))
            },
        },
    },
    array: {
        empty: () => assertOk(validate(array(number))([])),
        ok: () => {
            const t = array(number)
            /** @typedef {Assert<Equal<Ts<typeof t>, readonly number[]>>} _RoundTrip */
            assertOk(validate(array(number))([1, 2, 3]))
        },
        error: () => {
            assertError(validate(array(number))([1, 'two', 3]))
            assertError(validate(array(number))({}))
            assertError(validate(array(number))(null))
        },
        nested: () => {
            const t = array(array(boolean))
            /** @typedef {Assert<Equal<Ts<typeof t>, readonly (readonly boolean[])[]>>} _RoundTrip */
            assertOk(validate(array(array(boolean)))([[true, false], [false]]))
            assertError(validate(array(array(boolean)))([[true, 42]]))
        },
    },
    record: {
        empty: () => assertOk(validate(record(number))({})),
        ok: () => {
            const t = record(string)
            /** @typedef {Assert<Equal<Ts<typeof t>, { readonly[K in string]?: string }>>} _RoundTrip */
            assertOk(validate(t)({ a: 'hello', b: 'world' }))
        },
        error: () => {
            assertError(validate(record(number))({ a: 1, b: 'two' }))
            assertError(validate(record(number))(null))
            assertError(validate(record(number))([]))
        },
    },
    constThunk: {
        primitive: () => {
            const t = () => /** @type {const} */ (['const', 7n])
            /** @typedef {Assert<Equal<Ts<typeof t>, 7n>>} _RoundTrip */
            assertOk(validate(t)(7n))
            assertError(validate(t)(8n))
        },
    },
    or: {
        consts: {
            ok: () => {
                const t = or(.../** @type {const} */ ([false,42, 'hello']))
                /** @typedef {Assert<Equal<Ts<typeof t>, false | 42 | 'hello'>>} _RoundTrip */
                assertOk(validate(t)(false))
                assertOk(validate(t)(42))
                assertOk(validate(t)('hello'))
            },
            error: () => {
                const t = or(.../** @type {const} */ ([false, 42, 'hello']))
                assertError(validate(t)(true))
                assertError(validate(t)(43))
                assertError(validate(t)('world'))
                assertError(validate(t)(null))
            },
        },
        thunks: {
            ok: () => {
                const t = or(number, string)
                /** @typedef {Assert<Equal<Ts<typeof t>, number | string>>} _RoundTrip */
                assertOk(validate(t)(42))
                assertOk(validate(t)('hello'))
            },
            error: () => {
                const t = or(number, string)
                assertError(validate(t)(true))
                assertError(validate(t)(null))
            },
        },
        mixed: {
            ok: () => {
                const t = or(/** @type {const} */ (42), string)
                /** @typedef {Assert<Equal<Ts<typeof t>, 42 | string>>} _RoundTrip */
                assertOk(validate(t)(42))
                assertOk(validate(t)('hello'))
            },
            error: () => {
                const t = or(/** @type {const} */ (42), string)
                assertError(validate(t)(43))
                assertError(validate(t)(null))
            },
        },
    },
    option: {
        ok: () => {
            const t = option(number)
            /** @typedef {Assert<Equal<Ts<typeof t>, number | undefined>>} _RoundTrip */
            assertOk(validate(t)(42))
            assertOk(validate(t)(undefined))
        },
        error: () => {
            const t = option(number)
            assertError(validate(t)(null))
            assertError(validate(t)('42'))
        },
    },
    path: {
        rootMismatch: () => assertErrorPath([])(validate(number)('not a number')),
        arrayIndex: () => assertErrorPath(['1'])(validate(array(number))([1, 'two', 3])),
        recordKey: () => {
            const r = validate(record(number))({ a: 1, b: 'two', c: 3 })
            // record iteration order matches Object.entries; 'b' is the failing key
            assertErrorPath(['b'])(r)
        },
        nestedArray: () => assertErrorPath(['0', '1'])(
            validate(array(array(number)))([[1, 'x'], [2, 3]])
        ),
        tupleIndex: () => assertErrorPath(['1'])(
            validate(/** @type {const} */ ([number, number]))([1, 'two'])
        ),
        structKey: () => assertErrorPath(['b'])(
            validate(/** @type {const} */ ({ a: number, b: number }))({ a: 1, b: 'two' })
        ),
        deepStruct: () => {
            const schema = /** @type {const} */ ({ user: { name: string, age: number } })
            const r = validate(schema)({ user: { name: 'A', age: 'old' } })
            assertErrorPath(['user', 'age'])(r)
        },
        recursiveSchema: () => {
            /** @typedef {readonly _A[]} _A */
            const list = () => /** @type {const} */ (['array', list])
            // [[[42]]] — innermost element 42 is a number, not an array
            const r = validate(list)([/** @type {_A} */ (/** @type {unknown} */ ([[42]]))])
            assertErrorPath(['0', '0', '0'])(r)
        },
        orRoot: () => assertErrorPath([])(validate(or(number, string))(true)),
    },
    recursive: {
        arrayOfArrays: () => {
            /** @typedef {readonly _A[]} _A */
            // self-referential schema: an array whose elements are also arrays of the same type
            const list = () => /** @type {const} */ (['array', list])
            /** @typedef {Assert<Equal<_A, Ts<typeof list>>>} _RoundTripA */
            const v = validate(list)
            assertOk(v([]))
            assertOk(v([[], []]))
            assertOk(v([[[], []], []]))
            assertError(v([42]))
            assertError(v(null))
        },
        recordOfRecords: () => {
            const tree = () => /** @type {const} */ (['record', tree])
            /** @typedef {{ readonly[K in string]?: _A }} _A */
            /** @typedef {Assert<Equal<_A, Ts<typeof tree>>>} _RoundTrip */
            const v = validate(tree)
            assertOk(v({}))
            assertOk(v({ a: {}, b: { c: {} } }))
            assertError(v({ a: 42 }))
        },
    },
    funcParam: () => {
        const paramSet0 = /** @type {const} */ (['hello', bigint])
        const paramSet1 = /** @type {const} */ (['goodbye', string, 43])

        const paramSet01 = or(paramSet0, paramSet1)

        /** @typedef {Ts<typeof paramSet0>} _Param0 */
        /** @typedef {Ts<typeof paramSet1>} _Param1 */
        /** @typedef {Ts<typeof paramSet01>} _Param01 */

        const v0 = validate(paramSet0)
        const v1 = validate(paramSet1)

        /** @template T @typedef {(...args: _Param0) => T} _F0 */
        /** @template T @typedef {(...args: _Param1) => T} _F1 */

        /**
         * @template T
         * @param {_F0<T>} f0
         * @param {_F1<T>} f1
         * @returns {(...args: _Param01) => T}
         */
        const func = (f0, f1) => (...args) => {
            {
                const [t, r] = v0(args)
                if (t === 'ok') {
                    return f0(...r)
                }
            }
            {
                const [t, r] = v1(args)
                if (t === 'ok') {
                    return f1(...r)
                }
            }
            throw 'unreachable: args did not match any parameter set'
        }

        /** @type {(a: 'hello', b: bigint) => number} */
        const f0 = (a, b) => 42
        /** @type {(a: 'goodbye', b: string, c: 43) => number} */
        const f1 = (a, b, c) => 13

        /** @type {(...args: _Param01) => number} */
        const x = func(f0, f1)

        return () => {
            assertEq(x('hello', 42n), 42)
            assertEq(x('goodbye', 'world', 43), 13)
        }
    },
    funcObj: () => {
        const param0 = { a: 'hello', b: bigint }
        const param1 = { a: 'goodbye', b: string, c: 43 }

        const param01 = or(param0, param1)

        /** @typedef {Ts<typeof param0>} _Param0 */
        /** @typedef {Ts<typeof param1>} _Param1 */
        /** @typedef {Ts<typeof param01>} _Param01 */

        const v0 = validate(param0)
        const v1 = validate(param1)

        /** @template T @typedef {(args: _Param0) => T} _F0 */
        /** @template T @typedef {(args: _Param1) => T} _F1 */

        /**
         * @template T
         * @param {_F0<T>} f0
         * @param {_F1<T>} f1
         * @returns {(args: _Param01) => T}
         */
        const func = (f0, f1) => args => {
            {
                const [t, r] = v0(args)
                if (t === 'ok') {
                    return f0(r)
                }
            }
            {
                const [t, r] = v1(args)
                if (t === 'ok') {
                    return f1(r)
                }
            }
            throw 'unreachable: args did not match any parameter set'
        }

        /** @type {(args: _Param0) => number} */
        const f0 = args => Number(args.b) + args.a.length
        /** @type {(args: _Param1) => number} */
        const f1 = args => args.c

        /** @type {(args: _Param01) => number} */
        const x = func(f0, f1)

        return () => {
            assertEq(x({ a: 'hello', b: 42n }), 47)
            assertEq(x({ a: 'goodbye', b: 'world', c: 43 }), 43)
        }
    }
}
