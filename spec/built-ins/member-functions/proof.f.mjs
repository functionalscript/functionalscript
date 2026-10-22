import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input0: () => assertEq(String(entry(0)), '10-20-30-40'),
        input2: () => assertEq(String(entry(2)), '30-40'),
    },
    demo: () => assert(demo.init.calls === null),
}
