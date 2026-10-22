import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input1: () => assertEq(String(entry(1)), '1,10,0,1,2,2'),
        input4: () => assertEq(String(entry(4)), '4,10,0,4,8,2'),
    },
    demo: () => assert(demo.init.calls === null),
}
