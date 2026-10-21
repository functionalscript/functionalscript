import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input1: () => assertEq(String(entry(1)), '7'),
        input10: () => assertEq(String(entry(10)), '16'),
    },
    demo: () => assert(demo.init.calls === null),
}
