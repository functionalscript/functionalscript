/**
 * Host proofs for `withText`: the value is the callable's in everything but
 * its text, and every host conversion answers the text.
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { withText } from './module.mjs'

/** @type {(...a: readonly unknown[]) => unknown} */
const add = (a, b) => /** @type {number} */ (a) + /** @type {number} */ (b)

const f = withText(add, () => 'text')

export const proof = {
    callable: () => {
        assertEq(typeof f, 'function')
        assertEq(f(1, 2), 3)
        assertEq(f.length, 2)
        assertEq(f.name, 'add')
    },
    identity: () => {
        assert(f !== add)
        assert(withText(add, () => 'text') !== f)
    },
    conversions: () => {
        assertEq(String(f), 'text')
        assertEq(f + '!', 'text!')
        assertEq(`${f}`, 'text')
        assertEq([f, 1].join(), 'text,1')
        assertEq('xtext'.indexOf(/** @type {any} */ (f)), 1)
        assertEq(f.toString(), 'text')
    },
    lazy: () => {
        // `text` runs at each conversion and never before one.
        const g = withText(add, () => { throw 'not yet' })
        assertEq(g(2, 3), 5)
    },
    throw: {
        refused: () => String(withText(add, () => { throw new TypeError('refused') })),
    },
}
