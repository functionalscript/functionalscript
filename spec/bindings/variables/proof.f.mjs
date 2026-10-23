import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input3: () => assertEq(String(entry(3)), '3,1,6'),
        inputMinus2: () => assertEq(String(entry(-2)), '2,1'),
    },
    demo: () => assert(demo.init.calls === null),
}
