/**
 * @import { Type } from '../types.ts'
 * @import { Data } from '../data/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { absentBit, toData, unitBit } from '../data/module.f.mjs'
import { boolean, number, string, bigint, unknown, array, open, record, or, option, rest, never } from '../module.f.mjs'
import { dataToTs, printer } from './module.f.mjs'

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
        // a position the array may end before prints optional, with the
        // absent bit stripped from what it prints — exact under
        // `exactOptionalPropertyTypes`, as the key it is the array
        // counterpart of is
        optionalTuplePosition: () => eq(
            [number, or(option, string)],
            'readonly[number,(string)?]',
        ),
        allOptionalTuple: () => eq(
            [or(option, number)],
            'readonly[(number)?]',
        ),
        // an interior position admitting absence prints `undefined|T` — what
        // reading a hole gives, and the only spelling TypeScript allows
        // before a required element — while a present-`undefined` member
        // needs no conversion
        interiorOption: () => eq(
            [or(option, string), number],
            'readonly[undefined|string,number]',
        ),
        interiorUndefined: () => eq(
            [or(string, undefined), number],
            'readonly[undefined|string,number]',
        ),
        // a declared `unknown` key is a key the container has — and one that
        // must be *present*, `unknown` excluding absence — so it prints
        // required; "anything, or nothing" is `or(option, unknown)`
        emptyStruct: () => eq({}, '{}'),
        unknownProp: () => eq({ a: unknown }, '{readonly"a":unknown}'),
        unknownOrAbsentProp: () => eq({ a: or(option, unknown) }, '{readonly"a"?:unknown}'),
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
        // an unconstrained tuple, or struct, is the whole kind — a position
        // is unconstrained when it may hold anything *or nothing*, while a
        // plain `unknown` position requires presence and stays
        emptyTuple: () => eq(open([]), 'readonly(unknown)[]'),
        unconstrainedTuple: () => eq(open([or(option, unknown)]), 'readonly(unknown)[]'),
        requiredUnknownTuple: () => eq(
            open([unknown]),
            'readonly[unknown,...readonly(unknown)[]]',
        ),
        tuple: () => eq(open([12, true]), 'readonly[12,true,...readonly(unknown)[]]'),
        emptyStruct: () => eq(open({}), '{readonly[k in string]?:unknown}'),
        struct: () => eq(open({ a: number }), '{readonly"a":number}'),
        // the declared-member top — anything, or nothing — *is* dropped once
        // the container is open, while a plain `unknown` key requires
        // presence and survives
        unknownProp: () => eq(open({ a: unknown }), '{readonly"a":unknown}'),
        unknownOrAbsentProp: () => eq(
            open({ a: or(option, unknown) }),
            '{readonly[k in string]?:unknown}',
        ),
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
    // absence is not a value, so at the entry it prints as the rest of the
    // union — the public `Ts<>` of the same schema — and alone as `never`
    option: () => {
        eq(or(option, number), 'number')
        eq(option, 'never')
        eq(or(option, unknown), 'unknown')
    },
    normalization: {
        booleanFromConsts: () => eq(or(true, false), 'boolean'),
        literalAbsorbed: () => eq(or(42, number), 'number'),
        sortedLiterals: () => eq(or(2, 1), '1|2'),
        sortedBigints: () => eq(or(2n, 1n), '1n|2n'),
        canonicalIdentity: () => {
            assertEq(toTs(or(string, number)), toTs(or(number, string)))
        },
        // a key admitting absence prints optional with the bit stripped; one
        // admitting a present `undefined` prints required with it in the type
        optionalProp: () => eq({ x: or(option, string) }, '{readonly"x"?:string}'),
        presentUndefinedProp: () => eq({ x: or(string, undefined) }, '{readonly"x":undefined|string}'),
        mixedProps: () => eq(
            { a: number, b: or(option, number) },
            '{readonly"a":number,readonly"b"?:number}'),
    },
    recursion: {
        selfList: () => {
            /** A recursive list: `type list = readonly list[]`. */
            /** @typedef {() => readonly ['array', _List]} _List */
            /** @type {_List} */
            const list = () => ['array', list]
            eq(list, 'list')
            eqData(toData(list), [[['list', 'readonly(list)[]']], 'list'])
        },
        mutual: () => {
            /** Mutual recursion through a container. */
            /** @typedef {() => readonly ['or', typeof number, _Forest]} _Tree */
            /** @typedef {() => readonly ['array', _Tree]} _Forest */
            /** @type {_Tree} */
            const tree = () => ['or', number, forest]
            /** @type {_Forest} */
            const forest = () => ['array', tree]
            eqData(toData(tree), [[['tree', 'number|readonly(tree)[]']], 'tree'])
            eqData(toData(forest), [[['tree', 'number|readonly(tree)[]']], 'readonly(tree)[]'])
        },
        recursiveUnion: () => {
            /** A recursive list: `type list = readonly list[]`. */
            /** @typedef {() => readonly ['array', _List]} _List */
            /** @type {_List} */
            const list = () => ['array', list]
            eqData(toData(or(number, list)), [[['list', 'readonly(list)[]']], 'number|readonly(list)[]'])
        },
        mutable: () => {
            /** A recursive list: `type list = readonly list[]`. */
            /** @typedef {() => readonly ['array', _List]} _List */
            /** @type {_List} */
            const list = () => ['array', list]
            const [defs, entry] = dataToTs(true)(toData(list))
            assertEq(JSON.stringify([defs, entry]), JSON.stringify([[['list', '(list)[]']], 'list']))
        },
    },
    identifiers: {
        // the empty rule name is not an identifier — generated `T0`
        emptyName: () => {
            /** A cycle closing through an anonymous `or` thunk — an empty rule name. */
            /** @typedef {() => readonly ['record', () => readonly ['or', typeof string, _Lock]]} _Lock */
            /** @type {_Lock} */
            const lock = () => ['record', or(string, lock)]
            eqData(toData(lock), [
                [['T0', 'string|{readonly[k in string]?:T0}']],
                '{readonly[k in string]?:T0}',
            ])
        },
        // a predefined type name cannot name an alias — generated `T0`
        predefinedName: () => {
            /** A recursive rule whose function name is the predefined type name `string`. */
            /** @typedef {() => readonly ['array', _StringNamed]} _StringNamed */
            /** @type {{ readonly string: _StringNamed }} */
            const stringNamedHolder = { string: () => ['array', stringNamedHolder.string] }
            const stringNamed = stringNamedHolder.string
            eqData(toData(stringNamed), [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        // reserved words cannot name an alias either — generated `T0`
        reservedName: () => {
            /** A recursive rule whose function name is the reserved word `if`. */
            /** @typedef {() => readonly ['array', _IfNamed]} _IfNamed */
            /** @type {{ readonly if: _IfNamed }} */
            const ifNamedHolder = { if: () => ['array', ifNamedHolder.if] }
            const ifNamed = ifNamedHolder.if
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
            /** A recursive rule whose function name is `T0` — the first generated identifier. */
            /** @typedef {() => readonly ['array', _T0Named]} _T0Named */
            /** @type {{ readonly T0: _T0Named }} */
            const t0NamedHolder = { T0: () => ['array', t0NamedHolder.T0] }
            const t0Named = t0NamedHolder.T0
            /** A cycle closing through an anonymous `or` thunk — an empty rule name. */
            /** @typedef {() => readonly ['record', () => readonly ['or', typeof string, _Lock]]} _Lock */
            /** @type {_Lock} */
            const lock = () => ['record', or(string, lock)]
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
            // the absent bit read through a reference decides optionality,
            // and is masked from the rule's own definition
            eqData([{ r: { unit: unitBit(null) | absentBit, number: true } },
                { object: [{ props: { p: 'r' } }] }],
                [[['r', 'null|number']], '{readonly"p"?:r}'])
            // `undefined` as a value no longer makes a key optional
            eqData([{ r: { unit: unitBit(null) | unitBit(undefined), number: true } },
                { object: [{ props: { p: 'r' } }] }],
                [[['r', 'null|undefined|number']], '{readonly"p":r}'])
            eqData([{ r: { number: true } }, { object: [{ props: { p: 'r' } }] }],
                [[['r', 'number']], '{readonly"p":r}'])
        },
        interiorOptionByReference: () => {
            // an interior reference carrying the bit prints its identifier
            // with `undefined` unioned in front — the alias cannot be
            // rewritten, so the hole's reading rides beside it
            eqData([{ r: { unit: absentBit, number: true } },
                { array: [{ prefix: ['r', { number: true }] }] }],
                [[['r', 'number']], 'readonly[undefined|r,number]'])
            // and a trailing reference with the bit prints optional
            eqData([{ r: { unit: absentBit, number: true } },
                { array: [{ prefix: [{ number: true }, 'r'] }] }],
                [[['r', 'number']], 'readonly[number,(r)?]'])
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
