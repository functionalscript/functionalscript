import { assertEq } from '../../../asserts/module.f.js'
import { lessons } from './module.f.mjs'

export const proof = {
    // Every page's lessons, each once, in the module page's order.
    order: () => assertEq(lessons.map(e => e.name).join(', '), 'Optional or undefined, Lossy integers, Subset'),
}
