/** @import { Sample } from '../page/types.ts' */

import { assert, assertStructurallySame } from '../../../asserts/module.f.js'
import { ok } from '../../../types/result/module.f.js'
import { jsOutput } from '../page/module.f.mjs'
import program from './sample.f.js'
import { demo } from './demo.f.mjs'

export const proof = {
    // The bytes written out by hand are the greeting.
    sample: () => assertStructurallySame(jsOutput(/** @type {Sample['program']} */ (/** @type {unknown} */ (program))), ok('hello, world\n')),
    demo: () => assert(demo.init.runs === null),
}
