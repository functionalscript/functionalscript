import { assert } from '../../fjs/asserts/module.f.js'
import { examplePicker } from '../../fjs/website/demo/examples/module.f.js'
import area from './module.f.js'
import { demo } from './demo.f.mjs'

export const proof = {
    /** The pages' lists together are a valid drop-down: names and sources are distinct. */
    distinct: () => {
        const all = area.all
        assert(all.length > 0, 'the area has examples')
        examplePicker(all)
    },
    demo: () => assert(demo.init.calls === null),
}
