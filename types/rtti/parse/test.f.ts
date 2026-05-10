import { parse, type ValidationError } from './module.f.ts'
import { boolean, number, string, bigint, unknown, array, record, or, option } from '../module.f.ts'
import type { Assert, Equal } from '../../ts/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import type { Unknown as DjsUnknown } from '../../../djs/module.f.ts'

const assertOk = ([k]: readonly [string, unknown]) => { if (k !== 'ok') { throw 'expected ok' } }
const assertError = ([k]: readonly [string, unknown]) => { if (k !== 'error') { throw 'expected error' } }

const unwrap = <T>(r: readonly [string, unknown]): T => {
    if (r[0] !== 'ok') { throw 'expected ok' }
    return r[1] as T
}

const assertErrorPath = (expected: readonly string[]) =>
    (r: readonly [string, unknown]) => {
        if (r[0] !== 'error') { throw 'expected error' }
        const e = r[1] as ValidationError
        if (e.path.length !== expected.length) { throw `path length ${e.path.length} != ${expected.length}` }
        for (let i = 0; i < expected.length; i++) {
            if (e.path[i] !== expected[i]) { throw `path[${i}] ${e.path[i]} != ${expected[i]}` }
        }
    }

const assertDeepEqual = (a: unknown, b: unknown): void => {
    if (a === b) { return }
    if (a instanceof Array && b instanceof Array) {
        if (a.length !== b.length) { throw `array length ${a.length} != ${b.length}` }
        for (let i = 0; i < a.length; i++) { assertDeepEqual(a[i], b[i]) }
        return
    }
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
        const ka = Object.keys(a).sort()
        const kb = Object.keys(b).sort()
        if (ka.length !== kb.length) { throw `key count ${ka.length} != ${kb.length}` }
        for (let i = 0; i < ka.length; i++) {
            if (ka[i] !== kb[i]) { throw `key ${ka[i]} != ${kb[i]}` }
            assertDeepEqual((a as any)[ka[i]], (b as any)[kb[i]])
        }
        return
    }
    throw `not deep-equal: ${String(a)} vs ${String(b)}`
}

export default {
    boolean: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof boolean>, boolean>>
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
            type _ = Assert<Equal<Ts<typeof number>, number>>
            assertOk(parse(number)(42))
        },
        error: () => {
            assertError(parse(number)('42'))
            assertError(parse(number)(42n))
        },
    },
    string: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof string>, string>>
            assertOk(parse(string)('hello'))
        },
        error: () => {
            assertError(parse(string)(42))
            assertError(parse(string)(null))
        },
    },
    bigint: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof bigint>, bigint>>
            assertOk(parse(bigint)(4n))
        },
        error: () => {
            assertError(parse(bigint)(4))
            assertError(parse(bigint)('4'))
        },
    },
    unknown: {
        ok: () => {
            type _ = Assert<Equal<Ts<typeof unknown>, DjsUnknown>>
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
            ok: () => assertOk(parse(42 as const)(42)),
            error: () => assertError(parse(42 as const)(43)),
        },
        string: {
            ok: () => assertOk(parse('hello' as const)('hello')),
            error: () => assertError(parse('hello' as const)('world')),
        },
        bigint: {
            ok: () => assertOk(parse(7n as const)(7n)),
            error: () => assertError(parse(7n as const)(8n)),
        },
        boolean: {
            ok: () => assertOk(parse(true as const)(true)),
            error: () => assertError(parse(true as const)(false)),
        },
        tuple: {
            ok: () => {
                const t = [42, 'hello'] as const
                const r = parse(t)([42, 'hello'])
                assertDeepEqual(unwrap(r), [42, 'hello'])
            },
            // The key behavior change vs `validate`: extra tuple elements are dropped.
            extraItemsDropped: () => {
                const r = parse([42] as const)([42, 'extra'])
                assertDeepEqual(unwrap(r), [42])
            },
            error: () => {
                assertError(parse([42] as const)([99]))
                assertError(parse([42] as const)({}))
            },
        },
        struct: {
            ok: () => {
                const t = { a: 42, b: 'hello' } as const
                const r = parse(t)({ a: 42, b: 'hello' })
                assertDeepEqual(unwrap(r), { a: 42, b: 'hello' })
            },
            // Undeclared properties are dropped from the constructed value.
            extraKeysDropped: () => {
                const r = parse({ a: 42 as const } as const)({ a: 42, b: 'extra' })
                assertDeepEqual(unwrap(r), { a: 42 })
            },
            error: () => {
                assertError(parse({ a: 42 } as const)({ a: 99 }))
                assertError(parse({ a: 42 } as const)([]))
            },
        },
    },
    array: {
        empty: () => {
            const r = parse(array(number))([])
            assertDeepEqual(unwrap(r), [])
        },
        ok: () => {
            const r = parse(array(number))([1, 2, 3])
            assertDeepEqual(unwrap(r), [1, 2, 3])
        },
        // `parse` always constructs a new array, even when the inner type is a primitive.
        freshArray: () => {
            const input = [1, 2, 3]
            const out = unwrap<readonly number[]>(parse(array(number))(input))
            if (out === input as unknown) { throw 'expected a fresh array' }
            assertDeepEqual(out, [1, 2, 3])
        },
        error: () => {
            assertError(parse(array(number))([1, 'two', 3]))
            assertError(parse(array(number))({}))
            assertError(parse(array(number))(null))
        },
        nested: () => {
            const r = parse(array(array(boolean)))([[true, false], [false]])
            assertDeepEqual(unwrap(r), [[true, false], [false]])
            assertError(parse(array(array(boolean)))([[true, 42]]))
        },
    },
    record: {
        empty: () => {
            const r = parse(record(number))({})
            assertDeepEqual(unwrap(r), {})
        },
        ok: () => {
            const r = parse(record(string))({ a: 'hello', b: 'world' })
            assertDeepEqual(unwrap(r), { a: 'hello', b: 'world' })
        },
        // `parse` always constructs a new record.
        freshRecord: () => {
            const input = { a: 1, b: 2 }
            const out = unwrap<Record<string, number>>(parse(record(number))(input))
            if (out === input as unknown) { throw 'expected a fresh record' }
            assertDeepEqual(out, { a: 1, b: 2 })
        },
        error: () => {
            assertError(parse(record(number))({ a: 1, b: 'two' }))
            assertError(parse(record(number))(null))
            assertError(parse(record(number))([]))
        },
    },
    constThunk: {
        primitive: () => {
            const t = () => ['const', 7n] as const
            assertOk(parse(t)(7n))
            assertError(parse(t)(8n))
        },
    },
    or: {
        consts: {
            ok: () => {
                const t = or(...[false, 42, 'hello'] as const)
                assertOk(parse(t)(false))
                assertOk(parse(t)(42))
                assertOk(parse(t)('hello'))
            },
            error: () => {
                const t = or(...[false, 42, 'hello'] as const)
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
            const t = or([number] as const, array(number))
            const out = unwrap<readonly number[]>(parse(t)([1, 2, 3]))
            // The const tuple `[number]` matches first and returns a length-1 result.
            assertDeepEqual(out, [1])
        },
        nested: {
            ok: () => {
                const inner = or(number, bigint)
                const t = or(inner, string)
                assertOk(parse(t)(42))
                assertOk(parse(t)(7n))
                assertOk(parse(t)('hi'))
            },
            error: () => {
                const inner = or(number, bigint)
                const t = or(inner, string)
                assertError(parse(t)(true))
                assertError(parse(t)(null))
            },
        },
        unknownVariant: {
            ok: () => {
                const t = or(number, unknown)
                assertOk(parse(t)(42))
                assertOk(parse(t)('hello'))
                assertOk(parse(t)(null))
                assertOk(parse(t)({}))
            },
        },
        manyTypes: {
            ok: () => {
                const t = or(boolean, number, string, bigint, undefined, null, array(number))
                assertOk(parse(t)(true))
                assertOk(parse(t)(42))
                assertOk(parse(t)('hi'))
                assertOk(parse(t)(7n))
                assertOk(parse(t)(undefined))
                assertOk(parse(t)(null))
                assertOk(parse(t)([1, 2]))
            },
            error: () => {
                const t = or(boolean, number, string, bigint, undefined, null)
                assertError(parse(t)({}))
                assertError(parse(t)([1]))
            },
        },
        objectShapes: {
            ok: () => {
                const t = or(array(number), record(string))
                assertOk(parse(t)([1, 2, 3]))
                assertOk(parse(t)({ a: 'x' }))
            },
            error: () => {
                const t = or(array(number), record(string))
                assertError(parse(t)(42))
                assertError(parse(t)(null))
            },
        },
        // Multiple variants in the same typeof bucket: first must fail before
        // the next is tried.
        sameBucket: {
            laterMatch: () => {
                const t = or(...[1, 2, 3] as const)
                assertOk(parse(t)(2))
                assertOk(parse(t)(3))
            },
            allFail: () => {
                const t = or(...[1, 2, 3] as const)
                assertError(parse(t)(4))
            },
        },
        // A `() => ['const', x]` thunk variant inside `or`: classification
        // recurses through the wrapped `Const`.
        constThunkVariant: {
            ok: () => {
                const t = or(() => ['const', 7n] as const, string)
                assertOk(parse(t)(7n))
                assertOk(parse(t)('hi'))
            },
            error: () => {
                const t = or(() => ['const', 7n] as const, string)
                assertError(parse(t)(8n))
                assertError(parse(t)(null))
            },
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
            parse([number, number] as const)([1, 'two'])
        ),
        structKey: () => assertErrorPath(['b'])(
            parse({ a: number, b: number } as const)({ a: 1, b: 'two' })
        ),
        deepStruct: () => {
            const schema = { user: { name: string, age: number } } as const
            const r = parse(schema)({ user: { name: 'A', age: 'old' } })
            assertErrorPath(['user', 'age'])(r)
        },
        recursiveSchema: () => {
            type A = readonly A[]
            const list = () => ['array', list] as const
            const r = parse(list)([[[42]] as unknown as A])
            assertErrorPath(['0', '0', '0'])(r)
        },
        orRoot: () => assertErrorPath([])(parse(or(number, string))(true)),
    },
    recursive: {
        arrayOfArrays: () => {
            type A = readonly A[]
            const list = () => ['array', list] as const
            type _A = Assert<Equal<A, Ts<typeof list>>>
            const v = parse(list)
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
            const v = parse(tree)
            assertOk(v({}))
            assertOk(v({ a: {}, b: { c: {} } }))
            assertError(v({ a: 42 }))
        },
    },
}
