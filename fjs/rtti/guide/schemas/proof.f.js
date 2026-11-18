import { assertEq } from '../../../asserts/module.f.js'
import { lessons } from './module.f.js'
import { nameOf } from '../../../types/object/name/module.f.js'
import { dedup } from '../../../types/array/module.f.js'

export const proof = {
    // Every page's lessons, each once, in the module page's order: the pairs
    // first, opening on "Closed vs open".
    order: () => assertEq(lessons.map(e => nameOf(e)).join(', '),
        'Closed vs open, Absent vs undefined, Tuple vs rest, Two spellings, one set, Zero and minus zero, Shared parts, Dictionary, Recursion, Tagged union, Primitives'),
    // A lesson's name keys it in the demo's drop-downs, so no two share one.
    unique: () => assertEq(dedup(lessons.map(e => nameOf(e))).length, lessons.length),
}
