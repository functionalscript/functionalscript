/**
 * Proof for the JSON rtti schemas.
 *
 * @import { ValidateE } from '../../../rtti/common/types.ts'
 * @import { Unknown } from '../../../rtti/ts/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { parse } from '../../../rtti/parse/module.f.mjs'
import { validate } from '../../../rtti/validate/module.f.mjs'
import { toData, validate as dataValidate } from '../../../rtti/data/module.f.mjs'
import { primitive, unknown, object, array } from './module.f.js'

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

export const proof = /** @type {const} */ ({
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
        recursiveConsumers: () => {
            const validated = tag(validate(unknown))
            const dataValidated = tag(dataValidate(toData(unknown)))
            for (const value of /** @type {const} */ ([
                { a: [{ b: [[1, null]] }] },
                [{ a: [{ b: 's' }] }],
            ])) {
                assertEq(unknownAccepts(value), 'ok')
                assertEq(validated(value), 'ok')
                assertEq(dataValidated(value), 'ok')
            }
            for (const value of /** @type {const} */ ([
                { a: [{ b: [undefined] }] },
                [{ a: { b: 1n } }],
            ])) {
                assertEq(unknownAccepts(value), 'error')
                assertEq(validated(value), 'error')
                assertEq(dataValidated(value), 'error')
            }
        },
        rejectsUndefined: () => {
            assertEq(unknownAccepts(undefined), 'error')
        },
    },
})
