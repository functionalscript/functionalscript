/**
 * Proofs for the corpus constructors: each thunk answers its own tag.
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { callback, functionValue, ref, throws, unreached } from './module.f.mjs'

export const proof = {
    tags: () => {
        assertEq(functionValue()[0], 'function')
        assertEq(throws()[0], 'throw')
        assertEq(unreached()[0], 'unreached')
    },
    named: () => {
        assertEq(callback('first')().join(), 'callback,first')
        assertEq(ref('object')().join(), 'ref,object')
    },
}
