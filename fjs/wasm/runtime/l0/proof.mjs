/**
 * Proves the order in which the L0 view's builders call their callbacks,
 * which shows only in what a failing callback throws. A FunctionalScript
 * proof cannot catch a throw, so this one is a host proof. The order is
 * that of one loop, which the WASM backend writes: each item before the
 * next state, and a key, then its check, then its value.
 */

import { buildArray, buildObject } from './module.f.js'
import { assertEq } from '../../../asserts/module.f.js'

/** @type {(f: () => unknown) => unknown} */
const thrown = f => {
    try {
        f()
    } catch (e) {
        return e
    }
    return 'nothing'
}

/** @type {(x: string) => () => never} */
const fail = x => () => { throw x }

export const proof = {
    buildArray: () => {
        // `at` of state 0 before `next` of it.
        assertEq(thrown(() => buildArray(2, 0, fail('next'), fail('at'))), 'at')
        // `next` of state 0 before `at` of state 1.
        assertEq(thrown(() => buildArray(2, 0, fail('next'), i => i)), 'next')
        // No `next` after the last item.
        assertEq(thrown(() => buildArray(1, 0, fail('next'), i => i)), 'nothing')
    },
    buildObject: () => {
        assertEq(thrown(() => buildObject(2, 0, fail('next'), fail('key'), fail('value'))), 'key')
        // The key is checked before `valueAt` is called.
        assertEq(thrown(() => buildObject(2, 0, fail('next'), () => 0, fail('value'))), 'l0.buildObject: not a string')
        assertEq(thrown(() => buildObject(2, 0, fail('next'), () => 'k', fail('value'))), 'value')
        assertEq(thrown(() => buildObject(2, 0, fail('next'), () => 'k', i => i)), 'next')
    },
}
