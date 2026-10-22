import { assert } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.mjs'

export const proof = {
    demo: () => assert(demo.init.calls === null),
}
