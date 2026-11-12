import { assert, assertStructurallySame } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import sample from './sample.f.js'

export const proof = {
    demo: () => assert(demo.init.calls === null),
    arrayRest: () => {
        assertStructurallySame(sample(1), [1, 2, [3], [3, 4]])
        assertStructurallySame(sample(5), [5, 10, [15], [3, 4]])
    },
}
