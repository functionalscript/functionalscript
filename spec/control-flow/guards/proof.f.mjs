import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'
import entry from './sample.f.js'

export const proof = {
    // The demo's calls, each as `String` spells its answer.
    calls: {
        inputminus5: () => assertEq(String(entry(-5)), 'negative'),
        input0: () => assertEq(String(entry(0)), 'zero'),
        input7: () => assertEq(String(entry(7)), 'positive'),
    },
    demo: () => assert(demo.init.calls === null),
}
