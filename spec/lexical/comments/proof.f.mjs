import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input1: () => assertEq(String(entry(1)), '2'),
        inputminus42point5: () => assertEq(String(entry(-42.5)), '-85'),
    },
    demo: () => assert(demo.init.calls === null),
}
