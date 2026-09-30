/**
 * Host proofs for `withText`: the value is the callable's in everything but
 * its text, every host conversion answers the text, and a refused text
 * refuses only the conversions that read it.
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { withText } from './module.mjs'

/** @type {(...a: readonly unknown[]) => unknown} */
const add = (a, b) => /** @type {number} */ (a) + /** @type {number} */ (b)

const f = withText(add, () => '(a)=>a')

/** A function whose text is refused. */
const refused = withText(add, () => undefined)

/** @type {any} */
const anyF = f

/** @type {any} */
const anyRefused = refused

export const proof = {
    callable: () => {
        assertEq(typeof f, 'function')
        assertEq(f(1, 2), 3)
        assertEq(f.length, 2)
        assertEq(f.name, 'add')
    },
    identity: () => {
        assert(f !== add)
        assert(withText(add, () => '(a)=>a') !== f)
    },
    conversions: () => {
        assertEq(String(f), '(a)=>a')
        assertEq(f + '!', '(a)=>a!')
        assertEq(`${f}`, '(a)=>a')
        assertEq([f, 1].join(), '(a)=>a,1')
        assertEq('x(a)=>a'.indexOf(anyF), 1)
        assertEq(f.toString(), '(a)=>a')
        // A relational comparison with a string compares the text.
        assertEq(anyF < 'z', true)
        assert(Number.isNaN(+anyF))
        assertEq(anyF < 5, false)
    },
    /** A refused text refuses conversions, not calls. */
    refusedCall: () => {
        assertEq(refused(2, 3), 5)
        assertEq(refused.length, 2)
    },
    lazy: () => {
        // `text` runs at each conversion and never before one.
        const g = withText(add, () => { throw 'not yet' })
        assertEq(g(2, 3), 5)
    },
    throw: {
        string: () => String(refused),
        concatenation: () => anyRefused + '',
        toString: () => refused.toString(),
        join: () => [refused].join(),
        /** The host sees `+f` and `f < "z"` alike, so both are refused. */
        number: () => +anyRefused,
        stringComparison: () => anyRefused < 'z',
    },
}
