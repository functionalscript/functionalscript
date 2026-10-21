/** @import { Sample } from '../page/types.ts' */

import { assert, assertStructurallySame } from '../../../asserts/module.f.js'
import { ok } from '../../../types/result/module.f.js'
import { jsOutput } from '../page/module.f.mjs'
import program from './sample.f.js'
import { demo } from './demo.f.mjs'

export const proof = {
    // The longest chain below 30,000, and the bytes the sample encodes are the line.
    sample: () => assertStructurallySame(
        jsOutput(/** @type {Sample['program']} */ (/** @type {unknown} */ (program))),
        ok('the longest Collatz chain below 30000 starts at 26623 and takes 307 steps\n')),
    demo: () => assert(demo.init.runs === null),
}
