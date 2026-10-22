import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input2: () => assertEq(String(entry(2)), '3'),
        throw: {
            input5: () => entry(5),
        },
    },
    demo: () => assert(demo.init.calls === null),
}
