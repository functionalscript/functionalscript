import { assert, assertStructurallySame } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import sample from './sample.f.js'

export const proof = {
    demo: () => assert(demo.init.calls === null),
    objectAndArrayRest: () => {
        assertStructurallySame(sample(1), [1, 2, { label: 'value' }, [3], [3, 4]])
        assertStructurallySame(sample(5), [5, 10, { label: 'value' }, [15], [3, 4]])
    },
}
