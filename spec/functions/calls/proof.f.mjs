import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input1: () => assertEq(String(entry(1)), '11,3,1,4,5'),
        input3: () => assertEq(String(entry(3)), '13,3,3,4,5'),
    },
    demo: () => assert(demo.init.calls === null),
}
