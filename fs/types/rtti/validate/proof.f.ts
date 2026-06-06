import { validate, type ValidationError } from './module.f.ts'
import { boolean, number, string, bigint, unknown, array, record, or, option } from '../module.f.ts'
import type { Equal } from '../../ts/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import type { Unknown as DjsUnknown } from '../../../djs/module.f.ts'
import type { Assert } from '../../../asserts/module.f.ts'

const assertOk = ([k]: readonly [string, unknown]) => { if (k !== 'ok') { throw 'expected ok' } }
const assertError = ([k]: readonly [string, unknown]) => { if (k !== 'error') { throw 'expected error' } }

const assertErrorPath = (expected: readonly string[]) =>
    (r: readonly [string, unknown]) => {
        if (r[0] !== 'error') { throw 'expected error' }
        const e = r[1] as ValidationError
        if (e.path.length !== expected.length) { throw `path length ${e.path.length} != ${expected.length}` }
        for (let i = 0; i < expected.length; i++) {
            if (e.path[i] !== expected[i]) { throw `path[${i}] ${e.path[i]} != ${expected[i]}` }
        }
    }

export const proof = {
    boolean: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof boolean>, boolean>>
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
            type _ = Assert<Equal<Ts<typeof number>, number>>
            assertOk(validate(number)(42))
        },
        error: () => {
            assertError(validate(number)('42'))
            assertError(validate(number)(42n))
        },
    },
    string: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof string>, string>>
            assertOk(validate(string)('hello'))
        },
        error: () => {
            assertError(validate(string)(42))
            assertError(validate(string)(null))
        },
    },
    bigint: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof bigint>, bigint>>
            assertOk(validate(bigint)(4n))
        },
        error: () => {
            assertError(validate(bigint)(4))
            assertError(validate(bigint)('4'))
        },
    },
    unknown: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof unknown>, DjsUnknown>>
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
                type _ = Assert<Equal<Ts<null>, null>>
                assertOk(validate(null)(null))
            },
            error: () => {
                assertError(validate(null)(undefined))
                assertError(validate(null)(0))
            },
        },
        undefined: {
            ok: () => {
                type _ = Assert<Equal<Ts<undefined>, undefined>>
                assertOk(validate(undefined)(undefined))
            },
            error: () => assertError(validate(undefined)(null)),
        },
        number: {
            ok: () => {
                type _ = Assert<Equal<Ts<42>, 42>>
                assertOk(validate(42 as const)(42))
            },
            error: () => assertError(validate(42 as const)(43)),
        },
        nan: {
            ok: () => assertOk(validate(NaN as number)(NaN)),
            error: () => {
                assertError(validate(NaN as number)(0))
                assertError(validate(0 as const)(NaN))
                assertError(validate(42 as const)(NaN))
            },
        },
        infinity: {
            ok: () => {
                assertOk(validate(Infinity as number)(Infinity))
                assertOk(validate(-Infinity as number)(-Infinity))
            },
            error: () => {
                assertError(validate(Infinity as number)(-Infinity))
                assertError(validate(Infinity as number)(0))
            },
        },
        signedZero: {
            // `Object.is` distinguishes +0 and -0; `===` treats them equal.
            distinct: () => {
                assertError(validate(0 as const)(-0))
                assertError(validate(-0 as number)(0))
            },
            self: () => {
                assertOk(validate(0 as const)(0))
                assertOk(validate(-0 as number)(-0))
            },
        },
        string: {
            ok: () => {
                type _ = Assert<Equal<Ts<'hello'>, 'hello'>>
                assertOk(validate('hello' as const)('hello'))
            },
            error: () => assertError(validate('hello' as const)('world')),
        },
        bigint: {
            ok: () => {
                type _ = Assert<Equal<Ts<7n>, 7n>>
                assertOk(validate(7n as const)(7n))
            },
            error: () => assertError(validate(7n as const)(8n)),
        },
        boolean: {
            ok: () => {
                type _ = Assert<Equal<Ts<true>, true>>
                assertOk(validate(true as const)(true))
            },
            error: () => assertError(validate(true as const)(false)),
        },
        tuple: {
            ok: () => {
                const t = [42, 'hello'] as const
                type _ = Assert<Equal<Ts<typeof t>, readonly[42, 'hello']>>
                assertOk(validate(t)([42, 'hello']))
            },
            extraItems: () => assertOk(validate([42] as const)([42, 'extra'])),
            error: () => {
                assertError(validate([42] as const)([99]))
                assertError(validate([42] as const)({}))
            },
        },
        struct: {
            ok: () => {
                const t = { a: 42, b: 'hello' } as const
                type _ = Assert<Equal<Ts<typeof t>, { readonly a: 42, readonly b: 'hello' }>>
                assertOk(validate(t)({ a: 42, b: 'hello' }))
            },
            extraKeys: () => assertOk(validate({ a: 42 as const } as const)({ a: 42, b: 'extra' })),
            error: () => {
                assertError(validate({ a: 42 } as const)({ a: 99 }))
                assertError(validate({ a: 42 } as const)([]))
            },
        },
    },
    array: {
        empty: () => assertOk(validate(array(number))([])),
        ok: () => {
            const t = array(number)
            type _ = Assert<Equal<Ts<typeof t>, readonly number[]>>
            assertOk(validate(array(number))([1, 2, 3]))
        },
        error: () => {
            assertError(validate(array(number))([1, 'two', 3]))
            assertError(validate(array(number))({}))
            assertError(validate(array(number))(null))
        },
        nested: () => {
            const t = array(array(boolean))
            type _ = Assert<Equal<Ts<typeof t>, readonly (readonly boolean[])[]>>
            assertOk(validate(array(array(boolean)))([[true, false], [false]]))
            assertError(validate(array(array(boolean)))([[true, 42]]))
        },
    },
    record: {
        empty: () => assertOk(validate(record(number))({})),
        ok: () => {
            const t = record(string)
            type _ = Assert<Equal<Ts<typeof t>, { readonly[K in string]: string }>>
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
            const t = () => ['const', 7n] as const
            type _ = Assert<Equal<Ts<typeof t>, 7n>>
            assertOk(validate(t)(7n))
            assertError(validate(t)(8n))
        },
    },
    or: {
        consts: {
            ok: () => {
                const t = or(...[false,42, 'hello'] as const)
                type _ = Assert<Equal<Ts<typeof t>, false | 42 | 'hello'>>
                assertOk(validate(t)(false))
                assertOk(validate(t)(42))
                assertOk(validate(t)('hello'))
            },
            error: () => {
                const t = or(...[false, 42, 'hello'] as const)
                assertError(validate(t)(true))
                assertError(validate(t)(43))
                assertError(validate(t)('world'))
                assertError(validate(t)(null))
            },
        },
        thunks: {
            ok: () => {
                const t = or(number, string)
                type _ = Assert<Equal<Ts<typeof t>, number | string>>
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
                const t = or(42 as const, string)
                type _ = Assert<Equal<Ts<typeof t>, 42 | string>>
                assertOk(validate(t)(42))
                assertOk(validate(t)('hello'))
            },
            error: () => {
                const t = or(42 as const, string)
                assertError(validate(t)(43))
                assertError(validate(t)(null))
            },
        },
    },
    option: {
        ok: () => {
            const t = option(number)
            type _ = Assert<Equal<Ts<typeof t>, number | undefined>>
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
            validate([number, number] as const)([1, 'two'])
        ),
        structKey: () => assertErrorPath(['b'])(
            validate({ a: number, b: number } as const)({ a: 1, b: 'two' })
        ),
        deepStruct: () => {
            const schema = { user: { name: string, age: number } } as const
            const r = validate(schema)({ user: { name: 'A', age: 'old' } })
            assertErrorPath(['user', 'age'])(r)
        },
        recursiveSchema: () => {
            type A = readonly A[]
            const list = () => ['array', list] as const
            // [[[42]]] — innermost element 42 is a number, not an array
            const r = validate(list)([[[42]] as unknown as A])
            assertErrorPath(['0', '0', '0'])(r)
        },
        orRoot: () => assertErrorPath([])(validate(or(number, string))(true)),
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
            type A = { readonly[K in string]: A }
            type _ = Assert<Equal<A, Ts<typeof tree>>>
            const v = validate(tree)
            assertOk(v({}))
            assertOk(v({ a: {}, b: { c: {} } }))
            assertError(v({ a: 42 }))
        },
    },
}
