/** @import { Sample } from '../page/types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { ok } from '../../../types/result/module.f.js'
import { jsOutput } from '../page/module.f.js'
import program from './sample.f.js'
import { run as irRun } from './ir.f.js'
import { demo } from './demo.f.js'

export const proof = {
    // The longest chain below 30,000, and the bytes the sample encodes are the line.
    sample: () => assertStructurallySame(
        jsOutput(/** @type {Sample['program']} */ (/** @type {unknown} */ (program))),
        ok('the longest Collatz chain below 30000 starts at 26623 and takes 307 steps\n')),
    // The IR entry answers the same report text the sample writes.
    ir: () => assertEq(irRun(), 'the longest Collatz chain below 30000 starts at 26623 and takes 307 steps\n'),
    demo: () => assert(demo.init.runs === null),
}
