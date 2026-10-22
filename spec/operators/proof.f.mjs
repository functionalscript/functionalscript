import { assert, assertEq } from '../../fjs/asserts/module.f.js'
import { examplePicker } from '../../fjs/website/demo/examples/module.f.js'
import area from './module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    /** The pages' lists together are a valid drop-down: names and sources are distinct. */
    distinct: () => {
        const all = area.all
        assert(all.length > 0, 'the area has examples')
        examplePicker(all)
    },
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input1: () => assertEq(String(entry(1)), '7,0,2,-2,false,number,small'),
        input2: () => assertEq(String(entry(2)), '8,1,4,-3,false,number,big'),
    },
    demo: () => assert(demo.init.calls === null),
}
