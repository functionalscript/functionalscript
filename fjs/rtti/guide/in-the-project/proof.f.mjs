import { assertEq } from '../../../asserts/module.f.js'
import { lessons } from './module.f.mjs'

export const proof = {
    // A name keys a schema in the demo's drop-downs, so no two share one.
    unique: () => assertEq(new Set(lessons.map(e => e.name)).size, lessons.length),
}
