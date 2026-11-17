import { assertEq } from '../../../asserts/module.f.js'
import { lessons } from './module.f.js'
import { nameOf } from '../../../types/object/name/module.f.js'

export const proof = {
    // Every page's lessons, each once, in the module page's order.
    order: () => assertEq(lessons.map(e => nameOf(e)).join(', '), 'Built or handed back, Where it failed'),
}
