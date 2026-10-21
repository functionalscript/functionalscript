import { assert, assertEq } from '../../../asserts/module.f.js'
import entry from './sample.f.mjs'
import { demo } from './demo.f.mjs'

export const proof = {
    // The assertion holds, and the result is `a[0] + 2`.
    holds: () => assertEq(entry(1), 3),
    throw: {
        // The assertion fails, and its failure is the call's.
        negative: () => entry(-1),
    },
    demo: () => assert(demo.init.calls === null),
}
