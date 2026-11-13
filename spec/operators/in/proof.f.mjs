import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import sample from './sample.f.js'
import { demo } from './demo.f.mjs'

export const proof = {
    // the page's example, as the Run button calls it
    sample: () => {
        assertEq(sample(0), true)
        assertEq(sample(1), false)
    },
    demo: () => assert(demo.init.calls === null),
}
