/**
 * Proofs of String's IR module where the IR heap holds long strings
 * ([heap.f.js](./heap.f.js)): what it imports, defines and exports, that
 * both stages type every function, which of them may fail, and that its
 * hooks are Any's that know the IR heap. [heap.proof.mjs](./heap.proof.mjs)
 * runs it on the host's engine against [the model](./model/module.f.js).
 */

import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { check, checkPlain } from '../../check/module.f.js'
import { lifetime } from '../../lifetime/module.f.js'
import { definedBy } from '../../module.f.js'
import { withHeap as anyWithHeap } from '../any/module.f.js'
import { withHeap } from './heap.f.js'

export const proof = {
    // It imports NaNVM's references, the Heap, the memory, L0's String and its maker, defines Any, and exports
    // String's four functions.
    surface: () => {
        assertEq(withHeap.imports.map(([k]) => k).join(), 'Ref,Heap,Memory,String,Units')
        assertEq(definedBy(withHeap), 'Any')
        assertEq(withHeap.exports.join(), 'length,unit,concat,substring')
        // Any's definition and hooks are those of Any that knows the IR heap, so a long string counts through the Heap.
        assertStructurallySame(withHeap.defines, anyWithHeap.defines)
        const hooks = ['isRef', 'dup', 'drop', 'kind']
        assertStructurallySame(withHeap.functions.filter(([k]) => hooks.includes(k)), anyWithHeap.functions.filter(([k]) => hooks.includes(k)))
    },
    // Both stages type every function. `length` and `concat` do not fail, since a forged box and a sum past what a
    // block holds are misuses; `unit` and `substring` fail outside the string, as L0's do.
    effects: () => {
        const plain = assertOk(checkPlain(withHeap)).functions.map(([k]) => k)
        const owned = assertOk(check(assertOk(lifetime(withHeap))))
        assertEq(owned.functions.map(([k]) => k).join(), plain.join())
        const fails = owned.functions.filter(([k]) => withHeap.exports.includes(k)).map(([k, { fails }]) => `${k}: ${fails}`)
        assertEq(fails.join(', '), 'length: false, unit: true, concat: false, substring: true')
    },
}
