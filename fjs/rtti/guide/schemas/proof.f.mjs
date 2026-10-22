import { assertEq } from '../../../asserts/module.f.js'
import { lessons } from './module.f.mjs'

export const proof = {
    // Every page's lessons, each once, in the module page's order: the pairs
    // first, opening on "Closed vs open".
    order: () => assertEq(lessons.map(e => e.name).join(', '),
        'Closed vs open, Absent vs undefined, Tuple vs rest, Two spellings, one set, Shared parts, Dictionary, Recursion, Tagged union, Primitives'),
    // A lesson's name keys it in the demo's drop-downs, so no two share one.
    unique: () => assertEq(new Set(lessons.map(e => e.name)).size, lessons.length),
}
