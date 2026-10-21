import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input7: () => assertEq(String(entry(7)), '7,16,1,7'),
        input0point5: () => assertEq(String(entry(0.5)), '0.5,16,1,0.5'),
    },
    demo: () => assert(demo.init.calls === null),
}
