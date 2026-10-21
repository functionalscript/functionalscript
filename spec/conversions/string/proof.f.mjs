import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input42: () => assertEq(String(entry(42)), '42,42,1,2,true'),
        inputminus0point5: () => assertEq(String(entry(-0.5)), '-0.5,42,1,2,false'),
    },
    demo: () => assert(demo.init.calls === null),
}
