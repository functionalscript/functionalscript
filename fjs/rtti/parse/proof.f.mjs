/**
 * @import { ValidationError } from '../common/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Ts } from '../../types/rtti/ts/types.ts'
 * @import { Parse } from './types.ts'
 * @import { Unknown as DjsUnknown } from '../../djs/types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Phantom } from '../../types/phantom/types.ts'
 */

import { parse } from '../../types/rtti/parse/module.f.mjs'
import { boolean, number, string, bigint, unknown, array, open, record, rest, or, option } from '../module.f.mjs'
import {
    assert,
    assertEq,
    assertStructurallySame,
} from '../../asserts/module.f.mjs'

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

/** A container that contains itself: `[number, node?]`. */
/** @typedef {readonly [number, _Node | undefined]} _Node */

const _node = () => /** @type {const} */ (['const', [number, option(_node)]])

/** @type {Phantom<typeof _node, _Node>} */
const node = _node

/** A struct whose every undeclared key holds another one of these. */
/** @typedef {() => readonly ['rest', { readonly a: typeof number }, _Nest]} _Nest */

/** @type {_Nest} */
const _nest = () => ['rest', { a: number }, _nest]

/** @type {Phantom<_Nest, { readonly a: number }>} */
const nest = _nest

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
            ok: () => assertOk(parse(42)(42)),
            error: () => assertError(parse(42)(43)),
        },
        nan: {
            ok: () => assertOk(parse(NaN)(NaN)),
            error: () => {
                assertError(parse(NaN)(0))
                assertError(parse(0)(NaN))
                assertError(parse(42)(NaN))
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
                assertError(parse(0)(-0))
                assertError(parse(-0)(0))
            },
            self: () => {
                assertOk(parse(0)(0))
                assertOk(parse(-0)(-0))
            },
        },
        string: {
            ok: () => assertOk(parse('hello')('hello')),
            error: () => assertError(parse('hello')('world')),
        },
        bigint: {
            ok: () => assertOk(parse(7n)(7n)),
            error: () => assertError(parse(7n)(8n)),
        },
        boolean: {
            ok: () => assertOk(parse(true)(true)),
            error: () => assertError(parse(true)(false)),
        },
        tuple: {
            ok: () => {
                const r = parse([42, 'hello'])([42, 'hello'])
                assertStructurallySame(unwrap(r), [42, 'hello'])
            },
            // A tuple is CLOSED: a longer array is not one of its values —
            // see "Structs and tuples are closed" in ../README.md. Under
            // `open` it is accepted, and the extras are absent from what
            // `parse` builds.
            extraItemsRejected: () => {
                assertError(parse([42])([42, 'extra']))
                assertStructurallySame(unwrap(parse(open([42]))([42, 'extra'])), [42])
                assertStructurallySame(unwrap(parse(open([42]))([42, 1, 2, 3])), [42])
            },
            // An absent member reads as `undefined`, so a position is required
            // exactly when its set excludes `undefined` — the same rule the
            // data form states for object keys, applied to arrays.
            shortArrayFillsAnOptionalPosition: () => {
                const r = parse([number, option(string)])([42])
                assertStructurallySame(unwrap(r), [42, undefined])
            },
            error: () => {
                assertError(parse([42])([99]))
                assertError(parse([42])({}))
                // `42` excludes `undefined`, so position 0 is required.
                assertError(parse([42])([]))
            },
        },
        struct: {
            // `parse` takes a `const` type parameter, so a struct literal keeps
            // its literal members without an `@type {const}` cast at the call
            // site: this is a reader for `{ a: 42, b: 'hello' }`, not for
            // `{ a: number, b: string }`. Dropping the modifier is what makes
            // the assertion fail.
            ok: () => {
                const p = parse({ a: 42, b: 'hello' })
                /** @typedef {Assert<Equal<typeof p, Parse<{ readonly a: 42, readonly b: 'hello' }>>>} _ConstParameter */
                assertStructurallySame(unwrap(p({ a: 42, b: 'hello' })), { a: 42, b: 'hello' })
            },
            // A struct is CLOSED, on the same terms as a tuple. See "Structs
            // and tuples are closed" in ../README.md.
            extraKeysRejected: () => {
                assertError(parse({ a: 42 })({ a: 42, b: 'extra' }))
                assertStructurallySame(unwrap(parse(open({ a: 42 }))({ a: 42, b: 'extra' })), { a: 42 })
            },
            error: () => {
                assertError(parse({ a: 42 })({ a: 99 }))
                assertError(parse({ a: 42 })([]))
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
                const t = or(false, 42, 'hello')
                assertOk(parse(t)(false))
                assertOk(parse(t)(42))
                assertOk(parse(t)('hello'))
            },
            error: () => {
                const t = or(false, 42, 'hello')
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
            const t = or(open([number]), array(number))
            /** @type {readonly number[]} */
            const out = unwrap(parse(t)([1, 2, 3]))
            // The open tuple `open([number])` matches first and returns a
            // length-1 result; the closed `[number]` would not match at all.
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
            parse([number, number])([1, 'two'])
        ),
        structKey: () => assertErrorPath(['b'])(
            parse({ a: number, b: number })({ a: 1, b: 'two' })
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
    // A bare container is closed, and a stated rest widens acceptance without
    // changing construction at all: the result carries the declared members
    // either way. `../validate/proof.f.mjs` runs the acceptance half of this
    // through all three readers.
    closed: {
        tuple: {
            exact: () => {
                const p = parse([number, string])
                /** @typedef {Assert<Equal<typeof p, Parse<readonly [typeof number, typeof string]>>>} _ConstParameter */
                assertStructurallySame(unwrap(p([1, 'a'])), [1, 'a'])
            },
            // The whole point of the default: `open` is what accepts this.
            extraRejected: () => {
                assertError(parse([number])([1, 2]))
                assertStructurallySame(unwrap(parse(open([number]))([1, 2])), [1])
            },
            // A hole past the prefix is no member, so length is what catches it.
            holePastThePrefixRejected: () => assertError(parse([number])([1, ,])),
            // Nor is a key that is no position at all.
            nonIndexKeyRejected: () =>
                assertError(parse([number])(Object.assign([1], { foo: 2 }))),
            // The rule for a missing member is unchanged: an absent position
            // reads as `undefined`.
            shortArray: () => {
                assertError(parse([number])([]))
                assertStructurallySame(unwrap(parse([number, option(string)])([1])), [1, undefined])
            },
            empty: () => {
                assertStructurallySame(unwrap(parse([])([])), [])
                assertError(parse([])([1]))
            },
            notAnArray: () => assertError(parse([number])({})),
        },
        struct: {
            exact: () => assertStructurallySame(unwrap(parse({ a: number })({ a: 1 })), { a: 1 }),
            extraRejected: () => {
                assertError(parse({ a: number })({ a: 1, b: 2 }))
                assertOk(parse(open({ a: number }))({ a: 1, b: 2 }))
            },
            // A key declared as `unknown` is a member the schema *has*, so a
            // closed struct still admits it — the canonical form may not drop
            // it the way an `open` struct's is dropped.
            unknownMemberIsStillDeclared: () => {
                assertOk(parse({ a: unknown })({ a: 1 }))
                assertError(parse({ a: unknown })({ a: 1, b: 2 }))
            },
            empty: () => {
                assertStructurallySame(unwrap(parse({})({})), {})
                assertError(parse({})({ a: 1 }))
            },
            notAnObject: () => assertError(parse({ a: number })([])),
        },
        // With a `rest`, an undeclared member is legal when it belongs to it —
        // and still not carried into what `parse` builds. `rest` says what an
        // undeclared member must be, not that the reader should keep it.
        rest: {
            checkedAndDropped: () => {
                assertStructurallySame(unwrap(parse(rest({ a: number }, string))({ a: 1, b: 'x' })), { a: 1 })
                assertStructurallySame(unwrap(parse(rest([number], string))([1, 'x', 'y'])), [1])
            },
            rejected: () => {
                assertErrorPath(['b'])(parse(rest({ a: number }, string))({ a: 1, b: 2 }))
                assertErrorPath(['1'])(parse(rest([number], string))([1, 2]))
            },
            // An unconstrained rest is `open`.
            unknownRestIsOpen: () => assertOk(parse(rest([number], unknown))([1, 'x'])),
            // An empty one is the bare form: the length bound comes back.
            emptyRestBoundsTheLength: () => {
                assertError(parse(rest([number], or()))([1, ,]))
                assertStructurallySame(unwrap(parse(rest([number], or()))([1])), [1])
            },
        },
        // The declared members are read the same way whatever the rest is,
        // error paths included.
        path: () => {
            assertErrorPath(['1'])(parse([number, number])([1, 'two']))
            assertErrorPath(['a', '0'])(parse({ a: [number] })({ a: ['x'] }))
        },
        // A cycle through a container terminates. The schema is
        // `Phantom`-wrapped for the usual reason (`Ts<>`'s structural walk
        // would not terminate over a recursive container — see
        // `../ts/types.ts`); it is the *value* half under test here.
        recursive: () => {
            const p = parse(node)
            assertStructurallySame(unwrap(p([1])), [1, undefined])
            assertStructurallySame(unwrap(p([1, [2]])), [1, [2, undefined]])
            assertError(p([1, [2], 3]))
        },
        // A cycle through the `rest` itself: every key other than `a` holds
        // another one of these.
        recursiveRest: () => {
            const p = parse(nest)
            assertStructurallySame(unwrap(p({ a: 1, b: { a: 2 } })), { a: 1 })
            assertError(p({ a: 1, b: { a: 'x' } }))
            assertError(p({ a: 1, b: 2 }))
        },
    },
    arrayOptional: () => {
        const a = /** @type {const} */([number, option(string)])
        const v = parse(a)
        assertOk(v([5]))
        assertError(v(["n"]))
        assertOk(v([6, "3"]))
        assertError(v([6, 9]))
    }
}
