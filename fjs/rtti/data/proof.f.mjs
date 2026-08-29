/**
 * @import { Option, Or } from '../types.ts'
 * @import { Data } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import {
    array,
    bigint,
    boolean,
    open,
    never as neverRtti,
    number,
    option,
    or,
    record,
    rest,
    string,
    unknown as unknownRtti,
} from '../module.f.mjs'
import { absentBit, cmp, equal, never, subset, toData, unitBit, unitList, unknown, validate, withoutUnits } from './module.f.mjs'

/** @type {(actual: Data) => (expected: Data) => void} */
const assertData = actual => expected =>
    assert(equal(actual)(expected), [actual, expected])

/**
 * The recursive schemas the proofs below share. They are declared inside a
 * factory so their typedefs — recursive, so not inlinable — are
 * function-local: an authored `.mjs` carries no file-scope `@typedef`
 * (root `AGENTS.md`). The values are destructured back out, so every use
 * site below reads exactly as it would have.
 */
const recursiveSchemas = () => {
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
    /** @typedef {() => readonly ['const', { readonly value: typeof number, readonly next: Or<readonly [Option, _Odd]> }]} _Even */
    /** @typedef {() => readonly ['const', { readonly value: typeof number, readonly next: Or<readonly [Option, _Even]> }]} _Odd */
    /** @type {_Even} */
    const even = () => ['const', { value: number, next: or(option, odd) }]
    /** @type {_Odd} */
    const odd = () => ['const', { value: number, next: or(option, even) }]

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

    /** A cycle through a closed tuple: `_ClosedNode = [number, readonly _ClosedNode[]]`. */
    /** @typedef {() => readonly ['const', readonly [typeof number, _ClosedChildren]]} _ClosedNode */
    /** @typedef {() => readonly ['array', _ClosedNode]} _ClosedChildren */
    /** @type {_ClosedNode} */
    const closedNode = () => ['const', [number, closedChildren]]
    /** @type {_ClosedChildren} */
    const closedChildren = () => ['array', closedNode]

    /** A cycle through a struct's stated `rest`. */
    /** @typedef {() => readonly ['rest', { readonly a: typeof number }, _NestedRest]} _NestedRest */
    /** @type {_NestedRest} */
    const nestedRest = () => ['rest', { a: number }, nestedRest]

    /**
     * A recursive rule that admits absence, with a non-empty present part —
     * the referenced-rest exemption's ordinary case.
     *
     * @typedef {() => readonly ['or', typeof option, () => readonly ['array', _OptList]]} _OptList
     */

    /** @type {_OptList} */
    const optList = () => ['or', option, array(optList)]

    /**
     * An absence-only cycle: the pure `or` cycle dissolves to the absent bit
     * alone, so the rule's present part is empty — the case that shows masking
     * a referenced rest would be unsound.
     *
     * @typedef {() => readonly ['or', typeof option, _AbsCycleB]} _AbsCycleA
     * @typedef {() => readonly ['or', _AbsCycleA]} _AbsCycleB
     */

    /** @type {_AbsCycleA} */
    const absCycleA = () => ['or', option, absCycleB]

    /** @type {_AbsCycleB} */
    const absCycleB = () => ['or', absCycleA]

    /**
     * A pure `or` cycle normalizing to `or(option, number)` — a *referenced*
     * node whose stripped set equals a rest it trails.
     *
     * @typedef {() => readonly ['or', typeof option, typeof number, _OptNumB]} _OptNumA
     * @typedef {() => readonly ['or', _OptNumA]} _OptNumB
     */

    /** @type {_OptNumA} */
    const optNumA = () => ['or', option, number, optNumB]

    /** @type {_OptNumB} */
    const optNumB = () => ['or', optNumA]
    return { list, tree, forest, selfOr, orA, outer, inner, x, y, topArr, a2, recordSelf, even, odd, mkRec, anon, closedNode, nestedRest, optList, absCycleA, optNumA }
}

const {
    list, tree, forest, selfOr, orA,
    outer, inner, x, y, topArr,
    a2, recordSelf, even, odd, mkRec,
    anon, closedNode, nestedRest, optList, absCycleA,
    optNumA,
} = recursiveSchemas()

const tupleNumber = /** @type {const} */ ([number])
const tupleString = /** @type {const} */ ([string])
const tupleNumberNumber = /** @type {const} */ ([number, number])
const emptyTuple = /** @type {const} */ ([])

/**
 * The exact-length array patterns — what a bare, closed `Tuple` converts to,
 * and what an `open` one never reaches. Written as data as well so the
 * `rest`-less arm of every array operation is exercised from both ends.
 */
/** @type {Data} */
const exactlyOneNumber = [{}, { array: [{ prefix: [{ number: true }] }] }]
/** @type {Data} */
const exactlyTwoNumbers = [{}, { array: [{ prefix: [{ number: true }, { number: true }] }] }]

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
            // both const containers are closed, so each carries the `rest`
            // that says so — `never`, on either kind. `open` is what supplies
            // the `unknown` one, which the two kinds spell differently: a
            // `rest: unknown` past a tuple's prefix, and no `rest` at all on a
            // struct. An open tuple declaring nothing is therefore every array
            // — and so is one whose every position restates that `rest` as the
            // declared-member top `or(option, unknown)`, which is trimmed away
            // so that one set keeps one spelling. A position declared plain
            // `unknown` is *not* that top — it must be present — so it stays.
            assertData(toData(open(emptyTuple)))([{}, { array: true }])
            assertData(toData(open(/** @type {const} */ ([or(option, unknownRtti)]))))([{}, { array: true }])
            assertData(toData(open(/** @type {const} */ ([or(option, unknownRtti), or(option, unknownRtti)]))))([{}, { array: true }])
            assertData(toData(open(/** @type {const} */ ([unknownRtti]))))(
                [{}, { array: [{ prefix: [unknown], rest: unknown }] }])
            assertData(toData(open(/** @type {const} */ ([number, or(option, unknownRtti)]))))(toData(open(tupleNumber)))
            assertData(toData(open(/** @type {const} */ ([number, 42]))))(
                [{}, { array: [{ prefix: [{ number: true }, { number: [42] }], rest: unknown }] }])
            assertData(toData(open({})))([{}, { object: true }])
            assertData(toData(open({ b: string, a: number })))(
                [{}, { object: [{ props: { a: { number: true }, b: { string: true } } }] }])
            // a key declared `unknown` must be *present*, so it survives even
            // under `open` — the droppable declared top is `or(option, unknown)`
            assertData(toData(open({ a: unknownRtti })))(
                [{}, { object: [{ props: { a: unknown } }] }])
            assertData(toData(open({ a: or(option, unknownRtti) })))([{}, { object: true }])
            assertData(toData(/** @type {const} */ ([neverRtti])))([{}, never])
            assertData(toData({ a: neverRtti }))([{}, never])
        },
        // `rest` needs no new concept underneath: it is the schema-form
        // spelling of a `rest` the data form already carries — `never` for the
        // bare, closed container, `R` for a stated one — and `open` is the
        // `unknown` one.
        rest: () => {
            assertData(toData(tupleNumber))(exactlyOneNumber)
            assertData(toData(tupleNumberNumber))(exactlyTwoNumbers)
            assertData(toData(emptyTuple))([{}, { array: [{ prefix: [] }] }])
            assertData(toData({ a: number }))(
                [{}, { object: [{ props: { a: { number: true } }, rest: never }] }])
            assertData(toData({}))([{}, { object: [{ props: {}, rest: never }] }])
            // the bare form and an explicit empty rest are one set
            assertData(toData(tupleNumber))(toData(rest(tupleNumber, neverRtti)))
            // a stated rest is that rest
            assertData(toData(rest(tupleNumber, string)))(
                [{}, { array: [{ prefix: [{ number: true }], rest: { string: true } }] }])
            assertData(toData(rest({ a: number }, string)))(
                [{}, { object: [{ props: { a: { number: true } }, rest: { string: true } }] }])
            // an unconstrained rest is `open`, and normalizes the same way on
            // both kinds
            assertData(toData(rest(tupleNumber, unknownRtti)))(toData(open(tupleNumber)))
            assertData(toData(rest({ a: number }, unknownRtti)))(toData(open({ a: number })))
            // a `never` member empties the whole pattern, whatever the rest
            assertData(toData(/** @type {const} */ ([neverRtti])))([{}, never])
            assertData(toData({ a: neverRtti }))([{}, never])
            // an unconstrained key — "anything, or nothing", the declared-member
            // top `or(option, unknown)` — is dropped only once the rest is gone:
            // with one present, "anything at `a`" says strictly more than
            // leaving `a` out, which `open({ a: or(option, unknown) })` alone
            // does not. Plain `unknown` at a key is not that top: it requires
            // presence, so it is never dropped.
            assertData(toData(open({ a: or(option, unknownRtti) })))([{}, { object: true }])
            assertData(toData({ a: or(option, unknownRtti) }))(
                [{}, { object: [{ props: { a: { ...unknown, unit: unitBit(null) | unitBit(undefined) | unitBit(false) | unitBit(true) | absentBit } }, rest: never }] }])
            assertData(toData({ a: unknownRtti }))(
                [{}, { object: [{ props: { a: unknown }, rest: never }] }])
            // the same container bare and opened are two sets, so the
            // by-identity memo for const containers must not answer for both
            assert(!equal(toData(/** @type {const} */ ([tupleNumber, open(tupleNumber)])))(
                toData(/** @type {const} */ ([tupleNumber, tupleNumber]))))
        },
        // A cycle closes through a stated `rest` the same way it closes
        // through a bare container: the enclosing thunk is what becomes the
        // named rule.
        restRecursion: () => {
            assertData(toData(closedNode))([
                {
                    closedNode: {
                        array: [{
                            prefix: [
                                { number: true },
                                { array: [{ prefix: [], rest: 'closedNode' }] },
                            ],
                        }],
                    },
                },
                'closedNode',
            ])
            // and a cycle whose recursive position is the rest itself
            assertData(toData(nestedRest))(
                [{ nestedRest: { object: [{ props: { a: { number: true } }, rest: 'nestedRest' }] } }, 'nestedRest'])
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
            // absence is the fifth unit bit, merged like any other — and the
            // explicit `thunkUnion` case is what keeps `toData(option)` from
            // falling into the empty-operand `or` arm and reading as `never`
            assertData(toData(option))([{}, { unit: absentBit }])
            assertData(toData(or(option, string)))([{}, { unit: absentBit, string: true }])
            assertData(toData(or(option, number)))([{}, { unit: absentBit, number: true }])
            assertData(toData(or(option, string, undefined)))(
                [{}, { unit: unitBit(undefined) | absentBit, string: true }])
            assert(!equal(toData(or(option, number)))(toData(number)))
            assertData(toData(or(unknownRtti, number)))([{}, unknown])
            assertData(toData(or(number, or(string, boolean))))(
                [{}, { unit: unitBit(false) | unitBit(true), number: true, string: true }])
            assertData(toData(or(1, or(1, 2))))([{}, { number: [1, 2] }])
        },
        // The normalizations the absent bit changes, pinned so each
        // degenerate spelling's normal form stays deliberate.
        absence: {
            // a rest never sees an absent member, so an inline rest is
            // stripped of the bit — on both kinds, and at the top-level
            // spelling too
            restIsStripped: () => {
                assertData(toData(array(or(option, number))))(toData(array(number)))
                assertData(toData(record(or(option, number))))(toData(record(number)))
                assertData(toData(rest([number], or(option, string))))(
                    toData(rest([number], string)))
                assertData(toData(rest({ a: number }, or(option, string))))(
                    toData(rest({ a: number }, string)))
                // …while a declared *position* keeps its bit: absence is
                // observable there
                assertData(toData(open([or(option, number)])))(
                    [{}, { array: [{ prefix: [{ unit: absentBit, number: true }], rest: unknown }] }])
            },
            // `array(option)` has an empty element set once the bit is
            // stripped, and a `never` rest is the exact-length set of its
            // (empty) prefix: the empty array
            arrayOfOptionIsTheEmptyArray: () => {
                assertData(toData(array(option)))(toData(/** @type {const} */ ([])))
                assertEq(validate(toData(array(option)))([])[0], 'ok')
                assertEq(validate(toData(array(option)))(new Array(1))[0], 'error')
            },
            // the redesigned trim: a trailing declared position that admits
            // absence and whose stripped set restates the rest is dropped —
            // `rest([or(option, number)], number)` and `array(number)` denote
            // one set of arrays, so they get one `Node`
            trailingPositionRestatingTheRest: () => {
                assertData(toData(rest([or(option, number)], number)))(toData(array(number)))
                assertData(toData(rest([number, or(option, number)], number)))(
                    toData(rest([number], number)))
                // without the bit the position is "one or more", not restating
                assert(!equal(toData(rest([number], number)))(toData(array(number))))
                // and a stripped set differing from the rest is kept
                assert(!equal(toData(rest([or(option, string)], number)))(toData(array(number))))
            },
            // `[option]` is not `[]`: its sole position strips to `never`
            // like its (empty) rest, and the trim never reaches an empty
            // rest — the two differ on `new Array(1)`, a length the first
            // admits and the second bounds out
            absentOnlyPositionIsNotDropped: () => {
                assert(!equal(toData(/** @type {const} */ ([option])))(
                    toData(/** @type {const} */ ([]))))
                const v1 = validate(toData(/** @type {const} */ ([option])))
                assertEq(v1(new Array(1))[0], 'ok')
                assertEq(v1([])[0], 'ok')
                assertEq(v1([1])[0], 'error')
                assertEq(v1([undefined])[0], 'error')
                const v0 = validate(toData(/** @type {const} */ ([])))
                assertEq(v0([])[0], 'ok')
                assertEq(v0(new Array(1))[0], 'error')
            },
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
                { object: [{ props: { p: 'list' }, rest: never }] },
            ])
            assertData(toData(a2))([
                {
                    a2: {
                        array: [{
                            prefix: [],
                            rest: { array: [{ prefix: ['a2', 'b2'] }] },
                        }],
                    },
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
            // a longer tuple pattern is included in a shorter one when both
            // are open — the array counterpart of a wider struct in a narrower
            // one. Closed, neither includes the other: they differ in length.
            assertData(toData(or(open(tupleNumberNumber), open(tupleNumber))))(toData(open(tupleNumber)))
            // the empty-array pattern is a member of every uniform array set
            assertData(toData(or(array(neverRtti), array(number))))(toData(array(number)))
            assertData(toData(or(array(number), array(neverRtti))))(toData(array(number)))
            // an open tuple declaring nothing absorbs the whole kind
            assertData(toData(or(open(emptyTuple), array(number))))(toData(array(unknownRtti)))
            // kept when neither pattern subsumes the other: an open `[number]`
            // admits `[1, 'x']`, which `readonly number[]` does not, and the
            // uniform set admits `[]`, which the tuple does not
            assertData(toData(or(open(tupleNumber), array(number))))([{}, {
                array: [
                    { prefix: [], rest: { number: true } },
                    { prefix: [{ number: true }], rest: unknown },
                ],
            }])
            assertData(toData(or(open(tupleNumber), open(tupleString))))([{}, {
                array: [
                    { prefix: [{ string: true }], rest: unknown },
                    { prefix: [{ number: true }], rest: unknown },
                ],
            }])
            // the collapse recurses into inline positions
            assertData(toData(array(or(open(tupleNumberNumber), open(tupleNumber)))))(
                toData(array(open(tupleNumber))))
            assertData(toData(record(or(open(tupleNumberNumber), open(tupleNumber)))))(
                toData(record(open(tupleNumber))))
            assertData(toData({ a: or(open(tupleNumberNumber), open(tupleNumber)) }))(
                toData({ a: open(tupleNumber) }))
            // collapsing innards can make two patterns identical — deduplicated
            assertData(toData(or(array(or(open(tupleNumberNumber), open(tupleNumber))), array(open(tupleNumber)))))(
                toData(array(open(tupleNumber))))
            // subsumed object patterns are dropped, `true` absorbs patterns
            assertData(toData(or({ a: 42 }, { a: number })))(toData({ a: number }))
            assertData(toData(or(open({ a: number }), open({}))))(toData(open({})))
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
        // Two spellings of one set must not compare unequal, and two sets must
        // not compare equal — the data form is content-addressed.
        rest: () => {
            assertEq(cmp(toData(tupleNumber))(toData(rest(tupleNumber, neverRtti))), 0)
            assertEq(cmp(toData(rest(tupleNumber, unknownRtti)))(toData(open(tupleNumber))), 0)
            assert(cmp(toData(tupleNumber))(toData(open(tupleNumber))) !== 0)
            assert(cmp(toData({ a: number }))(toData(open({ a: number }))) !== 0)
            assert(cmp(toData(tupleNumber))(toData(rest(tupleNumber, string))) !== 0)
            assert(equal(toData(tupleNumber))(exactlyOneNumber))
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
            assertData(toData(or(open({ a: number }), record(number))))(
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
            // a longer open tuple is included in a shorter one, and neither is
            // included in the uniform set: an open `[number]` admits `[1, 'x']`
            assert(subset(toData(open(tupleNumberNumber)))(toData(open(tupleNumber))))
            assert(!subset(toData(open(tupleNumber)))(toData(open(tupleNumberNumber))))
            assert(!subset(toData(open(tupleNumber)))(toData(array(number))))
            assert(!subset(toData(array(number)))(toData(open(tupleNumber))))
            // the exact-length pattern — the bare, closed tuple — is the one
            // the uniform set contains
            assert(subset(exactlyOneNumber)(toData(array(number))))
            assert(subset(exactlyOneNumber)(toData(open(tupleNumber))))
            // and, admitting one length only, contains just its own
            assert(subset(exactlyOneNumber)(exactlyOneNumber))
            assert(!subset(exactlyOneNumber)(exactlyTwoNumbers))
            assert(!subset(toData(open(tupleNumber)))(exactlyOneNumber))
            assert(subset(toData(array(number)))(toData(unknownRtti)))
            assert(!subset(toData(array(unknownRtti)))(toData(array(number))))
            assert(subset(toData(array(number)))(toData(array(or(number, string)))))
            assert(!subset(toData(open(tupleNumber)))(toData(open(tupleString))))
        },
        arrayRest: () => {
            /** @type {Data} */
            const oneOrMoreNumbers = [{}, { array: [{ prefix: [{ number: true }], rest: { number: true } }] }]
            // a position restating a `rest` that excludes `undefined` is not
            // redundant — it is what makes this "one or more" rather than the
            // uniform set, so nothing trims it away
            assert(subset(oneOrMoreNumbers)(toData(array(number))))
            assert(!subset(toData(array(number)))(oneOrMoreNumbers))
            assert(subset(exactlyTwoNumbers)(oneOrMoreNumbers))
            // the open tuple of two numbers admits a third element of any kind
            assert(!subset(toData(open(tupleNumberNumber)))(oneOrMoreNumbers))
            // an open tuple declaring nothing is the whole kind
            assert(!subset(toData(open(emptyTuple)))(oneOrMoreNumbers))
            /** @type {Data} */
            const oneNumberThenStrings = [{}, { array: [{ prefix: [{ number: true }], rest: { string: true } }] }]
            assert(!subset(oneOrMoreNumbers)(oneNumberThenStrings))
        },
        // A **referenced** rest is left unstripped — the same rule may sit at
        // a declared position, where the bit is live — and `subset` resolves
        // it rather than masking the bit. The cost is one-way inclusion: the
        // stripped form bounds nothing new where the present part is
        // non-empty, and bounds the *length* where it is empty, so `equal`
        // answers "different spelling" — the structural incompleteness
        // `./README.md` records beside rule names.
        referencedRest: () => {
            // the exemption itself: the rest stays a reference, bit intact
            assertData(toData(rest([number], optList)))([
                { optList: { unit: absentBit, array: [{ prefix: [], rest: 'optList' }] } },
                { array: [{ prefix: [{ number: true }], rest: 'optList' }] },
            ])
            // the stripped fixpoint is a *different rule*, not a bit-mask:
            // one-way inclusion, resolved coinductively
            /** @type {Data} */
            const stripped = [
                { optList0: { array: [{ prefix: [], rest: 'optList0' }] } },
                { array: [{ prefix: [{ number: true }], rest: 'optList0' }] },
            ]
            assert(subset(stripped)(toData(rest([number], optList))))
            assert(!subset(toData(rest([number], optList)))(stripped))
            // the absence-only cycle is where masking would be unsound: the
            // syntactic form keeps a rest and admits any hole-only array,
            // while the stripped form is `never` and bounds the length — two
            // sets, not one set spelled twice
            const holey = toData(rest([number], absCycleA))
            assertData(holey)([
                { absCycleA: { unit: absentBit } },
                { array: [{ prefix: [{ number: true }], rest: 'absCycleA' }] },
            ])
            assertEq(validate(holey)([1, , , ])[0], 'ok')
            assertEq(validate(holey)([1, 2])[0], 'error')
            assertEq(validate(toData(tupleNumber))([1, , , ])[0], 'error')
            assert(subset(toData(tupleNumber))(holey))
            assert(!subset(holey)(toData(tupleNumber)))
            // a referenced **trailing position** is exempt by the same rule:
            // `optNumA` normalizes to `or(option, number)`, whose stripped
            // set restates the rest — an inline spelling trims — but neither
            // `trimPrefix` nor `arraySet` takes a rule set to resolve the
            // reference with, so it stays untrimmed, structurally distinct
            // from `array(number)`, and still read the same way
            const referencedTrailing = toData(rest([optNumA], number))
            assertData(referencedTrailing)([
                { optNumA: { unit: absentBit, number: true } },
                { array: [{ prefix: ['optNumA'], rest: { number: true } }] },
            ])
            assert(!equal(referencedTrailing)(toData(array(number))))
            // the readers still agree on what both spellings accept
            assertEq(validate(referencedTrailing)([])[0], 'ok')
            assertEq(validate(referencedTrailing)([1, 2])[0], 'ok')
            assertEq(validate(referencedTrailing)(['x'])[0], 'error')
        },
        // A declared position asks the object kind's two questions: the
        // absence-stripped sets compared, and absence implied. This pair is
        // what tells the two halves apart — the left's only values are
        // `new Array(1)` and `[number]`, which `array(number)` admits (a hole
        // is no entry) and the closed `[number]` does not (position 0 is
        // required there).
        arrayAbsence: () => {
            assert(subset(toData(/** @type {const} */ ([or(option, number)])))(toData(array(number))))
            assert(!subset(toData(/** @type {const} */ ([or(option, number)])))(toData(tupleNumber)))
            // absence implied by a hole past the right's prefix…
            assert(subset(toData(/** @type {const} */ ([number, or(option, number)])))(
                toData(rest([number], number))))
            // …or by the right position's own bit
            assert(subset(toData(/** @type {const} */ ([or(option, 42)])))(
                toData(/** @type {const} */ ([or(option, number)]))))
            // and never invented: a stripped-equal pair still fails when the
            // right requires presence
            assert(!subset(toData(open([or(option, number)])))(toData(open(tupleNumber))))
            // the reverse inclusion is the ordinary pointwise one
            assert(subset(toData(tupleNumber))(toData(/** @type {const} */ ([or(option, number)]))))
        },
        // The closed default makes a `rest`-less array pattern and an object
        // pattern with an empty `rest` the *ordinary* output of the thunk
        // form, where hand-written data used to be the only way to reach
        // either. Both directions of each.
        rest: () => {
            // closed is included in open, never the other way round
            assert(subset(toData(tupleNumber))(toData(open(tupleNumber))))
            assert(!subset(toData(open(tupleNumber)))(toData(tupleNumber)))
            assert(subset(toData({ a: number }))(toData(open({ a: number }))))
            assert(!subset(toData(open({ a: number })))(toData({ a: number })))
            // an exact length is its own, and contains no other
            assert(subset(toData(tupleNumber))(toData(tupleNumber)))
            assert(!subset(toData(tupleNumber))(toData(tupleNumberNumber)))
            assert(!subset(toData(tupleNumberNumber))(toData(tupleNumber)))
            // a stated rest widens it, and an unconstrained one is openness
            assert(subset(toData(tupleNumber))(toData(rest(tupleNumber, string))))
            assert(!subset(toData(rest(tupleNumber, string)))(toData(tupleNumber)))
            assert(subset(toData(rest(tupleNumber, string)))(toData(rest(tupleNumber, unknownRtti))))
            assert(subset(toData({ a: number }))(toData(rest({ a: number }, string))))
            assert(!subset(toData(rest({ a: number }, string)))(toData({ a: number })))
            assert(subset(toData(rest({ a: number }, number)))(toData(record(number))))
            assert(!subset(toData(record(number)))(toData(rest({ a: number }, number))))
            // and the members are still compared pointwise
            assert(subset(toData(/** @type {const} */ ([42])))(toData(tupleNumber)))
            assert(!subset(toData(tupleNumber))(toData(tupleString)))
            assert(subset(toData(closedNode))(toData(closedNode)))
        },
        // A key present holding `undefined` and a key absent are two different
        // objects, told apart by two different bits: `unitBit(undefined)` is a
        // value the key may hold, `absentBit` is leave-it-out. The per-key
        // check asks two questions — the **absence-stripped** present sets
        // compared, and absence implied — and neither implies the other.
        presenceIsNotAbsence: () => {
            // `{ a: or(option, number) }` denotes `{}` and `{ a: number }`,
            // both of which `record(number)` admits, so the inclusion holds —
            // it is the *stripped* present set that is compared. The old
            // `option(number)` spelling admitted `{ a: undefined }` and was
            // rightly excluded; that spelling is now `or(option, number,
            // undefined)`, and still is.
            const p = toData({ a: or(option, number) })
            const q = toData(record(number))
            assert(subset(p)(q))
            assertEq(validate(p)({ a: undefined })[0], 'error')
            assertEq(validate(q)({ a: undefined })[0], 'error')
            assert(!subset(toData({ a: or(option, number, undefined) }))(q))
            assertEq(validate(toData({ a: or(option, number, undefined) }))({ a: undefined })[0], 'ok')
            // both halves of the per-key check are load-bearing, and neither
            // implies the other: this pair agrees on every present value and
            // differs only on whether the key may be missing
            assert(!subset(toData(record(number)))(toData(rest({ a: number }, number))))
            assertEq(validate(toData(record(number)))({})[0], 'ok')
            assertEq(validate(toData(rest({ a: number }, number)))({})[0], 'error')
            // present-undefined alone also breaks the inclusion — the absent
            // bit is not what carries it
            assert(!subset(toData({ a: or(number, undefined) }))(toData(record(number))))
        },
        objects: () => {
            assert(subset(toData(open({ a: number })))(toData(open({}))))
            assert(subset(toData({ a: 42 }))(toData({ a: number })))
            assert(!subset(toData({ a: number }))(toData({ a: 42 })))
            assert(subset(toData(open({ a: number, b: string })))(toData(open({ a: number }))))
            assert(subset(toData(record(number)))(toData(record(or(number, string)))))
            assert(!subset(toData(record(or(number, string))))(toData(record(number))))
            // a record's keys may be absent, a required key excludes that
            assert(!subset(toData(record(number)))(toData(open({ a: number }))))
            assert(subset(toData(record(number)))(toData(open({ a: or(option, number) }))))
            // an open struct leaves undeclared keys unconstrained, a record
            // does not — while a closed one names them all, so it is included
            assert(!subset(toData(open({ a: number })))(toData(record(number))))
            assert(subset(toData({ a: number }))(toData(record(number))))
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
            // an open tuple admits a longer array, and a position is required
            // exactly when its set excludes `undefined`, so a shorter one is a
            // member whenever the positions past its end admit absence
            const vt = validate(toData(open(/** @type {const} */ ([number, string]))))
            assertEq(vt([1, 'a'])[0], 'ok')
            assertEq(vt([1, 'a', 2])[0], 'ok')
            assertEq(
                JSON.stringify(vt([1])),
                '["error",{"path":["1"],"message":"unexpected value"}]')
            const vo = validate(toData(open(/** @type {const} */ ([number, or(option, string)]))))
            assertEq(vo([1])[0], 'ok')
            assertEq(vo([1, 'a'])[0], 'ok')
            assertEq(vo([])[0], 'error')
            // the exact-length pattern admits neither, and counts a hole past
            // the prefix: not an entry, but the array is still that long
            const vx = validate(exactlyOneNumber)
            assertEq(vx([1])[0], 'ok')
            assertEq(vx([1, 2])[0], 'error')
            assertEq(vx([])[0], 'error')
            assertEq(vx([1, , ])[0], 'error')
            assertEq(validate(toData(array(neverRtti)))([, ])[0], 'error')
            assertEq(validate(toData(array(neverRtti)))([])[0], 'ok')
            assertEq(validate(toData(array(neverRtti)))([1])[0], 'error')
            // an enumerable non-index key is an entry the prefix has not
            // spoken for, like an index past it: the `rest` answers it, and
            // an exact-length pattern, having no `rest`, rejects it
            assertEq(validate(toData(array(number)))(Object.assign([1], { foo: 2 }))[0], 'ok')
            assertEq(validate(toData(array(number)))(Object.assign([1], { foo: 'x' }))[0], 'error')
            assertEq(validate(toData(array(neverRtti)))(Object.assign([], { foo: 'x' }))[0], 'error')
            assertEq(validate(exactlyOneNumber)(Object.assign([1], { foo: 1 }))[0], 'error')
            // only the canonical spelling of a non-negative integer is a
            // position; every other key is a property of the array object,
            // whatever `Number` makes of it
            for (const k of ['-1', '01', '1.5', ' 1', '1e0']) {
                assertEq(validate(toData(array(number)))(Object.assign([1], { [k]: 'x' }))[0], 'error')
                assertEq(validate(exactlyTwoNumbers)(Object.assign([1, 2], { [k]: 2 }))[0], 'error')
            }
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
            const v = validate(toData(open({ a: number, b: or(option, string) })))
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
