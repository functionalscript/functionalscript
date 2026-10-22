import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        input5: () => assertEq(String(entry(5)), '8'),
        input100: () => assertEq(String(entry(100)), '128'),
    },
    demo: () => assert(demo.init.calls === null),
}
