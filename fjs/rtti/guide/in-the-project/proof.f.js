import { assertEq } from '../../../asserts/module.f.js'
import { lessons } from './module.f.js'
import { dedup } from '../../../types/array/module.f.js'
import { nameOf } from '../../../types/object/name/module.f.js'

export const proof = {
    // A name keys a schema in the demo's drop-downs, so no two share one.
    unique: () => assertEq(dedup(lessons.map(e => nameOf(e))).length, lessons.length),
}
