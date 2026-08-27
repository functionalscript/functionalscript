/**
 * @import { Or, Type } from '../types.ts'
 * @import { Data } from '../data/types.ts'
 * @import { Ts, TupleTs } from './types.ts'
 * @import { Assert } from '../../../asserts/types.ts'
 * @import { Equal } from '../../ts/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { toData, unitBit } from '../data/module.f.mjs'
import { boolean, number, string, bigint, unknown, array, open, record, or, option, rest, never } from '../module.f.mjs'
import { dataToTs, printer } from './module.f.mjs'

// ── `Ts<T>` over a tuple schema ─────────────────────────────────────────────
//
// Spelled as schema *types* rather than `typeof` a value: these are type-level
// facts, and a value existing only to be pointed at is an unused one.
//
// `TupleTs` splits off the trailing run of positions admitting `undefined` and
// renders it optional, which needs a known length. A schema array of non-fixed
// length — what `.map()` produces — has no trailing position to split off, so
// it keeps its element type instead, the homomorphic mapping's answer. Pinned
// because a split that falls back to the empty tuple silently renders such a
// schema `readonly []`, and nothing else here would have caught it.
/** @typedef {Assert<Equal<Ts<readonly (typeof number | typeof bigint)[]>, readonly (number | bigint)[]>>} _NonFixedLength */

// `option(t)` is `or(t, undefined)`; these are the schema types it produces.
/** @typedef {Or<readonly [typeof boolean, undefined]>} _OptionBoolean */
/** @typedef {Or<readonly [typeof string, undefined]>} _OptionString */

// A variadic tuple is the shape the `length` guard exists for, and the only
// one: its peel *succeeds*, binding the unknown-length prefix to `I`, so
// without the guard the reconstruction flattens it. The others below reach the
// fallback because their peel fails, and are held by that alone.
//
// Asserted as assignability rather than with `Equal<>`. `Equal<>` reports this
// shape as unchanged whether or not the guard is in place — it cannot see the
// difference — so an `Equal<>` pin here passes over the bug it is meant to
// catch. What the flattening actually costs is a string admitted in the number
// prefix, so that is what these state.
/** @typedef {readonly [...(typeof number)[], _OptionString]} _VariadicSchema */
/** @typedef {Assert<readonly [1, 'x', 2] extends Ts<_VariadicSchema> ? false : true>} _VariadicPrefixRejectsMixedPrefix */
/** @typedef {Assert<readonly [1, 2, 'x'] extends Ts<_VariadicSchema> ? true : false>} _VariadicPrefixAdmitsItsOwnShape */

// A rest element after a fixed prefix is the same shape from the other side,
// and is held for the same reason: `length` is `number`, so the mapping stands.
//
// This row and `_NonFixedLength` document intent rather than discriminate a
// mechanism. The guard and the fallback both answer `M` for these two shapes,
// so neither single mutation moves them — only removing both at once does.
// The rows that pin one mechanism each are `_VariadicPrefixRejectsMixedPrefix`
// (the guard), `_OptionalMember` (the fallback) and
// `_UnionKeepsBranchCorrelation` (the distribution).
/** @typedef {Assert<Equal<Ts<readonly [typeof number, ...(typeof string)[]]>, readonly [number, ...string[]]>>} _RestTuple */

// A schema whose own tuple type already marks a member optional is held by the
// *fallback* rather than the length guard: its length is `1 | 2`, not `number`,
// so it reaches the split, where the peel needs a required last element and
// finds none. An optional position is what this transform produces, so one the
// caller wrote is already in the target form and the mapping stands.
/** @typedef {Assert<Equal<Ts<readonly [typeof number, (typeof string)?]>, readonly [number, string?]>>} _OptionalMember */

// A union of tuple schemas is split per member, not once across the union.
// Splitting the union lets the two halves distribute independently and the
// spread then pairs every prefix with every suffix, so `[number, boolean]` —
// A's prefix with B's suffix — would pass. Assignability again: this is a
// statement about which values the union admits.
/** @typedef {readonly [typeof number, _OptionString]} _BranchA */
/** @typedef {readonly [typeof string, _OptionBoolean, _OptionNumber]} _BranchB */
/** @typedef {Or<readonly [typeof number, undefined]>} _OptionNumber */
/** @typedef {Assert<readonly [1, true] extends TupleTs<_BranchA | _BranchB> ? false : true>} _UnionKeepsBranchCorrelation */
/** @typedef {Assert<readonly [1, 'x'] extends TupleTs<_BranchA | _BranchB> ? true : false>} _UnionAdmitsItsOwnBranches */

/** @typedef {Assert<Equal<Ts<readonly [typeof number, typeof bigint, _OptionBoolean, _OptionString]>, readonly [number, bigint, (boolean | undefined)?, (string | undefined)?]>>} _OptionalTail */

// Only the *trailing* run: TypeScript forbids a required element after an
// optional one, so an interior position that admits `undefined` stays required.
/** @typedef {Assert<Equal<Ts<readonly [_OptionString, typeof number]>, readonly [string | undefined, number]>>} _InteriorStaysRequired */

const toTs = printer()

const toTsMut = printer(true)

/** @type {(rtti: Type, expected: string) => void} */
const eqMut = (rtti, expected) => {
    const result = toTsMut(rtti)
    if (result !== expected) { throw `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}` }
}

/** @type {(rtti: Type, expected: string) => void} */
const eq = (rtti, expected) => {
    const result = toTs(rtti)
    if (result !== expected) { throw `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}` }
}

/** @type {(data: Data, expected: unknown) => void} */
const eqData = (data, expected) => {
    const result = JSON.stringify(dataToTs()(data))
    const exp = JSON.stringify(expected)
    assertEq(result, exp, [result, exp])
}

/** A recursive list: `type list = readonly list[]`. */
/** @typedef {() => readonly ['array', _List]} _List */
/** @type {_List} */
const list = () => ['array', list]

/** Mutual recursion through a container. */
/** @typedef {() => readonly ['or', typeof number, _Forest]} _Tree */
/** @typedef {() => readonly ['array', _Tree]} _Forest */
/** @type {_Tree} */
const tree = () => ['or', number, forest]
/** @type {_Forest} */
const forest = () => ['array', tree]

/** A cycle closing through an anonymous `or` thunk — an empty rule name. */
/** @typedef {() => readonly ['record', () => readonly ['or', typeof string, _Lock]]} _Lock */
/** @type {_Lock} */
const lock = () => ['record', or(string, lock)]

/** A recursive rule whose function name is the predefined type name `string`. */
/** @typedef {() => readonly ['array', _StringNamed]} _StringNamed */
/** @type {{ readonly string: _StringNamed }} */
const stringNamedHolder = { string: () => ['array', stringNamedHolder.string] }
const stringNamed = stringNamedHolder.string

/** A recursive rule whose function name is `T0` — the first generated identifier. */
/** @typedef {() => readonly ['array', _T0Named]} _T0Named */
/** @type {{ readonly T0: _T0Named }} */
const t0NamedHolder = { T0: () => ['array', t0NamedHolder.T0] }
const t0Named = t0NamedHolder.T0

/** A recursive rule whose function name is the reserved word `if`. */
/** @typedef {() => readonly ['array', _IfNamed]} _IfNamed */
/** @type {{ readonly if: _IfNamed }} */
const ifNamedHolder = { if: () => ['array', ifNamedHolder.if] }
const ifNamed = ifNamedHolder.if

export const proof = {
    tag0: {
        boolean: () => eq(boolean, 'boolean'),
        number: () => eq(number, 'number'),
        string: () => eq(string, 'string'),
        bigint: () => eq(bigint, 'bigint'),
        unknown: () => eq(unknown, 'unknown'),
    },
    tag1: {
        array: {
            primitive: () => eq(array(number), 'readonly(number)[]'),
            nested: () => eq(array(array(boolean)), 'readonly(readonly(boolean)[])[]'),
            union: () => eq(array(or(number, string)), 'readonly(number|string)[]'),
        },
        record: {
            primitive: () => eq(record(string), '{readonly[k in string]?:string}'),
            nested: () => eq(record(record(number)), '{readonly[k in string]?:{readonly[k in string]?:number}}'),
        },
    },
    const: {
        null: () => eq(null, 'null'),
        undefined: () => eq(undefined, 'undefined'),
        true: () => eq(true, 'true'),
        false: () => eq(false, 'false'),
        number: () => eq(42, '42'),
        nan: () => eq(NaN, 'number'),
        inf: () => eq(Infinity, 'number'),
        negInf: () => eq(-Infinity, 'number'),
        string: () => eq('hello', '"hello"'),
        bigint: () => eq(7n, '7n'),
        // a bare tuple is closed, so it prints exactly — the same rendering
        // `Ts<>` gives it, which is what makes that cast sound
        emptyTuple: () => eq([], 'readonly[]'),
        tuple: () => eq([12, true], 'readonly[12,true]'),
        // a position the array may end before prints optional, as the key it
        // is the array counterpart of does
        optionalTuplePosition: () => eq(
            [number, option(string)],
            'readonly[number,(undefined|string)?]',
        ),
        allOptionalTuple: () => eq(
            [option(number)],
            'readonly[(undefined|number)?]',
        ),
        // a declared `unknown` key is a key the container has, so it is not
        // dropped the way an `open` struct's is
        emptyStruct: () => eq({}, '{}'),
        unknownProp: () => eq({ a: unknown }, '{readonly"a"?:unknown}'),
        struct: () => eq(
            { a: number, b: string },
            '{readonly"a":number,readonly"b":string}',
        ),
        nestedStruct: () => eq(
            { x: { y: boolean } },
            '{readonly"x":{readonly"y":boolean}}',
        ),
        quotedKey: () => eq(
            { 'my-key': number },
            '{readonly"my-key":number}',
        ),
        stringWithQuote: () => eq('say "hi"', '"say \\"hi\\""'),
        keyWithQuote: () => eq(
            { 'a"b': number },
            '{readonly"a\\"b":number}',
        ),
    },
    constThunk: {
        primitive: () => eq(() => ['const', 42n], '42n'),
        string: () => eq(() => ['const', 'hi'], '"hi"'),
    },
    or: {
        empty: () => eq(or(), 'never'),
        consts: () => eq(or(false, 42, 'hello'), 'false|42|"hello"'),
        thunks: () => eq(or(number, string), 'number|string'),
        mixed: () => eq(or(42, string), '42|string'),
    },
    // The open and stated-rest forms. An object type is structurally open in
    // TypeScript, so an `open` struct prints as wide as it can be printed;
    // a tuple has a rest element, so this printer says exactly what the schema
    // says — `Ts<>` renders the same tail, for the same reason.
    open: {
        // an unconstrained tuple, or struct, is the whole kind
        emptyTuple: () => eq(open([]), 'readonly(unknown)[]'),
        unconstrainedTuple: () => eq(open([unknown]), 'readonly(unknown)[]'),
        tuple: () => eq(open([12, true]), 'readonly[12,true,...readonly(unknown)[]]'),
        emptyStruct: () => eq(open({}), '{readonly[k in string]?:unknown}'),
        struct: () => eq(open({ a: number }), '{readonly"a":number}'),
        // an unconstrained key *is* dropped once the container is open
        unknownProp: () => eq(open({ a: unknown }), '{readonly[k in string]?:unknown}'),
        // a stated rest prints as the rest element / index signature it is.
        // The tail admits `undefined` because a hole past the prefix is no
        // member, so a reader skips it and the index reads `undefined`.
        tupleRest: () => eq(rest([number], string), 'readonly[number,...readonly(undefined|string)[]]'),
        structRest: () => eq(
            rest({ a: number }, string),
            '{readonly"a":number}&{readonly[k in string]?:number|string}',
        ),
        // `unknown` already admits `undefined`, so the open tail is unchanged
        openIsAnUnconstrainedRest: () => {
            assertEq(toTs(rest([number], unknown)), toTs(open([number])))
            assertEq(toTs(rest({ a: number }, unknown)), toTs(open({ a: number })))
        },
        // an empty rest is the bare form, recognized here through the data
        // form — including the `[or()]` spelling, which `RestTs` cannot see
        // and so renders with a (wider, still sound) tail
        emptyRestIsTheBareForm: () => {
            assertEq(toTs(rest([number], never)), toTs([number]))
            assertEq(toTs(rest([number], [never])), toTs([number]))
        },
        mut: () => eqMut(rest([number], string), '[number,...(undefined|string)[]]'),
    },
    never: () => eq(never, 'never'),
    // an array with no admissible element is the empty array, and nothing
    // past a prefix is what prints as an exact-length tuple
    arrayOfNever: () => eq(array(never), 'readonly[]'),
    // union members follow the canonical kind order, `undefined` first
    option: () => eq(option(number), 'undefined|number'),
    normalization: {
        booleanFromConsts: () => eq(or(true, false), 'boolean'),
        literalAbsorbed: () => eq(or(42, number), 'number'),
        sortedLiterals: () => eq(or(2, 1), '1|2'),
        sortedBigints: () => eq(or(2n, 1n), '1n|2n'),
        canonicalIdentity: () => {
            assertEq(toTs(or(string, number)), toTs(or(number, string)))
        },
        // a key admitting `undefined` may be absent — it prints optional
        optionalProp: () => eq({ x: option(string) }, '{readonly"x"?:undefined|string}'),
        mixedProps: () => eq(
            { a: number, b: option(number) },
            '{readonly"a":number,readonly"b"?:undefined|number}'),
    },
    recursion: {
        selfList: () => {
            eq(list, 'list')
            eqData(toData(list), [[['list', 'readonly(list)[]']], 'list'])
        },
        mutual: () => {
            eqData(toData(tree), [[['tree', 'number|readonly(tree)[]']], 'tree'])
            eqData(toData(forest), [[['tree', 'number|readonly(tree)[]']], 'readonly(tree)[]'])
        },
        recursiveUnion: () => {
            eqData(toData(or(number, list)), [[['list', 'readonly(list)[]']], 'number|readonly(list)[]'])
        },
        mutable: () => {
            const [defs, entry] = dataToTs(true)(toData(list))
            assertEq(JSON.stringify([defs, entry]), JSON.stringify([[['list', '(list)[]']], 'list']))
        },
    },
    identifiers: {
        // the empty rule name is not an identifier — generated `T0`
        emptyName: () => {
            eqData(toData(lock), [
                [['T0', 'string|{readonly[k in string]?:T0}']],
                '{readonly[k in string]?:T0}',
            ])
        },
        // a predefined type name cannot name an alias — generated `T0`
        predefinedName: () => {
            eqData(toData(stringNamed), [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        // reserved words cannot name an alias either — generated `T0`
        reservedName: () => {
            eqData(toData(ifNamed), [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        typeOperatorName: () => {
            eqData([{ infer: { array: [{ prefix: [], rest: 'infer' }] } }, 'infer'],
                [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        // reserved only in strict-mode code — but every module is strict
        strictModeReservedName: () => {
            eqData([{ let: { array: [{ prefix: [], rest: 'let' }] } }, 'let'],
                [[['T0', 'readonly(T0)[]']], 'T0'])
            eqData([{ intrinsic: { array: [{ prefix: [], rest: 'intrinsic' }] } }, 'intrinsic'],
                [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        // a generated identifier skips names already kept
        generatedCollision: () => {
            eqData(toData(/** @type {const} */ ([t0Named, lock])), [
                [['T1', 'string|{readonly[k in string]?:T1}'], ['T0', 'readonly(T0)[]']],
                'readonly[T0,{readonly[k in string]?:T1}]',
            ])
        },
    },
    data: {
        // The tail admits `undefined` on top of the rest — a hole past the
        // prefix is no member, so a reader skips it and the index reads
        // `undefined`. A rest that already admits it is printed as it is.
        tupleWithRest: () => {
            eqData([{}, { array: [{ prefix: [{ number: true }], rest: { string: true } }] }],
                [[], 'readonly[number,...readonly(undefined|string)[]]'])
            eqData([{}, { array: [{ prefix: [{ number: true }], rest: { unit: unitBit(undefined), string: true } }] }],
                [[], 'readonly[number,...readonly(undefined|string)[]]'])
        },
        // an exact-length pattern is the one that prints without a rest
        // element — what a bare, closed tuple converts to
        exactLengthTuple: () => {
            eqData([{}, { array: [{ prefix: [{ number: true }, { string: true }] }] }],
                [[], 'readonly[number,string]'])
        },
        structWithRest: () => {
            // the index signature must cover the declared keys too, so the
            // rest type widens to include the declared value types
            eqData([{}, { object: [{ props: { a: { number: true } }, rest: { string: true } }] }],
                [[], '{readonly"a":number}&{readonly[k in string]?:number|string}'])
            eqData([{}, { object: [{ props: { a: { string: true } }, rest: { string: true } }] }],
                [[], '{readonly"a":string}&{readonly[k in string]?:string}'])
        },
        optionalByReference: () => {
            eqData([{ r: { unit: unitBit(null) | unitBit(undefined), number: true } },
                { object: [{ props: { p: 'r' } }] }],
                [[['r', 'null|undefined|number']], '{readonly"p"?:r}'])
            eqData([{ r: { number: true } }, { object: [{ props: { p: 'r' } }] }],
                [[['r', 'number']], '{readonly"p":r}'])
        },
        wholeKinds: () => {
            eqData([{}, { array: true, object: true }],
                [[], 'readonly(unknown)[]|{readonly[k in string]?:unknown}'])
        },
    },
    mut: {
        array: () => eqMut(array(number), '(number)[]'),
        nestedArray: () => eqMut(array(array(boolean)), '((boolean)[])[]'),
        record: () => eqMut(record(string), '{[k in string]?:string}'),
        tuple: () => eqMut(open([12, true]), '[12,true,...(unknown)[]]'),
        struct: () => eqMut({ a: number, b: string }, '{"a":number,"b":string}'),
    },
    throw: {
        // a dangling reference is malformed data
        missingDefinition: () => dataToTs()([{}, 'nope']),
    },
}
