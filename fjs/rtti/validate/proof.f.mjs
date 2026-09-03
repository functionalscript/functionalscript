/**
 * @import { ValidationError, ValidateE, Validate } from '../common/types.ts'
 * @import { Type } from '../types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Ts, Unknown } from '../ts/types.ts'
 * @import { Unknown as DjsUnknown } from '../../djs/types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 */

import { validate } from './module.f.mjs'
import { parse } from '../parse/module.f.mjs'
import { toData, validate as dataValidate } from '../data/module.f.mjs'
import { boolean, number, string, bigint, unknown, array, never, open, record, rest, or, option } from '../module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

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
 * The acceptance table. Rows cover both container kinds, the closed default
 * and a stated rest on both, the short-array rule, primitives, `or`, and
 * misses — every reader of a schema has to answer them the same way. Built by
 * a thunk so the recursive schemas it needs can carry function-local typedefs.
 *
 * @type {() => readonly (readonly [Type, Unknown])[]}
 */
const rows = () => {
    /**
     * A rest that is its own container, so nothing about it is inline: the
     * conversion keeps `rest: "recursiveRest"` rather than recognizing that no
     * finite array inhabits it, and every reader accepts a hole past the prefix
     * accordingly. It is one of the two rests {@link emptyRests} must *not*
     * recognize.
     *
     * @typedef {() => readonly ['rest', readonly [_RecursiveRest], typeof never]} _RecursiveRest
     */

    /** @type {_RecursiveRest} */
    const recursiveRest = () => ['rest', [recursiveRest], never]

    /**
     * The other one: a pure `or` cycle. `toData(orCycleA)` **is** `never`, yet as a
     * rest it converts to a reference and stays, so a test on the rest's own
     * canonical data would answer the opposite of the criterion.
     *
     * @typedef {() => readonly ['or', _OrCycleB]} _OrCycleA
     * @typedef {() => readonly ['or', _OrCycleA]} _OrCycleB
     */

    /** @type {_OrCycleA} */
    const orCycleA = () => ['or', orCycleB]

    /** @type {_OrCycleB} */
    const orCycleB = () => ['or', orCycleA]

    /**
     * Two separately constructed copies of one recursive rule. Converting a rest
     * reserves its rule name first, so the container's copy is named `r0` where
     * converting the container alone names it `r` — which is what rules `equal`
     * out as the comparison behind {@link emptyRests}.
     *
     * @typedef {() => readonly ['or', undefined, () => readonly ['array', _SelfList]]} _SelfList
     */

    /** @type {_SelfList} */
    const selfList0 = () => ['or', undefined, array(selfList0)]

    /** @type {_SelfList} */
    const selfList1 = () => ['or', undefined, array(selfList1)]

    return [
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
        // an empty element set is the empty array, not "any number of holes": the
        // data form normalizes such a rest away, which leaves the exact-length
        // pattern, and the thunk readers bound the length to match
        [array(or()), []],
        [array(or()), new Array(1)],
        [array(number), [, ,]],
        [record(number), { a: 1 }],
        [record(number), { a: 'one' }],
        [record(number), []],
        // the closed default, on both kinds
        [[/** @type {const} */ (42)], [42, 'extra']],
        [[/** @type {const} */ (42)], [42]],
        [[/** @type {const} */ (42)], [42, undefined]],
        [[/** @type {const} */ (42)], [42, ,]],
        [[/** @type {const} */ (42)], Object.assign([42], { foo: 1 })],
        [[/** @type {const} */ (42)], []],
        [{ a: /** @type {const} */ (42) }, { a: 42, b: 'x' }],
        [{ a: /** @type {const} */ (42) }, { a: 42 }],
        // a key declared `unknown` is a member the schema has, so the canonical
        // form must not drop it the way an `open` struct's is dropped — and one
        // that must be *present*, `unknown` excluding absence
        [{ a: unknown }, { a: 1 }],
        [{ a: unknown }, { a: 1, b: 2 }],
        [{ a: unknown }, {}],
        // the declared-member top — anything, or nothing — is still closed over
        // its undeclared keys
        [{ a: or(option, unknown) }, {}],
        [{ a: or(option, unknown) }, { a: 1 }],
        [{ a: or(option, unknown) }, { a: 1, b: 2 }],
        // and the same rows under `open`, which is the form that admits them
        [open([/** @type {const} */ (42)]), [42, 'extra']],
        [open({ a: /** @type {const} */ (42) }), { a: 42, b: 'x' }],
        [open([]), [1]],
        [open({}), { a: 1 }],
        // closedness is about *undeclared* members and leaves the short-array rule
        // alone
        [[number, or(option, string)], [42]],
        // the rule is per position, not "the last one": every trailing position
        // whose set admits `undefined` may be absent, so an array may stop at the
        // last required one
        [[number, bigint, or(option, string), or(option, null)], [2, 4n]],
        [[number, bigint, or(option, string), or(option, null)], [2, 4n, 'x']],
        [[number, bigint, or(option, string), or(option, null)], [2, 4n, 'x', null]],
        [[number, bigint, or(option, string), or(option, null)], [2]],
        [[number, bigint, or(option, string), or(option, null)], [2, 4n, 5]],
        [{ a: number, b: or(option, string) }, { a: 1 }],
        [{ a: number }, { a: 'one' }],
        // a hole in a tuple schema is a declared position whose schema is
        // `undefined`, so the schema's length is what it declares — the reading
        // the data form has always had, and the one `Object.entries` lost
        [new Array(1), [1, 2, 3]],
        [new Array(1), new Array(1)],
        [new Array(1), [undefined]],
        [new Array(1), [1]],
        [new Array(1), []],
        [[, number], [9, 5]],
        [[, number], [undefined, 5]],
        // and a non-index enumerable own property is no position at all: a tuple
        // schema is read by index, so `foo` declares nothing — which leaves a
        // value's own `foo` an undeclared member like any other
        [Object.assign([number], { foo: string }), [1]],
        [Object.assign([number], { foo: string }), Object.assign([1], { foo: 'x' })],
        [open(Object.assign([number], { foo: string })), Object.assign([1], { foo: 'x' })],
        // a stated rest: what an undeclared member must be
        [rest([number], string), [1, 'x', 'y']],
        [rest([number], string), [1, 2]],
        // a hole past the prefix is no member, so it meets no rest — which is what
        // the `| undefined` in the rendered tail says
        [rest([number], string), [1, ,]],
        [rest({ a: number }, string), { a: 1, b: 'x' }],
        [rest({ a: number }, string), { a: 1, b: 2 }],
        // a stated rest with nothing to answer for: the struct kind has no length,
        // so it fits whatever the rest is
        [rest({ a: number }, string), { a: 1 }],
        // an unconstrained rest is `open`
        [rest([number], unknown), [1, 'x']],
        [rest({ a: number }, unknown), { a: 1, b: 'x' }],
        // an empty one is the bare form, so the length is bounded again
        [rest([number], never), [1, ,]],
        [rest([number], or()), [1, ,]],
        [rest([number], [or()]), [1, ,]],
        [rest([number], [or()]), [1, 2]],
        // …and a rest the conversion keeps is not empty, however few values it
        // has: these two are the pair that tells the criterion from an emptiness
        // analysis
        [rest([number], recursiveRest), [1, ,]],
        [rest([number], orCycleA), [1, ,]],
        [rest([selfList0], [selfList1, never]), [undefined, ,]],
        [or(number, string), true],
        [or(number, string), 'hello'],
        [or(option, number), undefined],
        [or(option, number), null],
        [{ user: { name: string, age: number } }, { user: { name: 'A', age: 'old' } }],
    ]
}

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
        // An absent optional member stays absent — on both readers, absence
        // being a member of the set rather than a spelling of `undefined`:
        // `parse` omits it from what it builds instead of materializing it.
        absentOptionalStaysAbsent: () => {
            const schema = { a: number, b: or(option, string) }
            const input = { a: 1 }
            const out = unwrap(validate(schema)(input))
            assert(!('b' in out), 'an absent optional member must stay absent')
            assert(!('b' in unwrap(parse(schema)(input))), 'parse omits it too')
        },
        // An undeclared member survives — where the schema admits one at all.
        // `parse` accepts the same values and does not carry the member into
        // what it builds.
        undeclaredMemberSurvives: () => {
            const schema = open({ a: number })
            const struct = { a: 1, b: 'extra' }
            assertStructurallySame(unwrap(validate(schema)(struct)), { a: 1, b: 'extra' })
            assert(!('b' in unwrap(parse(schema)(struct))), 'parse drops it')
            // The same on the other kind: a longer array keeps its tail.
            const tuple = [1, 'extra']
            assertStructurallySame(unwrap(validate(open([number]))(tuple)), [1, 'extra'])
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
            same({ a: number, b: number }, obj)
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
        for (const [t, value] of rows()) {
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
        for (const [t, value] of rows()) {
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
    // Every case runs against the `open` form too. A stated rest is a separate
    // reader on all three — `restContainerValidate`/`restContainerParse`, and
    // its own conversion in the data form — and it widens *which values are
    // members*, not which positions are required, so it must answer these
    // identically. The one case where opening does change the answer is at the
    // end.
    optionalPositions: () => {
        const t = /** @type {const} */ ([number, bigint, or(option, string), or(option, null)])
        /** @type {(rtti: Type) => (check: (r: readonly [string, unknown]) => void) => (value: Unknown) => void} */
        const every = rtti =>
            check =>
                value => {
                    for (const read of [v, p, d]) { check(read(rtti)(value)) }
                }
        for (const rtti of [t, open(t)]) {
            const accepted = every(rtti)(assertOk)
            const rejected = every(rtti)(assertError)
            accepted([2, 4n])                  // stops at the last required position
            accepted([2, 4n, 'x'])             // the first optional present
            accepted([2, 4n, 'x', null])       // both present
            // Omission is independent, not just truncation: a member is
            // absent wherever its index is missing, so position 2 may be
            // missing while position 3 is present.
            accepted([2, 4n, , null])          //< a hole at position 2
            // A present `undefined` is a value, not a spelling of absence:
            // `or(option, string)` admits the hole above and rejects this.
            rejected([2, 4n, undefined, null])
            rejected([2])                      // `bigint` excludes absence
            rejected([2, 4n, 5])               // an optional that is present is still checked
            // The mirror of the rows above: `bigint` excludes absence, so
            // omitting position 1 fails however much of the rest is present.
            rejected([2, , 'x', null])         //< a hole at position 1
        }
        // What opening does change: an element past the declared positions is
        // a member of the open set and not of the bare, closed one.
        const extra = /** @type {const} */ ([2, 4n, 'x', null, 'extra'])
        every(t)(assertError)(extra)
        every(open(t))(assertOk)(extra)
        // How stopping short composes with running long: the two rules are
        // independent, so the open form's accepted lengths run from the last
        // required position upwards without a gap or a cap — 2, 3, 4, 5, and
        // on. The bare form caps the top at the declared count and leaves the
        // bottom where it is.
        every(open(t))(assertOk)([2, 4n, 'x', null, 'a', 'b'])
    },
    // An interior omittable position may be absent with a *required* position
    // after it, which is the sharpest witness that absence is per position
    // rather than truncation: `optionalPositions`'s hole is followed by
    // another omittable position, so it cannot say this. Absence is also
    // positional, not a shift — `[, 5]` holds `5` at position 1 and is
    // accepted, while `[5]` holds it at position 0 and is not.
    interiorOptionBeforeRequired: () => {
        const t = /** @type {const} */ ([or(option, string), number])
        /** @type {(rtti: Type) => (check: (r: readonly [string, unknown]) => void) => (value: Unknown) => void} */
        const every = rtti =>
            check =>
                value => {
                    for (const read of [v, p, d]) { check(read(rtti)(value)) }
                }
        // Open too, for the reason `optionalPositions` runs both: a stated
        // rest is its own reader on all three, and this schema is not one of
        // the shapes the trailing-option cases there already put through it.
        for (const rtti of [t, open(t)]) {
            every(rtti)(assertOk)([, 5])          //< a hole at position 0
            // `[undefined, 5]` is a *different value*: present-`undefined` at
            // position 0, which `or(option, string)` rejects.
            every(rtti)(assertError)([undefined, 5])
            every(rtti)(assertOk)(['x', 5])
            every(rtti)(assertError)([5])         //< `number` at position 1 is required
        }
        // And the one answer opening changes here as well.
        const extra = /** @type {const} */ (['x', 5, 'extra'])
        every(t)(assertError)(extra)
        every(open(t))(assertOk)(extra)
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
        // A hole is a position, so a sparse schema is as long as it looks:
        // `declared.length` is the schema's length, not its key count.
        arityIsTheSchemaLength: () => {
            assertOk(validate(new Array(1))([undefined]))
            assertError(validate(new Array(1))([1]))
        },
        // A tuple schema is read by index, so `foo` declares no position — it
        // is not matched against anything, and on the value side it is an
        // undeclared member like any other, which the closed form rejects and
        // `open` admits.
        nonIndexPropertyIsNotDeclared: () => {
            const schema = Object.assign([number], { foo: string })
            assertOk(validate(schema)([1]))
            assertError(validate(schema)(Object.assign([1], { foo: 'x' })))
            assertOk(validate(open(schema))(Object.assign([1], { foo: 'x' })))
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
            // A tuple is CLOSED, so a longer array is not one of its values —
            // see "Structs and tuples are closed" in ../README.md. Under
            // `open` it is, and it comes back as it went in.
            extraItemsRejected: () => {
                const long = [42, 1, 2, 3]
                assertError(validate([42])(long))
                assert(Object.is(unwrap(validate(open([42]))(long)), long),
                    'the longer array comes back as it went in')
            },
            // An absent member reads as `undefined`, so a position is required
            // exactly when its set excludes `undefined` — and nothing is
            // filled in, so the array keeps its length.
            shortArrayKeepsItsLength: () => {
                const short = [42]
                const out = unwrap(validate([number, or(option, string)])(short))
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
            const t = or(open([number]), array(number))
            const input = [1, 2, 3]
            assert(Object.is(unwrap(validate(t)(input)), input), 'expected the original array')
            assertStructurallySame(unwrap(parse(t)(input)), [1])
        },
    },
    option: {
        // At the entry position nothing can be absent, so `or(option, t)`
        // accepts exactly what `t` accepts — a present `undefined` included
        // in the rejects, unless the union carries it as a value.
        ok: () => {
            const t = or(option, number)
            assertOk(validate(t)(42))
            assertOk(validate(or(option, number, undefined))(undefined))
        },
        error: () => {
            const t = or(option, number)
            assertError(validate(t)(undefined))
            assertError(validate(t)(null))
            assertError(validate(t)('42'))
            // and `option` alone accepts nothing at all
            assertError(validate(option)(undefined))
            assertError(validate(option)(42))
        },
    },
    // Absence became describable: `{}` and `{ a: undefined }` are two
    // distinct values, and every pair of the three spellings separates them
    // as stage 2 states — `or(option, t)` admits omission only,
    // `or(t, undefined)` a present `undefined` only, and the union of all
    // three admits both.
    absenceIsNotUndefined: () => {
        for (const read of [v, p, d]) {
            const omittable = read({ a: or(option, number) })
            assertOk(omittable({}))
            assertOk(omittable({ a: 1 }))
            assertError(omittable({ a: undefined }))
            const present = read({ a: or(number, undefined) })
            assertError(present({}))
            assertOk(present({ a: undefined }))
            const both = read({ a: or(option, number, undefined) })
            assertOk(both({}))
            assertOk(both({ a: undefined }))
        }
    },
    // A negative field: `{ a: option }` is "objects with no `a`" — a set the
    // old design could not express at a declared key.
    negativeField: () => {
        for (const read of [v, p, d]) {
            const noA = read(open({ a: option }))
            assertOk(noA({}))
            assertOk(noA({ b: 1 }))
            assertError(noA({ a: 1 }))
            assertError(noA({ a: undefined }))
        }
    },
    // `admitsAbsence` traverses nested unions — the schema-form `or` does no
    // flattening, so `or(or(option, number), string)` has no `option` among
    // its direct members — and carries a visited set, so a recursive union
    // that reaches itself before `option` still terminates.
    admitsAbsenceTraversal: () => {
        for (const read of [v, p]) {
            const nested = read({ a: or(or(option, number), string) })
            assertOk(nested({}))
            assertOk(nested({ a: 1 }))
            assertOk(nested({ a: 'x' }))
            assertError(nested({ a: true }))
        }
        // The visited set is what terminates this: the cycle reaches itself
        // before it reaches `option`. Only the absent path is asked — a pure
        // `or` cycle never terminates on a *present* value in the thunk
        // readers, the standing limitation `../data/proof.f.mjs` records.
        /** @typedef {() => readonly ['or', _Cycle, typeof option]} _Cycle */
        /** @type {_Cycle} */
        const cycle = () => ['or', cycle, option]
        assertOk(v({ a: cycle })({}))
        assertOk(p({ a: cycle })({}))
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
    // A stated rest widens acceptance and nothing else: a success still carries
    // the very value it was given. The acceptance half is in the table above,
    // run through all three readers; what is left to pin here is that
    // `validate` stays verbatim on that form too.
    rest: {
        verbatim: () => {
            const value = [1, 'x', 'y']
            assert(Object.is(unwrap(validate(rest([number], string))(value)), value),
                'the value comes back as it went in')
            const struct = { a: 1, b: 'x' }
            assert(Object.is(unwrap(validate(rest({ a: number }, string))(struct)), struct),
                'and so does an object with rest-matching keys')
        },
        // An absent optional member still stays absent — a container's rest
        // says nothing about a member it declares.
        absentOptionalStaysAbsent: () => {
            const out = unwrap(validate({ a: number, b: or(option, string) })({ a: 1 }))
            assert(!('b' in out), 'an absent optional member must stay absent')
        },
        path: () => {
            assertErrorPath(['1'])(validate([number, number])([1, 'two']))
            assertErrorPath(['b'])(validate(rest({ a: number }, string))({ a: 1, b: 2 }))
            // The rejection of an undeclared member is about the container, so
            // it is reported at the container.
            assertErrorPath([])(validate({ a: number })({ a: 1, b: 2 }))
        },
        notAContainer: () => {
            assertError(validate(rest([number], string))({}))
            assertError(validate(rest({ a: number }, string))([]))
        },
    },
    // The three-reader table pins that the readers *agree* on the empty-rest
    // criterion; these assert the verdict outright, since a row alone passes
    // whenever all three move together. Each spelling is named rather than
    // covered by "an independently constructed empty rest": an implementation
    // recognizing empty unions but not `[or()]` passes the `or()` row while
    // keeping that spelling's disagreement, and one keyed on the exported
    // `never`'s identity passes the converse.
    emptyRests: {
        dropped: () => {
            /**
             * Two separately constructed copies of one recursive rule — the
             * pair behind the name-collision comparison; see the acceptance
             * table's own copy for the full story.
             *
             * @typedef {() => readonly ['or', undefined, () => readonly ['array', _SelfList]]} _SelfList
             */
            /** @type {_SelfList} */
            const selfList0 = () => ['or', undefined, array(selfList0)]
            /** @type {_SelfList} */
            const selfList1 = () => ['or', undefined, array(selfList1)]
            for (const r of [never, or(), [or()]]) {
                assertError(validate(rest([number], r))([42, ,]))
            }
            // The name collision: converting the rest reserves `r`, so the
            // container's own rule is named `r0` — which `equal` reads as a
            // different schema and `subset` both ways does not.
            assertError(v(rest([selfList0], [selfList1, never]))([undefined, ,]))
        },
        kept: () => {
            /**
             * A rest that is its own container, so nothing about it is
             * inline; the acceptance table's copy carries the full story.
             *
             * @typedef {() => readonly ['rest', readonly [_RecursiveRest], typeof never]} _RecursiveRest
             */
            /** @type {_RecursiveRest} */
            const recursiveRest = () => ['rest', [recursiveRest], never]
            /**
             * The other one: a pure `or` cycle.
             *
             * @typedef {() => readonly ['or', _OrCycleB]} _OrCycleA
             * @typedef {() => readonly ['or', _OrCycleA]} _OrCycleB
             */
            /** @type {_OrCycleA} */
            const orCycleA = () => ['or', orCycleB]
            /** @type {_OrCycleB} */
            const orCycleB = () => ['or', orCycleA]
            // A rest the conversion keeps is not empty however few values it
            // has: `recursiveRest` catches an emptiness analysis that reaches
            // container cycles, `orCycleA` one that tests the rest's own
            // canonical data, and `unknown` one that reads the absence of a
            // `rest` key as elimination.
            // `v` rather than `validate`: `Ts<>` walks a recursive schema
            // structurally, and these two exist to be recursive.
            assertOk(v(rest([number], recursiveRest))([42, ,]))
            assertOk(v(rest([number], orCycleA))([42, ,]))
            assertOk(validate(open([]))([1]))
        },
    },
    // The two ways an array can reach past a closed prefix, told apart. The
    // acceptance table pins that the three readers agree on both; these assert
    // the verdict, since a row alone passes whenever all three move together.
    // The hole is rejected by *length* — it is no member, so the member check
    // alone would let it through — and the explicit `undefined` by the member
    // check, since it is a member and the schema declares no position for it.
    // A closed tuple therefore has exactly one spelling per value.
    beyondAClosedPrefix: () => {
        for (const read of [v, p, d]) {
            assertError(read([/** @type {const} */ (42)])([42, ,]))
            assertError(read([/** @type {const} */ (42)])([42, undefined]))
            assertOk(read([/** @type {const} */ (42)])([42]))
        }
    },
    // A value the schema cannot fit is answered by its **shape**, before any
    // member is read: both readers report the container-level error rather
    // than the first bad member, and they report it identically. That
    // precedence is what lets a container be bounded before recursing, which
    // an `or` of two arities needs — see the comment on the gate in
    // `./module.f.mjs`. Acceptance is untouched: a shape the gate rejects is
    // one no walk could have accepted, which the differential against the
    // unbounded readers confirms. What the gate is *for* is counted by
    // {@link arityUnionVisitsEachOperandOnce}, not by these paths.
    structuralMismatchIsAnsweredFirst: () => {
        const t = /** @type {const} */ ([42])
        // too long *and* wrong at index 0 — the length is what answers
        for (const read of [v, p]) { assertErrorPath([])(read(t)([43, 'extra'])) }
        // a member error alone still reports the member
        for (const read of [v, p]) { assertErrorPath(['0'])(read(t)([43])) }
        // an absent required member answers before the members ahead of it
        // are read — reaching it through the reading walk would recurse
        // into the operands the longer arm shares, which is the exponential
        // this order exists to avoid
        const two = /** @type {const} */ ([number, number])
        for (const read of [v, p]) { assertErrorPath(['1'])(read(two)(['bad'])) }
        // and an undeclared member answers before the declared ones are
        // read, which is the struct kind's half of the same rule — there
        // `fits` is `() => true`, so the extra *key* is the only thing that
        // can settle the arm whose value has too much
        const one = { a: number }
        for (const read of [v, p]) { assertErrorPath([])(read(one)({ a: 'bad', b: 1 })) }
        // between the two structural answers the absent member wins, since
        // it is the cheap one: it consults the schema once per declared
        // member, where the undeclared check enumerates the value's keys
        for (const read of [v, p]) { assertErrorPath(['a'])(read(one)({ b: 1 })) }
        // and a value that fits is read as before
        for (const read of [v, p, d]) { assertOk(read(t)([42])) }
    },
    // Every row above is about error **attribution**, and a regression that
    // walked a shared operand once per arm while reporting the same paths
    // would pass them all. So this one counts instead: an `or` of two
    // arities whose arms share an operand, with the operand's thunk tallying
    // how often it is visited.
    //
    // Linear here, exponential without the bound — measured against the
    // unbounded readers at the same depths: 31 visits at depth 4, 511 at 8,
    // 131 071 at 16, against 7, 11 and 19 here. The bound is generous enough
    // to survive a benign refactor and far below 2^depth either way.
    arityUnionVisitsEachOperandOnce: () => {
        /**
         * @typedef {() => readonly ['or', typeof number, typeof string, _Dot]} _Exp
         * @typedef {() => readonly ['or', readonly ['.', _Exp, typeof string], readonly ['.', _Exp, typeof string, readonly ['|()', _Exp]]]} _Dot
         */
        let visits = 0
        /** @type {_Exp} */
        const exp = () => { visits += 1; return ['or', number, string, dot] }
        /** @type {_Dot} */
        const dot = () => ['or', ['.', exp, string], ['.', exp, string, ['|()', exp]]]
        /** @type {(n: number) => Unknown} */
        const chain = n => n === 0 ? ['nope'] : ['.', chain(n - 1), 'b']
        const depth = 16
        for (const read of [v, p]) {
            visits = 0
            assertError(read(exp)(chain(depth)))
            assert(visits <= 3 * depth, 'the shared operand is walked once per level, not once per arm')
        }
    },
    // The walk is bounded by what the value and its prototypes carry rather
    // than by `length`: a sparse array as long as the index space allows
    // answers at once, where materializing the range exhausted memory first.
    // The verdicts are the ordinary ones — a bare tuple is too short for it,
    // a rest with nothing present past the prefix admits it.
    lengthDoesNotBoundTheWalk: () => {
        const big = new Array(2 ** 32 - 1)
        assertError(v([or(option, string)])(big))
        assertOk(v(rest([], string))(big))
    },
    arrayOptional: () => {
        const a = /** @type {const} */([number, or(option, string)])
        const v = validate(a)
        assertOk(v([5]))
        assertError(v(["n"]))
        assertOk(v([6, "3"]))
        assertError(v([6, 9]))
    }
}
