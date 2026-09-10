/**
 * @import { Unknown } from '../types.ts'
 * @import { Accept } from './types.ts'
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { parse } from '../parser/module.f.mjs'
import { difference } from './module.f.mjs'
import accept from '../../../../spec/datajs/vectors/accept/data.f.mjs'

/** The reader accept set, typed at the import since a set carries no annotations. */
const acceptSet = /** @type {readonly Accept[]} */ (accept)

/**
 * One accept vector against the reader: the document is accepted, and
 * what it yields is the graph the vector expects, sharing included.
 *
 * @type {(vector: Accept) => void}
 */
const accepted = ({ id, document, graph }) => {
    // the byte form waits on the reader's byte path
    assert(typeof document === 'string', `${id}: a byte document has no reader yet`)
    const [tag, result] = parse(document)
    assert(tag === 'ok', `${id}: refused: ${result}`)
    const d = difference(graph)(result)
    assert(d === null, `${id}: ${d}`)
}

/** Two graphs that must compare equal. @type {(expected: Unknown, actual: Unknown) => void} */
const same = (expected, actual) => assertEq(difference(expected)(actual), null)

/** Two graphs whose first difference is the message. @type {(expected: Unknown, actual: Unknown, message: string) => void} */
const differ = (expected, actual, message) => assertEq(difference(expected)(actual), message)

/**
 * A host value handed to the comparison as if it were a graph, which is what
 * a broken implementation does. @type {(value: unknown) => Unknown}
 */
const outside = value => /** @type {Unknown} */ (value)

/** `n` arrays nested, the innermost holding `leaf`. @type {(n: number, leaf: Unknown) => Unknown} */
const nested = (n, leaf) => {
    /** @type {Unknown} */
    let result = leaf
    for (let i = 0; i < n; i += 1) { result = [result] }
    return result
}

export const proof = {
    // A leaf is itself under `Object.is`: every kind of the data model, with
    // the two cases structural equality gets wrong — the zeros differ, and
    // `NaN` is one value.
    leaves: () => {
        same(null, null)
        same(true, true)
        same(false, false)
        same(undefined, undefined)
        same(1.5, 1.5)
        same(NaN, NaN)
        same(Infinity, Infinity)
        same(-Infinity, -Infinity)
        same(0n, 0n)
        same(-9n, -9n)
        same('', '')
        same('\ud800', '\ud800')
        differ(-0, 0, 'at $: expected -0, got 0')
        differ(0, -0, 'at $: expected 0, got -0')
        differ(1, 1n, 'at $: expected 1, got 1n')
        differ(undefined, null, 'at $: expected undefined, got null')
        differ('a', 'b', 'at $: expected "a", got "b"')
        // a lone surrogate is shown escaped, as `JSON.stringify` spells it
        differ('\ud800', '\udc00', 'at $: expected "\\ud800", got "\\udc00"')
        differ(true, 'true', 'at $: expected true, got "true"')
    },
    // A container is compared by kind, size and, for an object, the keys in
    // observable order; then by its members, each named by its path.
    containers: () => {
        same([], [])
        same({}, {})
        same([1, [2n, [3]], { a: [null] }], [1, [2n, [3]], { a: [null] }])
        same({ a: undefined }, { a: undefined })
        differ([], {}, 'at $: expected an array, got an object')
        differ({}, [], 'at $: expected an object, got an array')
        differ([], 1, 'at $: expected an array, got 1')
        differ({}, null, 'at $: expected an object, got null')
        differ(1, [], 'at $: expected 1, got an array')
        differ([1], [1, 2], 'at $: expected 1 elements, got 2')
        differ([1, 2], [1, 3], 'at $[1]: expected 2, got 3')
        differ({ a: 1 }, { a: 1, b: 2 }, 'at $: expected 1 members, got 2')
        differ({ a: 1, b: 2 }, { b: 2, a: 1 }, 'at $: expected member 0 to be "a", got "b"')
        differ({ a: 1 }, { b: 1 }, 'at $: expected member 0 to be "a", got "b"')
        differ({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] }, 'at $["a"][1]["b"]: expected "x", got "y"')
        // an object member holding `undefined` is present, and differs from
        // an absent one by the count; an array element holding `undefined`
        // is present, and differs from a hole, which no expected graph has
        differ({ a: undefined }, {}, 'at $: expected 1 members, got 0')
        differ([undefined], [, undefined].slice(0, 1), 'at $[0]: expected undefined, got a hole')
        differ([1, [2, 3]], [1, [2, , 4].slice(0, 2)], 'at $[1][1]: expected 3, got a hole')
        // in document order: an earlier element's difference comes first
        differ([1, 2], [9, , 3].slice(0, 2), 'at $[0]: expected 1, got 9')
        differ([[1], 2], [[9], , 3].slice(0, 2), 'at $[0][0]: expected 1, got 9')
        same([undefined, 1], [undefined, 1])
    },
    // An object of the data model is a plain one: a host object with no
    // members — a `Date`, a `Map`, a boxed number — is not an empty object,
    // at the root and below it.
    plain: () => {
        differ({}, outside(new Date(0)), 'at $: expected an object, got a non-plain object')
        differ({}, outside(new Map()), 'at $: expected an object, got a non-plain object')
        differ({ a: 1 }, outside(Object(1)), 'at $: expected an object, got a non-plain object')
        differ([{}], [outside(new Date(0))], 'at $[0]: expected an object, got a non-plain object')
        differ(1, outside(new Date(0)), 'at $: expected 1, got an object')
    },
    // Sharing is part of the graph, in both directions: a node the expected
    // graph reaches twice must be one node in the actual, and two nodes it
    // keeps apart may not be merged.
    sharing: () => {
        const a = [1]
        const b = [1]
        same([a, a], [b, b])
        same({ x: a, y: a }, { x: b, y: b })
        same([a, { x: a }], [b, { x: b }])
        same([[1], [1]], [[1], [1]])
        differ([a, a], [[1], [1]], 'at $[1]: expected the node reached before, got another')
        differ([[1], [1]], [b, b], 'at $[1]: expected a node of its own, got one reached before')
        differ({ x: a, y: a }, { x: [1], y: [1] }, 'at $["y"]: expected the node reached before, got another')
        differ([a, { x: a }], [b, { x: [1] }], 'at $[1]["x"]: expected the node reached before, got another')
        // a shared node's contents are compared once, where it is first met
        differ([a, a], [[2], [2]], 'at $[0][0]: expected 1, got 2')
        // the same value shared in one graph and not the other, three levels
        // down, so that the pair is found by identity and not by position
        const c = {}
        const p = [c]
        same([p, p, c], (() => { const q = {}; const r = [q]; return [r, r, q] })())
        differ([p, p, c], (() => { const r = [{}]; return [r, r, {}] })(), 'at $[2]: expected the node reached before, got another')
    },
    // A graph nested as deep as a corpus vector allows is compared without
    // the call stack, and a difference at the bottom is found there.
    deep: () => {
        same(nested(5000, 1), nested(5000, 1))
        differ(nested(5000, 1), nested(5000, 2), `at $${'[0]'.repeat(5000)}: expected 1, got 2`)
        differ(nested(5000, 1), nested(4999, [1, 1]), `at $${'[0]'.repeat(4999)}: expected 1 elements, got 2`)
    },
    // A difference is the first in document order: an earlier member's
    // before a later one's, and a container's shape before its members.
    order: () => {
        differ([1, [2], 3], [0, [9], 9], 'at $[0]: expected 1, got 0')
        differ([1, [2], 3], [1, [9], 9], 'at $[1][0]: expected 2, got 9')
        differ({ a: 1, b: [2] }, { a: 1, b: [2, 3] }, 'at $["b"]: expected 1 elements, got 2')
    },
    // The reader accept set: the reader accepts every document to the graph
    // the vector expects. The set's shape — ids one of a kind, every vector
    // named and classed — is proved beside the set, in
    // `spec/datajs/vectors/accept/proof.f.mjs`.
    accept: () => { for (const vector of acceptSet) { accepted(vector) } },
}
