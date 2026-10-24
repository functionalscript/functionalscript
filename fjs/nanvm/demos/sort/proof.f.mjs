/** @import { Sample } from '../page/types.ts' */

import { assert, assertStructurallySame } from '../../../asserts/module.f.js'
import { ok } from '../../../types/result/module.f.js'
import { jsOutput } from '../page/module.f.mjs'
import program from './sample.f.js'
import { demo } from './demo.f.mjs'

export const proof = {
    // The integers come out in order, and the bytes the sample encodes are the line.
    sample: () => assertStructurallySame(
        jsOutput(/** @type {Sample['program']} */ (/** @type {unknown} */ (program))),
        ok('sorted 100000 integers: smallest 1, largest 2147477497\n')),
    demo: () => assert(demo.init.runs === null),
}
