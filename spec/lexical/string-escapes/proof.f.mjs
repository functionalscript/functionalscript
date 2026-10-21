import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input0: () => assertEq(String(entry(0)), '8'),
        input1: () => assertEq(String(entry(1)), '4'),
        input2: () => assertEq(String(entry(2)), '1'),
    },
    demo: () => assert(demo.init.calls === null),
}
