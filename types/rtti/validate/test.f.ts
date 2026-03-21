import { validate } from './module.f.ts'
import { boolean, number, string, bigint, unknown, array, record, type Thunk } from '../module.f.ts'
import type { Assert, Equal } from '../../ts/module.f.ts'
import type { Ts } from '../ts/module.f.ts'

const assertOk = ([k]: readonly [string, unknown]) => { if (k !== 'ok') { throw 'expected ok' } }
const assertError = ([k]: readonly [string, unknown]) => { if (k !== 'error') { throw 'expected error' } }

export default {
    boolean: {
        ok: () => {
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
        ok: () => assertOk(validate(number)(42)),
        error: () => {
            assertError(validate(number)('42'))
            assertError(validate(number)(42n))
        },
    },
    string: {
        ok: () => assertOk(validate(string)('hello')),
        error: () => {
            assertError(validate(string)(42))
            assertError(validate(string)(null))
        },
    },
    bigint: {
        ok: () => assertOk(validate(bigint)(4n)),
        error: () => {
            assertError(validate(bigint)(4))
            assertError(validate(bigint)('4'))
        },
    },
    unknown: {
        ok: () => {
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
            ok: () => assertOk(validate(null)(null)),
            error: () => {
                assertError(validate(null)(undefined))
                assertError(validate(null)(0))
            },
        },
        undefined: {
            ok: () => assertOk(validate(undefined)(undefined)),
            error: () => assertError(validate(undefined)(null)),
        },
        number: {
            ok: () => assertOk(validate(42 as const)(42)),
            error: () => assertError(validate(42 as const)(43)),
        },
        string: {
            ok: () => assertOk(validate('hello' as const)('hello')),
            error: () => assertError(validate('hello' as const)('world')),
        },
        bigint: {
            ok: () => assertOk(validate(7n as const)(7n)),
            error: () => assertError(validate(7n as const)(8n)),
        },
        boolean: {
            ok: () => assertOk(validate(true as const)(true)),
            error: () => assertError(validate(true as const)(false)),
        },
        tuple: {
            ok: () => assertOk(validate([42 as const, 'hello' as const] as const)([42, 'hello'])),
            extraItems: () => assertOk(validate([42 as const] as const)([42, 'extra'])),
            error: () => {
                assertError(validate([42 as const] as const)([99]))
                assertError(validate([42 as const] as const)({}))
            },
        },
        struct: {
            ok: () => assertOk(validate({ a: 42 as const, b: 'hello' as const } as const)({ a: 42, b: 'hello' })),
            extraKeys: () => assertOk(validate({ a: 42 as const } as const)({ a: 42, b: 'extra' })),
            error: () => {
                assertError(validate({ a: 42 as const } as const)({ a: 99 }))
                assertError(validate({ a: 42 as const } as const)([]))
            },
        },
    },
    array: {
        empty: () => assertOk(validate(array(number))([])),
        ok: () => assertOk(validate(array(number))([1, 2, 3])),
        error: () => {
            assertError(validate(array(number))([1, 'two', 3]))
            assertError(validate(array(number))({}))
            assertError(validate(array(number))(null))
        },
        nested: () => {
            assertOk(validate(array(array(boolean)))([[true, false], [false]]))
            assertError(validate(array(array(boolean)))([[true, 42]]))
        },
    },
    record: {
        empty: () => assertOk(validate(record(number))({})),
        ok: () => assertOk(validate(record(string))({ a: 'hello', b: 'world' })),
        error: () => {
            assertError(validate(record(number))({ a: 1, b: 'two' }))
            assertError(validate(record(number))(null))
            assertError(validate(record(number))([]))
        },
    },
    constThunk: {
        primitive: () => {
            assertOk(validate(() => ['const', 7n] as const)(7n))
            assertError(validate(() => ['const', 7n] as const)(8n))
        },
    },
    recursive: {
        arrayOfArrays: () => {
            type A = readonly A[]
            // self-referential schema: an array whose elements are also arrays of the same type
            const list = () => ['array', list] as const
            type _A = Assert<Equal<A, Ts<typeof list>>>
            const v = validate(list)
            assertOk(v([]))
            assertOk(v([[], []]))
            assertOk(v([[[], []], []]))
            assertError(v([42]))
            assertError(v(null))
        },
        recordOfRecords: () => {
            const tree = () => ['record', tree] as const
            const v = validate(tree)
            assertOk(v({}))
            assertOk(v({ a: {}, b: { c: {} } }))
            assertError(v({ a: 42 }))
        },
    },
}
