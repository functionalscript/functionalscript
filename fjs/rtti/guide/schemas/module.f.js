/**
 * The lessons of the schemas pages, in the order the module page's demo lists
 * them. A page owns its lessons: each sits in the page's `sample.f.js`, and
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

import { lessons as closedContainers } from './closed-containers/sample.f.js'
import { lessons as option } from './option/sample.f.js'
import { lessons as openContainers } from './open-containers/sample.f.js'
import { lessons as unions } from './unions/sample.f.js'
import { lessons as arraysAndRecords } from './arrays-and-records/sample.f.js'
import { recursion, sharedParts } from './recursion/sample.f.js'
import { signedZero, taggedUnion } from './constants/sample.f.js'
import { lessons as primitives } from './primitives/sample.f.js'

/** @type {readonly DemoExample[]} */
export const lessons = [
    ...closedContainers,
    ...option,
    ...openContainers,
    ...unions,
    signedZero,
    sharedParts,
    ...arraysAndRecords,
    recursion,
    taggedUnion,
    ...primitives,
]
