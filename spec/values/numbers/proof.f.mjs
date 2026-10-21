import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input0: () => assertEq(String(entry(0)), '0'),
        input1: () => assertEq(String(entry(1)), '-85'),
        input2: () => assertEq(String(entry(2)), '600'),
        input3: () => assertEq(String(entry(3)), '2e-7'),
    },
    demo: () => assert(demo.init.calls === null),
}
