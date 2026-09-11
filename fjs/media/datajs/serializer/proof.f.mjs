/**
 * @import { Unknown } from '../types.ts'
 * @import { _Read, _Value } from './types.ts'
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { invert, unwrap } from '../../../types/result/module.f.mjs'
import { concat } from '../../../types/string/module.f.mjs'
import { parse } from '../parser/module.f.mjs'
import { difference } from '../vectors/module.f.mjs'
import { _elementNames, _link, _memberValue, trySerialize, tryStringify } from './module.f.mjs'

/** The document a value is written as. @type {(value: unknown) => string} */
const text = value => unwrap(tryStringify(value))

/** Why a value is refused. Throws the document if it is written instead. @type {(value: unknown) => string} */
const refused = value => unwrap(invert(tryStringify(value)))

/**
 * The document a value is written as, read back by
 * [the reader](../parser/module.f.mjs) and compared with the value itself —
 * sharing included, since `difference` compares containers as a bijection.
 * This is the conformance criterion: a document that denotes the input
 * graph.
 *
 * @type {(value: Unknown) => void}
 */
const denotes = value => assertEq(difference(value)(unwrap(parse(text(value)))), null)

/** An empty array a `const` may hold, which `[]` alone types as an evolving array. @type {Unknown} */
const emptyArray = /** @type {readonly Unknown[]} */ ([])

export const proof = {
    // Every leaf of the model, and `undefined` as a leaf rather than as an
    // absent member.
    leaves: () => {
        assertEq(text(null), 'export default null;')
        assertEq(text(true), 'export default true;')
        assertEq(text(false), 'export default false;')
        assertEq(text(undefined), 'export default undefined;')
        assertEq(text('a'), 'export default "a";')
        assertEq(text(1n), 'export default 1n;')
    },
    // ECMAScript `ToString`, which is the specification's own algorithm,
    // with `-0` as its one departure. The thresholds are exact: `1e20` is
    // digits where `1e21` is an exponent, and `1e-6` is digits where `1e-7`
    // is an exponent.
    numbers: () => {
        assertEq(text(0), 'export default 0;')
        assertEq(text(-0), 'export default -0;')
        assertEq(text(-1), 'export default -1;')
        assertEq(text(1.5), 'export default 1.5;')
        assertEq(text(0.1), 'export default 0.1;')
        assertEq(text(NaN), 'export default NaN;')
        assertEq(text(Infinity), 'export default Infinity;')
        assertEq(text(-Infinity), 'export default -Infinity;')
        assertEq(text(1e20), 'export default 100000000000000000000;')
        assertEq(text(1e21), 'export default 1e+21;')
        assertEq(text(1e-6), 'export default 0.000001;')
        assertEq(text(1e-7), 'export default 1e-7;')
    },
    // A bigint is its full decimal digits and the suffix, at every
    // magnitude — an exponent would read back as a number — and zero is
    // `0n`, which a negative zero cannot reach because `BigInt` has none.
    bigints: () => {
        assertEq(text(0n), 'export default 0n;')
        assertEq(text(-0n), 'export default 0n;')
        assertEq(text(-5n), 'export default -5n;')
        assertEq(text(10n ** 30n), 'export default 1000000000000000000000000000000n;')
    },
    // `QuoteJSONString`, which is JSON's own spelling, lone surrogates
    // included.
    strings: () => {
        assertEq(text('"\\\n\t'), 'export default "\\"\\\\\\n\\t";')
        assertEq(text('\u0001'), 'export default "\\u0001";')
        assertEq(text('\ud800'), 'export default "\\ud800";')
        assertEq(text('/'), 'export default "/";')
    },
    containers: () => {
        assertEq(text(emptyArray), 'export default [];')
        assertEq(text([1, 'a', null]), 'export default [1,"a",null];')
        assertEq(text([[[1]]]), 'export default [[[1]]];')
        assertEq(text({}), 'export default {};')
        assertEq(text({ a: 1, b: [2] }), 'export default {"a":1,"b":[2]};')
    },
    // An object under a `null` prototype is data, and serializes as its
    // data — the specification permits it, and the reader may build one.
    nullPrototype: () => assertEq(text(Object.create(null)), 'export default {};'),
    // A member holding `undefined` is a member. Only the runtime enumerator
    // can tell it from an absent one, and reading descriptors is what keeps
    // it: `definedEntries`, which JSON's walk reads objects through, drops
    // it before any other seam runs.
    undefinedMember: () => {
        assertEq(text({ a: undefined }), 'export default {"a":undefined};')
        assertEq(text({}), 'export default {};')
    },
    // Observable key order, which is part of the value: array-index keys
    // first by numeric value, then the rest in first-occurrence order.
    keyOrder: () => assertEq(text({ 2: 0, 1: 0, b: 1, a: 2 }), 'export default {"1":0,"2":0,"b":1,"a":2};'),
    // `__proto__` has one spelling, the computed form. The plain string
    // form is a prototype assignment in JavaScript, and the reader refuses
    // it, so a document spelling it that way would not read back.
    //
    // `{ ['__proto__']: 1 }` is the member, not a prototype: a computed key
    // defines an own data property, which is why `fjs/AGENTS.md` §3.1 makes
    // it the spelling to write. `{ __proto__: 1 }` would be the assignment,
    // and on a number it would be a no-op rather than the member this
    // writer has to emit.
    protoKey: () => assertEq(text({ ['__proto__']: 1 }), 'export default {["__proto__"]:1};'),
    sharing: {
        // A node two references reach is a `const`; one reference leaves it
        // inline. The specification's own example: for `root=[p,p]` with
        // `p=[c]`, `p` is hoisted and `c` is not, even though two paths
        // reach `c`.
        occurrencesNotPaths: () => {
            const c = emptyArray
            const p = [c]
            assertEq(text([p, p]), 'const $0=[[]];export default [$0,$0];')
        },
        // Post-order naming, the specification's other example: for
        // `root = [parent, parent, child]` with `child` inside `parent`,
        // `child` finishes first, so it is `$0` and `parent` is `$1`.
        postOrderNames: () => {
            const child = emptyArray
            const parent = [child]
            assertEq(text([parent, parent, child]), 'const $0=[];const $1=[$0];export default [$1,$1,$0];')
        },
        // Sharing is by reference identity, so two equal containers written
        // apart stay two nodes.
        equalIsNotShared: () => assertEq(text([[], []]), 'export default [[],[]];'),
        // An object node is hoisted the same way an array node is.
        objects: () => {
            const shared = { a: 1 }
            assertEq(text({ x: shared, y: shared }), 'const $0={"a":1};export default {"x":$0,"y":$0};')
        },
    },
    // The document denotes the graph it was written from, sharing included.
    // The comparison is a bijection between containers, so a writer that
    // inlined a shared node would fail here even though its document parses.
    roundTrip: () => {
        const shared = { a: [1n, undefined] }
        denotes(shared)
        denotes([shared, shared])
        denotes({ 2: 0, 1: 0, b: emptyArray, ['__proto__']: null })
        denotes([-0, NaN, Infinity, '\ud800', true])
        denotes(emptyArray)
        // a `const` holding the computed key, which is the one place the
        // spelling has to survive a statement rather than the export. The
        // computed form is an own data property, as `protoKey` above notes.
        const proto = { ['__proto__']: 1 }
        denotes([proto, proto])
        // the spellings a number reaches that are not plain digits: both
        // exponent forms, a denormal, and the largest double. The reader
        // takes JSON's number grammar, so what the writer emits at these
        // magnitudes is exactly what has to parse back.
        denotes([1e21, 1e-7, 5e-324, 1.7976931348623157e308])
        denotes([1e20, 1e-6])
        denotes([10n ** 30n, -(10n ** 30n)])
    },
    // A caller may hand a writer a value outside the data model, and the
    // specification refuses it rather than approximating it — where
    // `JSON.stringify` writes `null` for a function and drops what it
    // cannot spell.
    refusals: {
        leafOutsideTheSet: () => {
            assertEq(refused(() => 1), 'a function is not a DataJS value')
            assertEq(refused(Symbol.iterator), 'a symbol is not a DataJS value')
        },
        // No descriptor check can catch these: each carries zero own
        // property descriptors and zero own symbols, exactly as `{}` does,
        // so a writer that classified by descriptors would write `new
        // Date()` as `{}`.
        nonPlainObject: () => {
            assertEq(refused(new Date(0)), 'a non-plain object')
            assertEq(refused(new Map()), 'a non-plain object')
            assertEq(refused(new Set()), 'a non-plain object')
            assertEq(refused(Object(1)), 'a non-plain object')
            assertEq(refused(Object.create({ x: 1 })), 'a non-plain object')
        },
        symbolKey: () => assertEq(refused({ [Symbol.iterator]: 1 }), 'an own symbol key'),
        // A hole is not an `undefined` element: `[undefined]` is a member
        // of the model and `new Array(1)` is not.
        hole: () => {
            assertEq(refused(new Array(1)), 'an array with a hole or an own property besides its elements')
            assertEq(text([undefined]), 'export default [undefined];')
        },
        // Refused where it is met, however deep, and through either kind of
        // container.
        belowTheRoot: () => {
            assertEq(refused({ a: { b: new Date(0) } }), 'a non-plain object')
            assertEq(refused([[() => 1]]), 'a function is not a DataJS value')
        },
    },
    // The rules the specification states, proved against the data they are
    // about. No value FunctionalScript can build carries an accessor, a
    // non-enumerable property, an own property on an array besides its
    // elements, or a cycle — the descriptors, the names and the graph those
    // would have are ordinary data, and are what these read.
    rules: {
        memberValue: () => {
            assertEq(unwrap(_memberValue('a', { value: 1, enumerable: true })), 1)
            // an attribute outside the data model is not grounds for a
            // refusal: a frozen object's members are non-writable and
            // non-configurable, and a reader may freeze what it returns
            assertEq(unwrap(_memberValue('a', { value: 1, enumerable: true, writable: false, configurable: false })), 1)
            assertEq(unwrap(invert(_memberValue('a', { get: () => 1, enumerable: true }))), 'a is an accessor property')
            assertEq(unwrap(invert(_memberValue('a', { set: () => {}, enumerable: true }))), 'a is an accessor property')
            assertEq(unwrap(invert(_memberValue('a', { value: 1, enumerable: false }))), 'a is a non-enumerable property')
        },
        elementNames: () => {
            assert(_elementNames(['length'], 0))
            assert(_elementNames(['0', '1', 'length'], 2))
            // a hole leaves a name out
            assert(!_elementNames(['length'], 1))
            assert(!_elementNames(['0', 'length'], 2))
            // any other own property adds one, enumerable or not
            assert(!_elementNames(['0', 'length', 'meta'], 1))
            // and `length` is where an array carries it
            assert(!_elementNames(['0', '1'], 2))
        },
        link: () => {
            const a = {}
            const b = {}
            /** @type {_Value<object>} */
            const refA = ['ref', a]
            /** @type {readonly _Read[]} */
            const acyclic = [
                [a, { kind: 'array', items: [['leaf', 1]] }],
                [b, { kind: 'object', members: [['k', refA], ['n', ['leaf', null]]] }],
            ]
            const graph = unwrap(_link(acyclic, ['ref', b]))
            assertEq(graph.nodes.length, 2)
            assertEq(graph.root[1], 1)
            // a node referring to itself, which is what `const $0=[$0];`
            // would be — a document that parses and denotes nothing
            assertEq(unwrap(invert(_link([[a, { kind: 'array', items: [refA] }]], refA))), 'a cycle')
            // and a cycle through two nodes, where every reference but one
            // points backwards
            /** @type {readonly _Read[]} */
            const mutual = [
                [b, { kind: 'array', items: [['ref', a]] }],
                [a, { kind: 'array', items: [['ref', b]] }],
            ]
            assertEq(unwrap(invert(_link(mutual, refA))), 'a cycle')
        },
    },
    // The chunks are the document; `tryStringify` is their `concat`.
    chunks: () => {
        const value = [1, { a: 2 }]
        assertEq(concat(unwrap(trySerialize(value))), text(value))
        assertEq(text(value), 'export default [1,{"a":2}];')
    },
}
