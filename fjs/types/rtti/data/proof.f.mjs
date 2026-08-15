/**
 * @import { Or } from '../types.ts'
 * @import { Data } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import {
    array,
    bigint,
    boolean,
    never as neverRtti,
    number,
    option,
    or,
    record,
    string,
    unknown as unknownRtti,
} from '../module.f.mjs'
import { cmp, equal, never, subset, toData, unitBit, unitList, unknown, validate, withoutUnits } from './module.f.mjs'

/** @type {(actual: Data) => (expected: Data) => void} */
const assertData = actual => expected =>
    assert(equal(actual)(expected), [actual, expected])

/** A recursive list: `type _List = readonly _List[]`. */
/** @typedef {() => readonly ['array', _List]} _List */
/** @type {_List} */
const list = () => ['array', list]

/** Mutual recursion through a container: `_Tree = number | _Forest`, `_Forest = readonly _Tree[]`. */
/** @typedef {() => readonly ['or', typeof number, _Forest]} _Tree */
/** @typedef {() => readonly ['array', _Tree]} _Forest */
/** @type {_Tree} */
const tree = () => ['or', number, forest]
/** @type {_Forest} */
const forest = () => ['array', tree]

/** A pure `or` self-cycle: `_SelfOr = number | _SelfOr`. */
/** @typedef {() => readonly ['or', typeof number, _SelfOr]} _SelfOr */
/** @type {_SelfOr} */
const selfOr = () => ['or', number, selfOr]

/** A mutual `or` cycle: `_OrA = _OrB | number`, `_OrB = _OrA | string`. */
/** @typedef {() => readonly ['or', _OrB, typeof number]} _OrA */
/** @typedef {() => readonly ['or', _OrA, typeof string]} _OrB */
/** @type {_OrA} */
const orA = () => ['or', orB, number]
/** @type {_OrB} */
const orB = () => ['or', orA, string]

/** An `or` over a rule that still has pending merges when it is consumed. */
/** @typedef {() => readonly ['or', typeof string, _Inner]} _Outer */
/** @typedef {() => readonly ['or', _Outer, _T2]} _Inner */
/** @typedef {() => readonly ['array', _Inner]} _T2 */
/** @type {_Outer} */
const outer = () => ['or', string, inner]
/** @type {_Inner} */
const inner = () => ['or', outer, t2]
/** @type {_T2} */
const t2 = () => ['array', inner]

/** Two `or` operands deferred onto the same target rule. */
/** @typedef {() => readonly ['array', _Y]} _X */
/** @typedef {() => readonly ['array', _W]} _Y */
/** @typedef {() => readonly ['or', _X, _Y, typeof number]} _W */
/** @type {_X} */
const x = () => ['array', y]
/** @type {_Y} */
const y = () => ['array', w]
/** @type {_W} */
const w = () => ['or', x, y, number]

/** A cycle whose union is the whole value domain. */
/** @typedef {() => readonly ['or', typeof unknownRtti, _TopArr]} _TopOr */
/** @typedef {() => readonly ['array', _TopOr]} _TopArr */
/** @type {_TopOr} */
const topOr = () => ['or', unknownRtti, topArr]
/** @type {_TopArr} */
const topArr = () => ['array', topOr]

/** Two named rules where only one is referenced by the entry. */
/** @typedef {() => readonly ['array', _B2]} _B2 */
/** @typedef {() => readonly ['array', readonly [_A2, _B2]]} _A2 */
/** @type {_A2} */
const a2 = () => ['array', [a2, b2]]
/** @type {_B2} */
const b2 = () => ['array', b2]

/** A self-recursive record: rest-based object recursion. */
/** @typedef {() => readonly ['record', _RecordSelf]} _RecordSelf */
/** @type {_RecordSelf} */
const recordSelf = () => ['record', recordSelf]

/** Mutual recursion through object *properties* rather than containers. */
/** @typedef {() => readonly ['const', { readonly value: typeof number, readonly next: Or<readonly [_Odd, undefined]> }]} _Even */
/** @typedef {() => readonly ['const', { readonly value: typeof number, readonly next: Or<readonly [_Even, undefined]> }]} _Odd */
/** @type {_Even} */
const even = () => ['const', { value: number, next: option(odd) }]
/** @type {_Odd} */
const odd = () => ['const', { value: number, next: option(even) }]

/** @typedef {() => readonly ['array', _Rec]} _Rec */
/** Every call returns a fresh recursive thunk whose function name is `f`. */
/** @type {() => _Rec} */
const mkRec = () => {
    /** @type {_Rec} */
    const f = () => ['array', f]
    return f
}

/** @type {(f: _Rec) => _Rec} */
const identityRec = f => f
/** A recursive thunk whose function name is the empty string. */
/** @type {_Rec} */
const anon = identityRec(() => ['array', anon])

const tupleNumber = /** @type {const} */ ([number])
const tupleString = /** @type {const} */ ([string])
const emptyTuple = /** @type {const} */ ([])

export const proof = {
    withoutUnits: [
        // Removing the last unit bit removes the key: an empty kind is an
        // absent property here, never a zero.
        () => assertStructurallySame(
            withoutUnits(unitBit(undefined))({ unit: unitBit(undefined) }),
            never),
        () => assertStructurallySame(
            withoutUnits(unitBit(undefined))({ unit: unitBit(undefined) | unitBit(null) }),
            { unit: unitBit(null) }),
        // Bits that are not set are a no-op.
        () => assertStructurallySame(
            withoutUnits(unitBit(undefined))({ unit: unitBit(null) }),
            { unit: unitBit(null) }),
        () => assertStructurallySame(withoutUnits(unitBit(undefined))(never), never),
        // The other five kinds are carried through untouched — this is what
        // enumerating `UnionSet`'s members by hand would silently drop.
        () => assertStructurallySame(
            withoutUnits(unitBit(undefined))(unknown),
            { ...unknown, unit: unitBit(null) | unitBit(false) | unitBit(true) }),
        () => assertStructurallySame(
            withoutUnits(unitBit(undefined))({ unit: unitBit(undefined), string: true }),
            { string: true }),
    ],
    unitBits: () => {
        // the literal bits are the encoding under test
        assertEq(unitList.join(), 'null,undefined,false,true')
        assertEq(unitBit(null), 1)
        assertEq(unitBit(undefined), 2)
        assertEq(unitBit(false), 4)
        assertEq(unitBit(true), 8)
    },
    toData: {
        primitives: () => {
            assertData(toData(null))([{}, { unit: unitBit(null) }])
            assertData(toData(undefined))([{}, { unit: unitBit(undefined) }])
            assertData(toData(false))([{}, { unit: unitBit(false) }])
            assertData(toData(true))([{}, { unit: unitBit(true) }])
            assertData(toData(42))([{}, { number: [42] }])
            assertData(toData('hi'))([{}, { string: ['hi'] }])
            assertData(toData(7n))([{}, { bigint: [7n] }])
            assert(!equal(toData(0))(toData(-0)))
        },
        tag0: () => {
            assertData(toData(boolean))([{}, { unit: unitBit(false) | unitBit(true) }])
            assertData(toData(number))([{}, { number: true }])
            assertData(toData(string))([{}, { string: true }])
            assertData(toData(bigint))([{}, { bigint: true }])
            assertData(toData(unknownRtti))([{}, unknown])
            assertData(toData(neverRtti))([{}, never])
        },
        containers: () => {
            assertData(toData(array(number)))([{}, { array: [{ prefix: [], rest: { number: true } }] }])
            assertData(toData(record(string)))([{}, { object: [{ props: {}, rest: { string: true } }] }])
            assertData(toData(array(unknownRtti)))([{}, { array: true }])
            assertData(toData(record(unknownRtti)))([{}, { object: true }])
            assertData(toData(array(neverRtti)))([{}, { array: [{ prefix: [] }] }])
            assertData(toData(record(neverRtti)))([{}, { object: [{ props: {}, rest: {} }] }])
            assertData(toData(emptyTuple))([{}, { array: [{ prefix: [] }] }])
            assertData(toData(/** @type {const} */ ([number, 42])))(
                [{}, { array: [{ prefix: [{ number: true }, { number: [42] }] }] }])
            assertData(toData({}))([{}, { object: true }])
            assertData(toData({ b: string, a: number }))(
                [{}, { object: [{ props: { a: { number: true }, b: { string: true } } }] }])
            assertData(toData({ a: unknownRtti }))([{}, { object: true }])
            assertData(toData(/** @type {const} */ ([neverRtti])))([{}, never])
            assertData(toData({ a: neverRtti }))([{}, never])
        },
        constSchemas: () => {
            assertData(toData(() => /** @type {const} */ (['const', 42])))([{}, { number: [42] }])
            assertData(toData(() => /** @type {const} */ (['const', null])))([{}, { unit: unitBit(null) }])
            assertData(toData(() => /** @type {const} */ (['const', { a: 42 }])))(toData({ a: 42 }))
            // a shared container converts once and is inlined at each use
            assertData(toData(/** @type {const} */ ([tupleNumber, tupleNumber])))([{}, {
                array: [{
                    prefix: [
                        { array: [{ prefix: [{ number: true }] }] },
                        { array: [{ prefix: [{ number: true }] }] },
                    ],
                }],
            }])
        },
        or: () => {
            assertData(toData(or()))([{}, never])
            assertData(toData(or(true, false)))([{}, { unit: unitBit(false) | unitBit(true) }])
            assertData(toData(or(boolean, null, undefined)))(
                [{}, { unit: unitBit(null) | unitBit(undefined) | unitBit(false) | unitBit(true) }])
            assertData(toData(or(42, number)))([{}, { number: true }])
            assertData(toData(or(1, 1)))([{}, { number: [1] }])
            assertData(toData(or(2, 1)))([{}, { number: [1, 2] }])
            assertData(toData(or(NaN, NaN)))([{}, { number: [NaN] }])
            assertData(toData(or(NaN, 1)))([{}, { number: [1, NaN] }])
            assertData(toData(or(1, NaN)))([{}, { number: [1, NaN] }])
            assertData(toData(or(-0, 0)))([{}, { number: [-0, 0] }])
            assertData(toData(or(0, -0)))([{}, { number: [-0, 0] }])
            assertData(toData(or('b', 'a')))([{}, { string: ['a', 'b'] }])
            assertData(toData(or(2n, 1n)))([{}, { bigint: [1n, 2n] }])
            assertData(toData(option(string)))([{}, { unit: unitBit(undefined), string: true }])
            assertData(toData(or(unknownRtti, number)))([{}, unknown])
            assertData(toData(or(number, or(string, boolean))))(
                [{}, { unit: unitBit(false) | unitBit(true), number: true, string: true }])
            assertData(toData(or(1, or(1, 2))))([{}, { number: [1, 2] }])
        },
        orCanonicalIdentity: () => {
            assertData(toData(or(number, string)))(toData(or(string, number)))
            const a = array(number)
            const b = array(string)
            assertData(toData(or(a, b)))(toData(or(b, a)))
            assertData(toData(or(tupleNumber, tupleString)))(toData(or(tupleString, tupleNumber)))
        },
        recursion: () => {
            assertData(toData(list))([{ list: { array: [{ prefix: [], rest: 'list' }] } }, 'list'])
            assertData(toData(tree))(
                [{ tree: { number: true, array: [{ prefix: [], rest: 'tree' }] } }, 'tree'])
            assertData(toData(forest))([
                { tree: { number: true, array: [{ prefix: [], rest: 'tree' }] } },
                { array: [{ prefix: [], rest: 'tree' }] },
            ])
            assertData(toData(record(list)))([
                { list: { array: [{ prefix: [], rest: 'list' }] } },
                { object: [{ props: {}, rest: 'list' }] },
            ])
            assertData(toData({ p: list }))([
                { list: { array: [{ prefix: [], rest: 'list' }] } },
                { object: [{ props: { p: 'list' } }] },
            ])
            assertData(toData(a2))([
                {
                    a2: { array: [{ prefix: [], rest: { array: [{ prefix: ['a2', 'b2'] }] } }] },
                    b2: { array: [{ prefix: [], rest: 'b2' }] },
                },
                'a2',
            ])
        },
        orCycles: () => {
            // a pure `or` self-cycle contributes nothing: _X = number | _X is number
            assertData(toData(selfOr))(toData(number))
            // a mutual `or` cycle is the union of the non-cyclic content
            assertData(toData(orA))(toData(or(number, string)))
            // `outer` and `inner` denote the same set; the interning step
            // recognizes the inlined entry as `inner`'s body
            assertData(toData(outer))([
                { inner: { string: true, array: [{ prefix: [], rest: 'inner' }] } },
                'inner',
            ])
            assertData(toData(outer))(toData(inner))
            assertData(toData(x))([
                { w: { number: true, array: [{ prefix: [], rest: 'w' }] } },
                { array: [{ prefix: [], rest: { array: [{ prefix: [], rest: 'w' }] } }] },
            ])
            assertData(toData(topArr))([{ topOr: unknown }, { array: [{ prefix: [], rest: 'topOr' }] }])
        },
        intern: () => {
            // a union equal to a rule's body reads back as a reference,
            // so `or` is idempotent on recursive schemas
            assertData(toData(or(list)))(toData(list))
            assertData(toData(or(list, list)))(toData(list))
            assertData(toData(or(tree, tree)))(toData(tree))
            // a re-stated fixpoint collapses: `list = readonly list[]`,
            // so `array(list)` is `list` itself
            assertData(toData(array(list)))(toData(list))
            assertData(toData(array(or(list))))(toData(list))
            // in nested positions too
            assertData(toData({ p: or(list) }))(toData({ p: list }))
        },
        alphaEquivalence: () => {
            // two α-equivalent recursive rules under different names spell
            // the same set two ways; their union keeps the spelling that
            // sorts first instead of dropping the mutually-subsumed pair
            const listB = mkRec()
            assertData(toData(or(list, listB)))(toData(listB))
            assertData(toData(or(listB, list)))(toData(listB))
            assert(subset(toData(list))(toData(or(list, listB))))
            assert(subset(toData(listB))(toData(or(list, listB))))
            assertEq(validate(toData(or(list, listB)))([[]])[0], 'ok')
            // the pair is a mutual subset, yet `equal` stays structural
            assert(subset(toData(list))(toData(listB)))
            assert(subset(toData(listB))(toData(list)))
            assert(!equal(toData(list))(toData(listB)))
            // bisimilar mixed-kind recursions collapse the same way
            assertData(toData(or(tree, y)))(toData(tree))
        },
        names: () => {
            // colliding function names are disambiguated with a counter
            assertData(toData(/** @type {const} */ ([mkRec(), mkRec()])))([
                {
                    f: { array: [{ prefix: [], rest: 'f' }] },
                    f0: { array: [{ prefix: [], rest: 'f0' }] },
                },
                { array: [{ prefix: ['f', 'f0'] }] },
            ])
            assertData(toData(anon))([{ '': { array: [{ prefix: [], rest: '' }] } }, ''])
        },
        collapse: () => {
            // readonly [number] ⊂ readonly number[] — the tuple pattern is dropped
            assertData(toData(or(tupleNumber, array(number))))(toData(array(number)))
            // the empty tuple is a member of every uniform array set
            assertData(toData(or(emptyTuple, array(number))))(toData(array(number)))
            assertData(toData(or(array(number), emptyTuple)))(toData(array(number)))
            // kept when neither pattern subsumes the other
            assertData(toData(or(tupleNumber, tupleString)))(
                [{}, { array: [{ prefix: [{ string: true }] }, { prefix: [{ number: true }] }] }])
            // the collapse recurses into inline positions
            assertData(toData(array(or(tupleNumber, array(number)))))(toData(array(array(number))))
            assertData(toData(record(or(tupleNumber, array(number)))))(toData(record(array(number))))
            assertData(toData({ a: or(tupleNumber, array(number)) }))(toData({ a: array(number) }))
            // collapsing innards can make two patterns identical — deduplicated
            assertData(toData(or(array(or(tupleNumber, array(number))), array(array(number)))))(
                toData(array(array(number))))
            // subsumed object patterns are dropped, `true` absorbs patterns
            assertData(toData(or({ a: 42 }, { a: number })))(toData({ a: number }))
            assertData(toData(or({ a: number }, {})))(toData({}))
        },
        serializable: () => {
            const d = toData(or(string, array(number), null))
            assertEq(
                JSON.stringify(d),
                '[{},{"unit":1,"string":true,"array":[{"prefix":[],"rest":{"number":true}}]}]')
            assertEq(
                JSON.stringify(toData(list)),
                '[{"list":{"array":[{"prefix":[],"rest":"list"}]}},"list"]')
        },
    },
    cmp: {
        totalOrder: () => {
            assertEq(cmp(toData(number))(toData(number)), 0)
            assertEq(cmp(toData(list))(toData(list)), 0)
            assert(cmp(toData(null))(toData(true)) < 0)
            assert(cmp(toData(1))(toData(2)) < 0)
            assert(cmp(toData(or(1, 2)))(toData(or(1, 2, 3))) < 0)
            assert(cmp(toData(1))(toData(number)) < 0)
            assert(cmp(toData(number))(toData(1)) > 0)
            assert(cmp(toData(neverRtti))(toData(number)) < 0)
            assert(cmp(toData(number))(toData(neverRtti)) > 0)
            assert(cmp(toData('a'))(toData('b')) < 0)
            assert(cmp(toData(1n))(toData(2n)) < 0)
            assert(cmp(toData(2n))(toData(1n)) > 0)
            assert(cmp(toData(string))(toData(bigint)) !== 0)
            assert(cmp(toData(array(number)))(toData(array(string))) !== 0)
            assert(cmp(toData({ a: number }))(toData({ a: string })) !== 0)
            assert(cmp(toData({ a: number }))(toData({ b: number })) !== 0)
            // an inline union sorts before a reference
            assert(cmp(toData(number))(toData(list)) < 0)
            assert(cmp(toData(list))(toData(number)) > 0)
        },
        restOrder: () => {
            // a pattern without a rest sorts before one with a rest
            /** @type {Data} */
            const arrayNoRest = [{}, { array: [{ prefix: [{ number: true }] }] }]
            /** @type {Data} */
            const arrayRest = [{}, { array: [{ prefix: [{ number: true }], rest: { number: true } }] }]
            assert(cmp(arrayNoRest)(arrayRest) < 0)
            assert(cmp(arrayRest)(arrayNoRest) > 0)
            /** @type {Data} */
            const structNoRest = [{}, { object: [{ props: { a: { number: true } } }] }]
            /** @type {Data} */
            const structRest = [{}, { object: [{ props: { a: { number: true } }, rest: { number: true } }] }]
            assert(cmp(structNoRest)(structRest) < 0)
            assert(cmp(structRest)(structNoRest) > 0)
            // rests compared when the prefixes and props tie
            assertData(toData(or(array(number), array(string))))(
                [{}, { array: [{ prefix: [], rest: { string: true } }, { prefix: [], rest: { number: true } }] }])
            assertData(toData(or(record(number), record(string))))(
                [{}, { object: [{ props: {}, rest: { string: true } }, { props: {}, rest: { number: true } }] }])
            // fewer props sort before more props
            assertData(toData(or({ a: number }, record(number))))(
                [{}, { object: [{ props: {}, rest: { number: true } }, { props: { a: { number: true } } }] }])
        },
        rules: () => {
            /** @type {Data} */
            const ra = [{ r: { number: true } }, 'r']
            /** @type {Data} */
            const rb = [{ r: { string: true } }, 'r']
            assert(cmp(ra)(rb) !== 0)
            assert(!equal(ra)(rb))
        },
    },
    subset: {
        literals: () => {
            assert(subset(toData(true))(toData(boolean)))
            assert(!subset(toData(boolean))(toData(true)))
            assert(!subset(toData(null))(toData(number)))
            assert(subset(toData(42))(toData(number)))
            assert(!subset(toData(number))(toData(42)))
            assert(subset(toData(or(1, 2)))(toData(or(1, 2, 3))))
            assert(!subset(toData(or(1, 4)))(toData(or(1, 2, 3))))
            assert(subset(toData('a'))(toData(string)))
            assert(subset(toData(1n))(toData(or(1n, 2n))))
            assert(!subset(toData(1n))(toData(2n)))
            assert(!subset(toData(42))(toData(string)))
            assert(subset(toData(neverRtti))(toData(42)))
            assert(subset(toData(or(number, string)))(toData(unknownRtti)))
        },
        arrays: () => {
            assert(subset(toData(tupleNumber))(toData(array(number))))
            assert(!subset(toData(array(number)))(toData(tupleNumber)))
            assert(subset(toData(array(number)))(toData(unknownRtti)))
            assert(!subset(toData(array(unknownRtti)))(toData(array(number))))
            assert(subset(toData(array(number)))(toData(array(or(number, string)))))
            assert(!subset(toData(tupleNumber))(toData(tupleString)))
            assert(!subset(toData(tupleNumber))(toData(/** @type {const} */ ([number, number]))))
        },
        arrayRest: () => {
            /** @type {Data} */
            const oneOrMoreNumbers = [{}, { array: [{ prefix: [{ number: true }], rest: { number: true } }] }]
            assert(subset(oneOrMoreNumbers)(toData(array(number))))
            assert(!subset(toData(array(number)))(oneOrMoreNumbers))
            assert(subset(toData(/** @type {const} */ ([number, number])))(oneOrMoreNumbers))
            assert(!subset(toData(emptyTuple))(oneOrMoreNumbers))
            /** @type {Data} */
            const oneNumberThenStrings = [{}, { array: [{ prefix: [{ number: true }], rest: { string: true } }] }]
            assert(!subset(oneOrMoreNumbers)(oneNumberThenStrings))
        },
        objects: () => {
            assert(subset(toData({ a: number }))(toData({})))
            assert(subset(toData({ a: 42 }))(toData({ a: number })))
            assert(!subset(toData({ a: number }))(toData({ a: 42 })))
            assert(subset(toData({ a: number, b: string }))(toData({ a: number })))
            assert(subset(toData(record(number)))(toData(record(or(number, string)))))
            assert(!subset(toData(record(or(number, string))))(toData(record(number))))
            // a record's keys may be absent, a required key excludes that
            assert(!subset(toData(record(number)))(toData({ a: number })))
            assert(subset(toData(record(number)))(toData({ a: option(number) })))
            // a struct leaves undeclared keys unconstrained, a record does not
            assert(!subset(toData({ a: number }))(toData(record(number))))
            // a key inherited from Object.prototype is not a declared prop
            assert(!subset(toData({ a: number }))(toData({ toString: number })))
            assert(subset(toData({ toString: /** @type {const} */ (42) }))(toData({ toString: number })))
        },
        recursion: () => {
            assert(subset(toData(list))(toData(list)))
            assert(subset(toData(forest))(toData(tree)))
            assert(!subset(toData(tree))(toData(forest)))
            assert(!subset(toData(list))(toData(array(number))))
            assert(subset(toData(array(neverRtti)))(toData(list)))
        },
        mixedObjectRecursion: () => {
            // rest-based and property-based object recursion compared in one
            // union used to overflow the stack: the synthesized `rest ∪
            // undefined` read-sets never reached the coinductive memo
            const v = validate(toData(or(recordSelf, even)))
            assertEq(v({})[0], 'ok')
            assertEq(v({ value: 1 })[0], 'ok')
            assertEq(v({ value: 'x' })[0], 'error')
            assert(!subset(toData(recordSelf))(toData(even)))
            assert(!subset(toData(even))(toData(recordSelf)))
            assert(subset(toData(recordSelf))(toData(or(recordSelf, even))))
            assert(subset(toData(even))(toData(or(recordSelf, even))))
            assert(subset(toData(even))(toData(odd)))
        },
        assumed: () => {
            // one left rule checked against two right rules on one path
            /** @type {Data} */
            const left = [{ A: { array: [{ prefix: [], rest: 'A' }] } }, 'A']
            /** @type {Data} */
            const right = [
                {
                    B: { array: [{ prefix: [], rest: 'C' }] },
                    C: { array: [{ prefix: [], rest: 'C' }] },
                },
                'B',
            ]
            assert(subset(left)(right))
        },
    },
    validate: {
        literals: () => {
            const v = validate(toData(or(1, 'a', 2n, null, true)))
            assertEq(v(1)[0], 'ok')
            assertEq(v('a')[0], 'ok')
            assertEq(v(2n)[0], 'ok')
            assertEq(v(null)[0], 'ok')
            assertEq(v(true)[0], 'ok')
            assertEq(v(2)[0], 'error')
            assertEq(v('b')[0], 'error')
            assertEq(v(3n)[0], 'error')
            assertEq(v(undefined)[0], 'error')
            assertEq(v(false)[0], 'error')
        },
        kinds: () => {
            assertEq(validate(toData(number))(NaN)[0], 'ok')
            assertEq(validate(toData(string))('x')[0], 'ok')
            assertEq(validate(toData(bigint))(1n)[0], 'ok')
            assertEq(validate(toData(boolean))(false)[0], 'ok')
            assertEq(validate(toData(NaN))(NaN)[0], 'ok')
            assertEq(validate(toData(-0))(0)[0], 'error')
            assertEq(validate(toData(unknownRtti))([1])[0], 'ok')
            assertEq(validate(toData(unknownRtti))({ a: 1 })[0], 'ok')
            assertEq(validate(toData(neverRtti))(1)[0], 'error')
            assertEq(validate(toData(number))([])[0], 'error')
            assertEq(validate(toData(number))({})[0], 'error')
        },
        arrays: () => {
            const v = validate(toData(array(number)))
            assertEq(v([])[0], 'ok')
            assertEq(v([1, 2])[0], 'ok')
            assertEq(
                JSON.stringify(v([1, 'x'])),
                '["error",{"path":["1"],"message":"unexpected value"}]')
            const vt = validate(toData(/** @type {const} */ ([number, string])))
            assertEq(vt([1, 'a'])[0], 'ok')
            assertEq(vt([1])[0], 'error')
            assertEq(vt([1, 'a', 2])[0], 'error')
            /** @type {Data} */
            const onePlus = [{}, { array: [{ prefix: [{ number: true }], rest: { string: true } }] }]
            const vp = validate(onePlus)
            assertEq(vp([])[0], 'error')
            assertEq(vp([1])[0], 'ok')
            assertEq(vp([1, 'a', 'b'])[0], 'ok')
            assertEq(vp([1, 2])[0], 'error')
            const vm = validate(toData(or(tupleNumber, tupleString)))
            assertEq(vm([1])[0], 'ok')
            assertEq(vm(['a'])[0], 'ok')
            assertEq(
                JSON.stringify(vm([true])),
                '["error",{"path":[],"message":"no match"}]')
        },
        objects: () => {
            const v = validate(toData({ a: number, b: option(string) }))
            assertEq(v({ a: 1 })[0], 'ok')
            assertEq(v({ a: 1, b: 's' })[0], 'ok')
            assertEq(v({ a: 1, extra: true })[0], 'ok')
            assertEq(
                JSON.stringify(v({ b: 's' })),
                '["error",{"path":["a"],"message":"unexpected value"}]')
            assertEq(v({ a: 1, b: 1 })[0], 'error')
            const vr = validate(toData(record(number)))
            assertEq(vr({})[0], 'ok')
            assertEq(vr({ p: 1 })[0], 'ok')
            // a key inherited from Object.prototype is still an extra key
            assertEq(vr({ toString: 1 })[0], 'ok')
            assertEq(vr({ toString: 'x' })[0], 'error')
            assertEq(
                JSON.stringify(vr({ p: 'a' })),
                '["error",{"path":["p"],"message":"unexpected value"}]')
            // declared keys are not re-checked against the rest
            /** @type {Data} */
            const structRest = [{}, { object: [{ props: { a: { number: true } }, rest: { string: true } }] }]
            const vs = validate(structRest)
            assertEq(vs({ a: 1, b: 's' })[0], 'ok')
            assertEq(vs({ a: 1, b: 2 })[0], 'error')
        },
        recursion: () => {
            const v = validate(toData(list))
            assertEq(v([])[0], 'ok')
            assertEq(v([[], [[]]])[0], 'ok')
            assertEq(v([[], [1]])[0], 'error')
            const vt = validate(toData(tree))
            assertEq(vt(5)[0], 'ok')
            assertEq(vt([5, [6]])[0], 'ok')
            assertEq(vt('x')[0], 'error')
            const vp = validate(toData({ p: list }))
            assertEq(vp({ p: [] })[0], 'ok')
            assertEq(vp({ p: 0 })[0], 'error')
            // the thunk-direct validator cannot terminate on a pure `or`
            // cycle for a non-matching value; the data form dissolves the
            // cycle to its least fixpoint and answers
            const vs = validate(toData(selfOr))
            assertEq(vs(5)[0], 'ok')
            assertEq(vs('x')[0], 'error')
        },
        throw: {
            // a dangling reference is malformed data — even one naming an
            // `Object.prototype` member, which own-property lookup rejects
            danglingReference: () => validate([{}, 'nope'])(1),
            danglingPrototypeReference: () => validate([{}, 'toString'])(1),
        },
    },
}
