import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input0: () => assertEq(String(entry(0)), 'false,true,false,0,2,b,0'),
        input1point5: () => assertEq(String(entry(1.5)), 'false,false,true,0,2,b,1.5'),
    },
    demo: () => assert(demo.init.calls === null),
}
