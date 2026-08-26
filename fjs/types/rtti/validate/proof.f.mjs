/**
 * @import { ValidationError, ValidateE, Validate } from '../common/types.ts'
 * @import { Type } from '../types.ts'
 * @import { Equal } from '../../ts/types.ts'
 * @import { Ts, Unknown } from '../ts/types.ts'
 * @import { Unknown as DjsUnknown } from '../../../djs/types.ts'
 * @import { Assert } from '../../../asserts/types.ts'
 */

import { validate } from './module.f.mjs'
import { parse } from '../parse/module.f.mjs'
import { toData, validate as dataValidate } from '../data/module.f.mjs'
import { boolean, number, string, bigint, unknown, array, close, record, or, option } from '../module.f.mjs'
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
 * The acceptance table. Rows cover both container kinds, openness and
 * closedness on both, the short-array rule, primitives, `or`, and misses —
 * every reader of a schema has to answer them the same way.
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
    // the rule is per position, not "the last one": every trailing position
    // whose set admits `undefined` may be absent, so an array may stop at the
    // last required one
    [[number, bigint, option(string), option(null)], [2, 4n]],
    [[number, bigint, option(string), option(null)], [2, 4n, 'x']],
    [[number, bigint, option(string), option(null)], [2, 4n, 'x', null]],
    [[number, bigint, option(string), option(null)], [2]],
    [[number, bigint, option(string), option(null)], [2, 4n, 5]],
    [[/** @type {const} */ (42)], []],
    [{ a: number, b: option(string) }, { a: 1 }],
    [{ a: number }, { a: 'one' }],
    // a hole in a tuple schema is a declared position whose schema is
    // `undefined`, so the schema's length is what it declares — the reading
    // the data form has always had, and the one `Object.entries` lost
    [new Array(1), [1, 2, 3]],
    [new Array(1), [undefined]],
    [new Array(1), []],
    [[, number], [9, 5]],
    [[, number], [undefined, 5]],
    // and a non-index enumerable own property is no position at all: a tuple
    // schema is read by index, so `foo` was declared and then matched against
    // `value[NaN]`, which no ordinary value carries
    [Object.assign([number], { foo: string }), [1]],
    [Object.assign([number], { foo: string }), Object.assign([1], { foo: 'x' })],
    // the closed counterparts of the four openness rows, and the rest
    [close([number]), [42]],
    [close([number]), [42, 'extra']],
    [close([number]), [42, ,]],
    [close([number]), Object.assign([42], { foo: 1 })],
    [close([number]), []],
    [close(new Array(1)), new Array(1)],
    [close(new Array(1)), [undefined]],
    [close(new Array(1)), [1]],
    [close([number, option(string)]), [42]],
    [close({ a: number }), { a: 1 }],
    [close({ a: number }), { a: 1, b: 'x' }],
    // a key declared `unknown` is a member the schema has, so the canonical
    // form must not drop it the way an open struct's is dropped
    [close({ a: unknown }), { a: 1 }],
    [close({ a: unknown }), { a: 1, b: 2 }],
    [close([number], string), [1, 'x', 'y']],
    [close([number], string), [1, 2]],
    [close({ a: number }, string), { a: 1, b: 'x' }],
    [close({ a: number }, string), { a: 1, b: 2 }],
    // an unconstrained rest is the open form again
    [close([number], unknown), [1, 'x']],
    [close({ a: number }, unknown), { a: 1, b: 'x' }],
    [close([]), []],
    [close([]), [1]],
    [close({}), {}],
    [close({}), { a: 1 }],
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
    // The two proofs above compare the readers with one another, so a
    // regression all three shared would pass them both. The table's rows for
    // a schema with several optional positions therefore carry their expected
    // answer here as well.
    //
    // The rule is *per position*, not "the last one": a position is required
    // exactly when its set excludes `undefined`, independently of the others.
    // A dense prefix alone would only show that an optional *suffix* may be
    // truncated, so the cases below also omit position 2 while position 3 is
    // present, and omit a required position with everything after it present.
    //
    // Every case runs against the closed form too. `close` is a separate
    // reader on all three — `closeContainerValidate`/`closeContainerParse`,
    // and its own conversion in the data form — and it narrows *which values
    // are members*, not which positions are required, so it must answer these
    // identically. The one case where closing does change the answer is at the
    // end.
    optionalPositions: () => {
        const t = /** @type {const} */ ([number, bigint, option(string), option(null)])
        /** @type {(rtti: Type) => (check: (r: readonly [string, unknown]) => void) => (value: Unknown) => void} */
        const every = rtti =>
            check =>
                value => {
                    for (const read of [v, p, d]) { check(read(rtti)(value)) }
                }
        for (const rtti of [t, close(t)]) {
            const accepted = every(rtti)(assertOk)
            const rejected = every(rtti)(assertError)
            accepted([2, 4n])                  // stops at the last required position
            accepted([2, 4n, 'x'])             // the first optional present
            accepted([2, 4n, 'x', null])       // both present
            // Omission is independent, not just truncation: an absent member
            // reads as `undefined` wherever it sits, so position 2 may be
            // missing while position 3 is present. A hole and an explicit
            // `undefined` are the same value, so both spellings are accepted.
            accepted([2, 4n, , null])          //< a hole at position 2
            accepted([2, 4n, undefined, null]) //< the same value, spelled densely
            rejected([2])                      // `bigint` excludes `undefined`
            rejected([2, 4n, 5])               // an optional that is present is still checked
            // The mirror of the two rows above: `bigint` excludes `undefined`,
            // so omitting position 1 fails however much of the rest is present.
            rejected([2, , 'x', null])         //< a hole at position 1
        }
        // What closing does change: an element past the declared positions is
        // a member of the open set and not of the closed one.
        const extra = /** @type {const} */ ([2, 4n, 'x', null, 'extra'])
        every(t)(assertOk)(extra)
        every(close(t))(assertError)(extra)
        // How stopping short composes with running long: the two rules are
        // independent, so the open form's accepted lengths run from the last
        // required position upwards without a gap or a cap — 2, 3, 4, 5, and
        // on. `close` caps the top at the declared count and leaves the bottom
        // where it is.
        every(t)(assertOk)([2, 4n, 'x', null, 'a', 'b'])
    },
    // An interior omittable position may be absent with a *required* position
    // after it, which is the sharpest witness that absence is per position
    // rather than truncation: `optionalPositions`'s hole is followed by
    // another omittable position, so it cannot say this. Absence is also
    // positional, not a shift — `[, 5]` holds `5` at position 1 and is
    // accepted, while `[5]` holds it at position 0 and is not.
    interiorOptionBeforeRequired: () => {
        const t = /** @type {const} */ ([option(string), number])
        /** @type {(check: (r: readonly [string, unknown]) => void) => (value: Unknown) => void} */
        const every = check =>
            value => {
                for (const read of [v, p, d]) { check(read(t)(value)) }
            }
        every(assertOk)([, 5])          //< a hole at position 0
        every(assertOk)([undefined, 5]) //< the same value, spelled densely
        every(assertOk)(['x', 5])
        every(assertError)([5])         //< `number` at position 1 is required
    },
    // The two tables above pin that the three readers *agree*; these pin what
    // they agree on, which is what the changelog entry claims.
    sparseTuple: {
        holeIsDeclaredUndefined: () => {
            assertError(validate([, number])([9, 5]))
            assertOk(validate([, number])([undefined, 5]))
            assertError(validate(new Array(1))([1, 2, 3]))
            assertOk(validate(new Array(1))([undefined]))
        },
        // A hole is a position, so a closed sparse schema is as long as it
        // looks: `declared.length` is the schema's length, not its key count.
        closedArityIsTheSchemaLength: () => {
            assertOk(validate(close(new Array(1)))([undefined]))
            assertError(validate(close(new Array(1)))([1]))
        },
        nonIndexPropertyIsNotDeclared: () => {
            const schema = Object.assign([number], { foo: string })
            assertOk(validate(schema)([1]))
            assertOk(validate(schema)(Object.assign([1], { foo: 'x' })))
            assertError(validate(schema)(['x']))
        },
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
            ok: () => assertOk(validate(42)(42)),
            error: () => assertError(validate(42)(43)),
        },
        nan: {
            ok: () => assertOk(validate(NaN)(NaN)),
            error: () => {
                assertError(validate(NaN)(0))
                assertError(validate(0)(NaN))
                assertError(validate(42)(NaN))
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
                assertError(validate(0)(-0))
                assertError(validate(-0)(0))
            },
            self: () => {
                assertOk(validate(0)(0))
                assertOk(validate(-0)(-0))
            },
        },
        string: {
            ok: () => assertOk(validate('hello')('hello')),
            error: () => assertError(validate('hello')('world')),
        },
        bigint: {
            ok: () => assertOk(validate(7n)(7n)),
            error: () => assertError(validate(7n)(8n)),
        },
        boolean: {
            ok: () => assertOk(validate(true)(true)),
            error: () => assertError(validate(true)(false)),
        },
        tuple: {
            ok: () => assertStructurallySame(
                unwrap(validate([42, 'hello'])([42, 'hello'])), [42, 'hello']),
            // A tuple is OPEN, and the extras are still there afterwards. This
            // is deliberate — see "Structs and tuples are open" in
            // ../README.md. Do not restore #1622's length check on the
            // strength of `Ts<readonly [42]>` being an exact tuple; that
            // mapping is exact only because TypeScript could not express the
            // open one (see ../ts/types.ts `TupleTs`).
            extraItemsAcceptedAndKept: () => {
                const long = [42, 1, 2, 3]
                assert(Object.is(unwrap(validate([42])(long)), long),
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
            empty: () => assertOk(validate([])([])),
            error: () => {
                assertError(validate([42])([99]))
                assertError(validate([42])({}))
                // `42` excludes `undefined`, so position 0 is required.
                assertError(validate([42])([]))
            },
        },
        struct: {
            // `validate` takes a `const` type parameter, so a struct literal
            // keeps its literal members without an `@type {const}` cast at the
            // call site: this is a reader for `{ a: 42, b: 'hello' }`, not for
            // `{ a: number, b: string }`. Dropping the modifier is what makes
            // the assertion fail.
            ok: () => {
                const v = validate({ a: 42, b: 'hello' })
                /** @typedef {Assert<Equal<typeof v, Validate<{ readonly a: 42, readonly b: 'hello' }>>>} _ConstParameter */
                assertStructurallySame(unwrap(v({ a: 42, b: 'hello' })), { a: 42, b: 'hello' })
            },
            error: () => {
                assertError(validate({ a: 42 })({ a: 99 }))
                assertError(validate({ a: 42 })([]))
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
                const t = or(false, 42, 'hello')
                assertOk(validate(t)(false))
                assertOk(validate(t)(42))
                assertOk(validate(t)('hello'))
            },
            error: () => {
                const t = or(false, 42, 'hello')
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
            const t = or([number], array(number))
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
            validate([number, number])([1, 'two'])
        ),
        structKey: () => assertErrorPath(['b'])(
            validate({ a: number, b: number })({ a: 1, b: 'two' })
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
    // Closedness narrows acceptance and nothing else: a success still carries
    // the very value it was given. The acceptance half is in the table above,
    // run through all three readers; what is left to pin here is that
    // `validate` stays verbatim on the new form too.
    close: {
        verbatim: () => {
            const value = [1, 'x', 'y']
            assert(Object.is(unwrap(validate(close([number], string))(value)), value),
                'the value comes back as it went in')
            const struct = { a: 1, b: 'x' }
            assert(Object.is(unwrap(validate(close({ a: number }, string))(struct)), struct),
                'and so does an object with rest-matching keys')
        },
        // An absent optional member still stays absent — closing a container
        // says nothing about a member it declares.
        absentOptionalStaysAbsent: () => {
            const out = unwrap(validate(close({ a: number, b: option(string) }))({ a: 1 }))
            assert(!('b' in out), 'an absent optional member must stay absent')
        },
        path: () => {
            assertErrorPath(['1'])(validate(close([number, number]))([1, 'two']))
            assertErrorPath(['b'])(validate(close({ a: number }, string))({ a: 1, b: 2 }))
            // The rejection of an undeclared member is about the container, so
            // it is reported at the container.
            assertErrorPath([])(validate(close({ a: number }))({ a: 1, b: 2 }))
        },
        notAContainer: () => {
            assertError(validate(close([number]))({}))
            assertError(validate(close({ a: number }))([]))
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
