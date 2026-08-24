/**
 * @import { ValidationError, ValidateE } from '../common/types.ts'
 * @import { Type } from '../types.ts'
 * @import { Equal } from '../../ts/types.ts'
 * @import { Ts, Unknown } from '../ts/types.ts'
 * @import { Unknown as DjsUnknown } from '../../../djs/types.ts'
 * @import { Assert } from '../../../asserts/types.ts'
 */

import { validate } from './module.f.mjs'
import { parse } from '../parse/module.f.mjs'
import { toData, validate as dataValidate } from '../data/module.f.mjs'
import { boolean, number, string, bigint, unknown, array, record, or, option } from '../module.f.mjs'
import { unwrap } from '../../result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @type {(r: readonly [string, unknown]) => void} */
const assertOk = ([k]) => { assertEq(k, 'ok', 'expected ok') }

/** @type {(r: readonly [string, unknown]) => void} */
const assertError = ([k]) => { assertEq(k, 'error', 'expected error') }

/** @type {(expected: readonly string[]) => (r: readonly [string, unknown]) => void} */
const assertErrorPath = expected =>
    r => {
        assert(r[0] === 'error', 'expected error')
        const e = /** @type {ValidationError} */ (r[1])
        assertStructurallySame(e.path, expected, 'unexpected error path')
    }

/** Both readers with their payload type erased, so a table can hold rows of mixed schemas. */

/** @type {(t: Type) => ValidateE} */
const v = t => /** @type {any} */ (validate(t))

/** @type {(t: Type) => ValidateE} */
const p = t => /** @type {any} */ (parse(t))

/** The data form's reader, over the same erased signature. */
/** @type {(t: Type) => ValidateE} */
const d = t => dataValidate(toData(t))

/**
 * The acceptance table. Rows cover both container kinds, openness on both,
 * the short-array rule, primitives, `or`, and misses — every reader of a
 * schema has to answer them the same way.
 *
 * @type {readonly (readonly [Type, Unknown])[]}
 */
const rows = [
    [number, 42],
    [number, '42'],
    [string, 42],
    [boolean, false],
    [bigint, 7n],
    [unknown, { a: [1, 'x'] }],
    [/** @type {const} */ (42), 42],
    [/** @type {const} */ (42), 43],
    [array(number), [1, 2, 3]],
    [array(number), [1, 'two']],
    [array(number), {}],
    // an enumerable non-index key is an entry every reader walks, so it is
    // held to the element type like any other — and a key is an index only in
    // the canonical spelling, whatever `Number` makes of it
    [array(number), Object.assign([1], { foo: 2 })],
    [array(number), Object.assign([1], { foo: 'x' })],
    [array(number), Object.assign([1], { '-1': 'x' })],
    [array(number), Object.assign([1], { '01': 'x' })],
    [record(number), { a: 1 }],
    [record(number), { a: 'one' }],
    [record(number), []],
    // the four openness rows
    [[/** @type {const} */ (42)], [42, 'extra']],
    [{ a: /** @type {const} */ (42) }, { a: 42, b: 'x' }],
    [[number, option(string)], [42]],
    [[/** @type {const} */ (42)], []],
    [{ a: number, b: option(string) }, { a: 1 }],
    [{ a: number }, { a: 'one' }],
    [or(number, string), true],
    [or(number, string), 'hello'],
    [option(number), undefined],
    [option(number), null],
    [{ user: { name: string, age: number } }, { user: { name: 'A', age: 'old' } }],
]

export const proof = {
    // ── the three properties this module exists for ──────────────────────────
    //
    // `parse` rebuilds: it materializes a declared-but-absent member as
    // `undefined`, drops an undeclared one, and returns a new object. For a
    // caller whose value is a document whose bytes are its identity — a
    // content-addressed store, a signed payload — each of those is a
    // different document. `validate` answers the same question about the
    // value it was handed and hands it back.
    verbatim: {
        // An absent optional member stays absent. `'b' in out` is the
        // assertion, not `out.b === undefined`: `parse` satisfies the latter.
        absentOptionalStaysAbsent: () => {
            const schema = { a: number, b: option(string) }
            const input = { a: 1 }
            const out = unwrap(validate(schema)(input))
            assert(!('b' in out), 'an absent optional member must stay absent')
            // The contrast that motivates the module.
            assert('b' in unwrap(parse(schema)(input)), 'parse materializes it')
        },
        // An undeclared member survives. `parse` accepts it too — structs and
        // tuples are open — but does not carry it into what it builds.
        undeclaredMemberSurvives: () => {
            const schema = { a: number }
            const struct = { a: 1, b: 'extra' }
            assertStructurallySame(unwrap(validate(schema)(struct)), { a: 1, b: 'extra' })
            assert(!('b' in unwrap(parse(schema)(struct))), 'parse drops it')
            // The same on the other kind: a longer array keeps its tail.
            const tuple = [1, 'extra']
            assertStructurallySame(unwrap(validate([number])(tuple)), [1, 'extra'])
        },
        // On success the result *is* the argument. This is the property the
        // other two follow from, and the mirror of `../parse/proof.f.mjs`'s
        // `freshArray` / `freshRecord`.
        referenceIdentity: () => {
            /** @type {(t: Type, value: Unknown) => void} */
            const same = (t, value) => {
                const r = v(t)(value)
                assert(r[0] === 'ok', 'expected ok')
                assert(Object.is(r[1], value), 'expected the original value')
            }
            const arr = [1, 2, 3]
            same(array(number), arr)
            same([number, number, number], arr)
            same(unknown, arr)
            const obj = { a: 1, b: 2 }
            same(record(number), obj)
            same({ a: number }, obj)
            same(or(string, record(number)), obj)
            const nested = { xs: [{ a: 1 }] }
            same({ xs: array({ a: number }) }, nested)
            assert(Object.is(unwrap(validate({ xs: array({ a: number }) })(nested)).xs, nested.xs),
                'nested containers are not rebuilt either')
        },
    },
    // Acceptance is `parse`'s, exactly: the two readers differ in what a
    // success carries and in nothing else.
    sameAcceptanceAsParse: () => {
        for (const [t, value] of rows) {
            const rv = v(t)(value)
            const rp = p(t)(value)
            assertEq(rv[0], rp[0], 'validate and parse must agree on acceptance')
            if (rv[0] === 'error') {
                assert(rp[0] === 'error', 'expected error')
                assertStructurallySame(rv[1], rp[1], 'the two readers report the same error')
            }
        }
    },
    // The same table against the third reader, the data form's — the one that
    // consumes `toData` output rather than the thunk graph. A schema denotes
    // one set of values, so a conversion that changed which values a schema
    // admits would be a bug in `toData`, and this is where it shows up: an
    // open tuple whose data form was exact-length passed every row above and
    // still disagreed here. Acceptance only: the data form reaches a value
    // through the canonical union rather than through the schema's syntax, so
    // it reports a miss as its own kind-wise failure rather than repeating
    // `or`'s `no match`.
    sameAcceptanceInTheDataForm: () => {
        for (const [t, value] of rows) {
            assertEq(d(t)(value)[0], p(t)(value)[0], 'the data form must accept what `parse` accepts')
        }
    },
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
            ok: () => assertOk(validate(/** @type {const} */ (42))(42)),
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
            ok: () => assertOk(validate(/** @type {const} */ ('hello'))('hello')),
            error: () => assertError(validate(/** @type {const} */ ('hello'))('world')),
        },
        bigint: {
            ok: () => assertOk(validate(/** @type {const} */ (7n))(7n)),
            error: () => assertError(validate(/** @type {const} */ (7n))(8n)),
        },
        boolean: {
            ok: () => assertOk(validate(/** @type {const} */ (true))(true)),
            error: () => assertError(validate(/** @type {const} */ (true))(false)),
        },
        tuple: {
            ok: () => {
                const t = /** @type {const} */ ([42, 'hello'])
                assertStructurallySame(unwrap(validate(t)([42, 'hello'])), [42, 'hello'])
            },
            // A tuple is OPEN, and the extras are still there afterwards. This
            // is deliberate — see "Structs and tuples are open" in
            // ../README.md. Do not restore #1622's length check on the
            // strength of `Ts<readonly [42]>` being an exact tuple; that
            // mapping is exact only because TypeScript could not express the
            // open one (see ../ts/types.ts `TupleTs`).
            extraItemsAcceptedAndKept: () => {
                const long = [42, 1, 2, 3]
                assert(Object.is(unwrap(validate(/** @type {const} */ ([42]))(long)), long),
                    'the longer array comes back as it went in')
            },
            // An absent member reads as `undefined`, so a position is required
            // exactly when its set excludes `undefined` — and nothing is
            // filled in, so the array keeps its length.
            shortArrayKeepsItsLength: () => {
                const short = [42]
                const out = unwrap(validate([number, option(string)])(short))
                assert(Object.is(out, short), 'expected the original array')
                assertEq(short.length, 1, 'no gap is filled')
            },
            empty: () => assertOk(validate(/** @type {const} */ ([]))([])),
            error: () => {
                assertError(validate(/** @type {const} */ ([42]))([99]))
                assertError(validate(/** @type {const} */ ([42]))({}))
                // `42` excludes `undefined`, so position 0 is required.
                assertError(validate(/** @type {const} */ ([42]))([]))
            },
        },
        struct: {
            ok: () => {
                const t = /** @type {const} */ ({ a: 42, b: 'hello' })
                assertStructurallySame(unwrap(validate(t)({ a: 42, b: 'hello' })), { a: 42, b: 'hello' })
            },
            error: () => {
                assertError(validate(/** @type {const} */ ({ a: 42 }))({ a: 99 }))
                assertError(validate(/** @type {const} */ ({ a: 42 }))([]))
            },
        },
    },
    array: {
        empty: () => {
            const input = /** @type {readonly number[]} */ ([])
            assert(Object.is(unwrap(validate(array(number))(input)), input), 'expected the original array')
        },
        ok: () => assertStructurallySame(unwrap(validate(array(number))([1, 2, 3])), [1, 2, 3]),
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
        empty: () => {
            const input = /** @type {{ readonly[K in string]?: number }} */ ({})
            assert(Object.is(unwrap(validate(record(number))(input)), input), 'expected the original record')
        },
        ok: () => assertStructurallySame(
            unwrap(validate(record(string))({ a: 'hello', b: 'world' })),
            { a: 'hello', b: 'world' },
        ),
        error: () => {
            assertError(validate(record(number))({ a: 1, b: 'two' }))
            assertError(validate(record(number))(null))
            assertError(validate(record(number))([]))
        },
    },
    constThunk: {
        primitive: () => {
            const t = () => /** @type {const} */ (['const', 7n])
            assertOk(validate(t)(7n))
            assertError(validate(t)(8n))
        },
    },
    or: {
        consts: {
            ok: () => {
                const t = or(.../** @type {const} */ ([false, 42, 'hello']))
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
                assertOk(validate(t)(42))
                assertOk(validate(t)('hello'))
            },
            error: () => {
                const t = or(number, string)
                assertError(validate(t)(true))
                assertError(validate(t)(null))
            },
        },
        // The first matching variant wins, and it returns the value itself —
        // so, unlike `parse`, which variant matched is not observable in the
        // result. `parse` here returns a length-1 array; `validate` returns
        // the length-3 one it was given.
        firstMatchWins: () => {
            const t = or(/** @type {const} */ ([number]), array(number))
            const input = [1, 2, 3]
            assert(Object.is(unwrap(validate(t)(input)), input), 'expected the original array')
            assertStructurallySame(unwrap(parse(t)(input)), [1])
        },
    },
    option: {
        ok: () => {
            const t = option(number)
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
        recordKey: () => assertErrorPath(['b'])(validate(record(number))({ a: 1, b: 'two', c: 3 })),
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
            assertErrorPath(['user', 'age'])(validate(schema)({ user: { name: 'A', age: 'old' } }))
        },
        recursiveSchema: () => {
            /** @typedef {readonly _A[]} _A */
            const list = () => /** @type {const} */ (['array', list])
            const r = validate(list)([/** @type {_A} */ (/** @type {unknown} */ ([[42]]))])
            assertErrorPath(['0', '0', '0'])(r)
        },
        orRoot: () => assertErrorPath([])(validate(or(number, string))(true)),
    },
    recursive: {
        arrayOfArrays: () => {
            /** @typedef {readonly _A[]} _A */
            const list = () => /** @type {const} */ (['array', list])
            /** @typedef {Assert<Equal<_A, Ts<typeof list>>>} _ListRoundTrip */
            const x = validate(list)
            assertOk(x([]))
            assertOk(x([[], []]))
            assertOk(x([[[], []], []]))
            assertError(x([42]))
            assertError(x(null))
        },
        recordOfRecords: () => {
            const tree = () => /** @type {const} */ (['record', tree])
            /** @typedef {{ readonly[K in string]?: _A }} _A */
            /** @typedef {Assert<Equal<_A, Ts<typeof tree>>>} _TreeRoundTrip */
            const x = validate(tree)
            assertOk(x({}))
            assertOk(x({ a: {}, b: { c: {} } }))
            assertError(x({ a: 42 }))
        },
    },
    arrayOptional: () => {
        const a = /** @type {const} */([number, option(string)])
        const v = validate(a)
        assertOk(v([5]))
        assertError(v(["n"]))
        assertOk(v([6, "3"]))
        assertError(v([6, 9]))
    }
}
