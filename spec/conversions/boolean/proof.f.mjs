import { assertEq, assertStructurallySame } from '../../../fjs/asserts/module.f.js'
import entry from './sample.f.js'
import { demo } from './demo.f.mjs'

export const proof = /** @type {const} */ ({
    input: () => {
        assertStructurallySame(entry(0), [false, false, true, true, true])
        assertStructurallySame(entry(1), [true, false, true, true, true])
    },
    demo: () => assertEq(demo.init.calls, null),
})
