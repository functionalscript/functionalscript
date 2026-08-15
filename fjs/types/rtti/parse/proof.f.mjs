/**
 * @import { ValidationError } from '../common/types.ts'
 * @import { Equal } from '../../ts/types.ts'
 * @import { Ts } from '../ts/types.ts'
 * @import { Unknown as DjsUnknown } from '../../../djs/types.ts'
 * @import { Assert } from '../../../asserts/types.ts'
 */

import { parse } from './module.f.mjs'
import { boolean, number, string, bigint, unknown, array, record, or, option } from '../module.f.mjs'
import {
    assert,
    assertEq,
    assertStructurallySame,
} from '../../../asserts/module.f.mjs'

/** @type {(r: readonly [string, unknown]) => void} */
const assertOk = ([k]) => { assertEq(k, 'ok', 'expected ok') }

/** @type {(r: readonly [string, unknown]) => void} */
const assertError = ([k]) => { assertEq(k, 'error', 'expected error') }

/**
 * @template T
 * @param {readonly [string, unknown]} r
 * @returns {T}
 */
const unwrap = r => {
    assert(r[0] === 'ok', 'expected ok')
    return /** @type {T} */ (r[1])
}

/** @type {(expected: readonly string[]) => (r: readonly [string, unknown]) => void} */
const assertErrorPath = expected =>
    r => {
        assert(r[0] === 'error', 'expected error')
        const e = /** @type {ValidationError} */ (r[1])
        assertStructurallySame(e.path, expected, 'unexpected error path')
    }

export const proof = {
    boolean: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof boolean>, boolean>>} _RoundTrip */
            assertOk(parse(boolean)(true))
            assertOk(parse(boolean)(false))
        },
        error: () => {
            assertError(parse(boolean)(0))
            assertError(parse(boolean)('true'))
            assertError(parse(boolean)(null))
        },
    },
    number: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof number>, number>>} _RoundTrip */
            assertOk(parse(number)(42))
        },
        error: () => {
            assertError(parse(number)('42'))
            assertError(parse(number)(42n))
        },
    },
    string: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof string>, string>>} _RoundTrip */
            assertOk(parse(string)('hello'))
        },
        error: () => {
            assertError(parse(string)(42))
            assertError(parse(string)(null))
        },
    },
    bigint: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof bigint>, bigint>>} _RoundTrip */
            assertOk(parse(bigint)(4n))
        },
        error: () => {
            assertError(parse(bigint)(4))
            assertError(parse(bigint)('4'))
        },
    },
    unknown: {
        ok: () => {
            /** @typedef {Assert<Equal<Ts<typeof unknown>, DjsUnknown>>} _RoundTrip */
            assertOk(parse(unknown)(null))
            assertOk(parse(unknown)(42))
            assertOk(parse(unknown)('hello'))
            assertOk(parse(unknown)(true))
            assertOk(parse(unknown)({}))
            assertOk(parse(unknown)([]))
        },
    },
    const: {
        null: {
            ok: () => assertOk(parse(null)(null)),
            error: () => {
                assertError(parse(null)(undefined))
                assertError(parse(null)(0))
            },
        },
        undefined: {
            ok: () => assertOk(parse(undefined)(undefined)),
            error: () => assertError(parse(undefined)(null)),
        },
        number: {
            ok: () => assertOk(parse(/** @type {const} */ (42))(42)),
            error: () => assertError(parse(/** @type {const} */ (42))(43)),
        },
        nan: {
            ok: () => assertOk(parse(NaN)(NaN)),
            error: () => {
                assertError(parse(NaN)(0))
                assertError(parse(/** @type {const} */ (0))(NaN))
                assertError(parse(/** @type {const} */ (42))(NaN))
            },
        },
        infinity: {
            ok: () => {
                assertOk(parse(Infinity)(Infinity))
                assertOk(parse(-Infinity)(-Infinity))
            },
            error: () => {
                assertError(parse(Infinity)(-Infinity))
                assertError(parse(Infinity)(0))
            },
        },
        signedZero: {
            // `Object.is` distinguishes +0 and -0; `===` treats them equal.
            distinct: () => {
                assertError(parse(/** @type {const} */ (0))(-0))
                assertError(parse(-0)(0))
            },
            self: () => {
                assertOk(parse(/** @type {const} */ (0))(0))
                assertOk(parse(-0)(-0))
            },
        },
        string: {
            ok: () => assertOk(parse(/** @type {const} */ ('hello'))('hello')),
            error: () => assertError(parse(/** @type {const} */ ('hello'))('world')),
        },
        bigint: {
            ok: () => assertOk(parse(/** @type {const} */ (7n))(7n)),
            error: () => assertError(parse(/** @type {const} */ (7n))(8n)),
        },
        boolean: {
            ok: () => assertOk(parse(/** @type {const} */ (true))(true)),
            error: () => assertError(parse(/** @type {const} */ (true))(false)),
        },
        tuple: {
            ok: () => {
                const t = /** @type {const} */ ([42, 'hello'])
                const r = parse(t)([42, 'hello'])
                assertStructurallySame(unwrap(r), [42, 'hello'])
            },
            // The key behavior change vs `validate`: extra tuple elements are dropped.
            extraItemsDropped: () => {
                const r = parse(/** @type {const} */ ([42]))([42, 'extra'])
                assertStructurallySame(unwrap(r), [42])
            },
            error: () => {
                assertError(parse(/** @type {const} */ ([42]))([99]))
                assertError(parse(/** @type {const} */ ([42]))({}))
            },
        },
        struct: {
            ok: () => {
                const t = /** @type {const} */ ({ a: 42, b: 'hello' })
                const r = parse(t)({ a: 42, b: 'hello' })
                assertStructurallySame(unwrap(r), { a: 42, b: 'hello' })
            },
            // Undeclared properties are dropped from the constructed value.
            extraKeysDropped: () => {
                const r = parse(/** @type {const} */ ({ a: /** @type {const} */ (42) }))({ a: 42, b: 'extra' })
                assertStructurallySame(unwrap(r), { a: 42 })
            },
            error: () => {
                assertError(parse(/** @type {const} */ ({ a: 42 }))({ a: 99 }))
                assertError(parse(/** @type {const} */ ({ a: 42 }))([]))
            },
        },
    },
    array: {
        empty: () => {
            const r = parse(array(number))([])
            assertStructurallySame(unwrap(r), [])
        },
        ok: () => {
            const r = parse(array(number))([1, 2, 3])
            assertStructurallySame(unwrap(r), [1, 2, 3])
        },
        // `parse` always constructs a new array, even when the inner type is a primitive.
        freshArray: () => {
            const input = [1, 2, 3]
            /** @type {readonly number[]} */
            const out = unwrap(parse(array(number))(input))
            assert(out !== input, 'expected a fresh array')
            assertStructurallySame(out, [1, 2, 3])
        },
        error: () => {
            assertError(parse(array(number))([1, 'two', 3]))
            assertError(parse(array(number))({}))
            assertError(parse(array(number))(null))
        },
        nested: () => {
            const r = parse(array(array(boolean)))([[true, false], [false]])
            assertStructurallySame(unwrap(r), [[true, false], [false]])
            assertError(parse(array(array(boolean)))([[true, 42]]))
        },
    },
    record: {
        empty: () => {
            const r = parse(record(number))({})
            assertStructurallySame(unwrap(r), {})
        },
        ok: () => {
            const r = parse(record(string))({ a: 'hello', b: 'world' })
            assertStructurallySame(unwrap(r), { a: 'hello', b: 'world' })
        },
        // `parse` always constructs a new record.
        freshRecord: () => {
            const input = { a: 1, b: 2 }
            /** @type {Record<string, number>} */
            const out = unwrap(parse(record(number))(input))
            assert(out !== input, 'expected a fresh record')
            assertStructurallySame(out, { a: 1, b: 2 })
        },
        error: () => {
            assertError(parse(record(number))({ a: 1, b: 'two' }))
            assertError(parse(record(number))(null))
            assertError(parse(record(number))([]))
        },
    },
    constThunk: {
        primitive: () => {
            const t = () => /** @type {const} */ (['const', 7n])
            assertOk(parse(t)(7n))
            assertError(parse(t)(8n))
        },
    },
    or: {
        consts: {
            ok: () => {
                const t = or(.../** @type {const} */ ([false, 42, 'hello']))
                assertOk(parse(t)(false))
                assertOk(parse(t)(42))
                assertOk(parse(t)('hello'))
            },
            error: () => {
                const t = or(.../** @type {const} */ ([false, 42, 'hello']))
                assertError(parse(t)(true))
                assertError(parse(t)(43))
                assertError(parse(t)('world'))
                assertError(parse(t)(null))
            },
        },
        thunks: {
            ok: () => {
                const t = or(number, string)
                assertOk(parse(t)(42))
                assertOk(parse(t)('hello'))
            },
            error: () => {
                const t = or(number, string)
                assertError(parse(t)(true))
                assertError(parse(t)(null))
            },
        },
        // First matching variant wins; the freshly-constructed value comes from that variant.
        firstMatchWins: () => {
            const t = or(/** @type {const} */ ([number]), array(number))
            /** @type {readonly number[]} */
            const out = unwrap(parse(t)([1, 2, 3]))
            // The const tuple `[number]` matches first and returns a length-1 result.
            assertStructurallySame(out, [1])
        },
    },
    option: {
        ok: () => {
            const t = option(number)
            assertOk(parse(t)(42))
            assertOk(parse(t)(undefined))
        },
        error: () => {
            const t = option(number)
            assertError(parse(t)(null))
            assertError(parse(t)('42'))
        },
    },
    path: {
        rootMismatch: () => assertErrorPath([])(parse(number)('not a number')),
        arrayIndex: () => assertErrorPath(['1'])(parse(array(number))([1, 'two', 3])),
        recordKey: () => {
            const r = parse(record(number))({ a: 1, b: 'two', c: 3 })
            assertErrorPath(['b'])(r)
        },
        nestedArray: () => assertErrorPath(['0', '1'])(
            parse(array(array(number)))([[1, 'x'], [2, 3]])
        ),
        tupleIndex: () => assertErrorPath(['1'])(
            parse(/** @type {const} */ ([number, number]))([1, 'two'])
        ),
        structKey: () => assertErrorPath(['b'])(
            parse(/** @type {const} */ ({ a: number, b: number }))({ a: 1, b: 'two' })
        ),
        deepStruct: () => {
            const schema = /** @type {const} */ ({ user: { name: string, age: number } })
            const r = parse(schema)({ user: { name: 'A', age: 'old' } })
            assertErrorPath(['user', 'age'])(r)
        },
        recursiveSchema: () => {
            /** @typedef {readonly _A[]} _A */
            const list = () => /** @type {const} */ (['array', list])
            const r = parse(list)([/** @type {_A} */ (/** @type {unknown} */ ([[42]]))])
            assertErrorPath(['0', '0', '0'])(r)
        },
        orRoot: () => assertErrorPath([])(parse(or(number, string))(true)),
    },
    recursive: {
        arrayOfArrays: () => {
            /** @typedef {readonly _A[]} _A */
            const list = () => /** @type {const} */ (['array', list])
            /** @typedef {Assert<Equal<_A, Ts<typeof list>>>} _ListRoundTrip */
            const v = parse(list)
            assertOk(v([]))
            assertOk(v([[], []]))
            assertOk(v([[[], []], []]))
            assertError(v([42]))
            assertError(v(null))
        },
        recordOfRecords: () => {
            const tree = () => /** @type {const} */ (['record', tree])
            /** @typedef {{ readonly[K in string]?: _A }} _A */
            /** @typedef {Assert<Equal<_A, Ts<typeof tree>>>} _TreeRoundTrip */
            const v = parse(tree)
            assertOk(v({}))
            assertOk(v({ a: {}, b: { c: {} } }))
            assertError(v({ a: 42 }))
        },
    },
}
