/**
 * The lessons of the schemas pages, in the order the module page's demo lists
 * them. A page owns its lessons: each sits in the page's `sample.f.mjs`, and
 * [`../../demo.f.mjs`](../../demo.f.mjs) takes them from here instead of
 * spelling them a second time.
 *
 * The pairs come first, because the first thing a reader of the module page
 * sees should be a value that one schema accepts and the other refuses.
 *
 * @module
 *
 * @import { DemoExample } from '../../types.ts'
 */

import { lessons as closedContainers } from './closed-containers/sample.f.mjs'
import { lessons as option } from './option/sample.f.mjs'
import { lessons as openContainers } from './open-containers/sample.f.mjs'
import { lessons as unions } from './unions/sample.f.mjs'
import { lessons as arraysAndRecords } from './arrays-and-records/sample.f.mjs'
import { recursion, sharedParts } from './recursion/sample.f.mjs'
import { lessons as constants } from './constants/sample.f.mjs'
import { lessons as primitives } from './primitives/sample.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    ...closedContainers,
    ...option,
    ...openContainers,
    ...unions,
    sharedParts,
    ...arraysAndRecords,
    recursion,
    ...constants,
    ...primitives,
]
