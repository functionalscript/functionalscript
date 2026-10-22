import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input1: () => assertEq(String(entry(1)), '3,4,true'),
        input2: () => assertEq(String(entry(2)), '3,4,true'),
    },
    demo: () => assert(demo.init.calls === null),
}
