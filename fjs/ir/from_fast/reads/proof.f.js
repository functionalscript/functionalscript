/**
 * Proofs of [the reads in place](./module.f.js): `.length` of each kind of
 * `any` that it reads, and what it leaves to `get`.
 *
 * @module
 *
 * @import { Term } from '../../types.ts'
 */

import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { any, string } from '../../l0/module.f.js'
import { call, f64, float, get, lit, match, only } from '../../module.f.js'
import { lengthRead } from './module.f.js'

/** L1's `get` of `"length"`. @type {(z: Term) => Term} */
const slow = z => call('self', 'l1.get', [z, lit(string, 'length')])

/** A length read from the module, boxed. @type {(module: string, name: string) => Term} */
const boxed = (module, name) => call('Any', 'from_f64', [float(call(module, 'length', [get(name)]))])

export const proof = {
    // Any kind: an arm for an array, one for a string, and `get` of the rest.
    any: () => assertStructurallySame(lengthRead(get('a'), any, slow, 'a'), match(get('a'), [
        [['array'], 'a.array', boxed('Containers', 'a.array')],
        [['string'], 'a.string', boxed('String', 'a.string')],
        [null, 'a.other', slow(get('a.other'))],
    ])),
    // A string alone has no arm for the rest.
    string: () => assertStructurallySame(lengthRead(get('s'), only(any, 'string'), slow, 's'), match(get('s'), [
        [['string'], 's.string', boxed('String', 's.string')],
    ])),
    // An object, or a value of no `any`, is `get`'s alone.
    none: () => {
        assertEq(lengthRead(get('o'), only(any, 'object'), slow, 'o'), null)
        assertEq(lengthRead(get('x'), f64, slow, 'x'), null)
    },
}
