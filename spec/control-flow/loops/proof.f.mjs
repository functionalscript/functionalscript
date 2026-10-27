import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    calls: {
        initiallyFalse: () => assertEq(String(entry(1)), '1,0'),
        input5: () => assertEq(String(entry(5)), '8,3'),
        input100: () => assertEq(String(entry(100)), '128,7'),
    },
    demo: () => assert(demo.init.calls === null),
}
