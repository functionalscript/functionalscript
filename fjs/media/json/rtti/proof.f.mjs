/**
 * Proof for the JSON rtti schemas.
 *
 * @module
 *
 * @import { ValidateE } from '../../../rtti/common/types.ts'
 * @import { Unknown } from '../../../types/rtti/ts/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { parse } from '../../../types/rtti/parse/module.f.mjs'
import { primitive, unknown, object, array } from './module.f.mjs'

// Reduces a parse to its `ok`/`error` tag: these schemas are about what is
// accepted, not about the payload `parse` rebuilds. The erased `ValidateE`
// keeps the shared helper from re-instantiating each schema's deep recursive
// result type (TS2589).
/** @type {(v: ValidateE) => (value: Unknown) => string} */
const tag = v => value => v(value)[0]

const primitiveAccepts = tag(parse(primitive))
const unknownAccepts = tag(parse(unknown))
const objectAccepts = tag(parse(object))
const arrayAccepts = tag(parse(array))

export const proof = {
    primitive: {
        accepts: () => {
            assertEq(primitiveAccepts(null), 'ok')
            assertEq(primitiveAccepts(true), 'ok')
            assertEq(primitiveAccepts(0), 'ok')
            assertEq(primitiveAccepts(''), 'ok')
        },
        rejectsComposite: () => {
            assertEq(primitiveAccepts([]), 'error')
            assertEq(primitiveAccepts({}), 'error')
        },
    },
    object: {
        accepts: () => {
            assertEq(objectAccepts({}), 'ok')
            assertEq(objectAccepts({ a: 1, b: 'two', c: null }), 'ok')
        },
        // A record schema descends into its values, so a bad leaf anywhere in
        // the tree fails the whole object.
        nested: () => {
            assertEq(objectAccepts({ a: { b: [1, { c: null }] } }), 'ok')
        },
        rejectsNonObject: () => {
            assertEq(objectAccepts(1), 'error')
            assertEq(objectAccepts([]), 'error')
        },
    },
    array: {
        accepts: () => {
            assertEq(arrayAccepts([]), 'ok')
            assertEq(arrayAccepts([null, true, 2, 'three']), 'ok')
        },
        nested: () => {
            assertEq(arrayAccepts([[{ a: [] }]]), 'ok')
        },
        rejectsNonArray: () => {
            assertEq(arrayAccepts(1), 'error')
            assertEq(arrayAccepts({}), 'error')
        },
    },
    unknown: {
        // `unknown` is the union of the three above, so it accepts every arm.
        acceptsEveryArm: () => {
            assertEq(unknownAccepts(null), 'ok')
            assertEq(unknownAccepts(false), 'ok')
            assertEq(unknownAccepts(1), 'ok')
            assertEq(unknownAccepts('s'), 'ok')
            assertEq(unknownAccepts([]), 'ok')
            assertEq(unknownAccepts({}), 'ok')
        },
        // The thunk closes the recursion: an arbitrarily deep acyclic value
        // terminates because array/record item validators instantiate lazily.
        recurses: () => {
            assertEq(unknownAccepts({ a: [{ b: [[{ c: 'd' }]] }] }), 'ok')
        },
        rejectsUndefined: () => {
            assertEq(unknownAccepts(undefined), 'error')
        },
    },
}
