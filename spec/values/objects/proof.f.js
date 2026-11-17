import { assert } from '../../../fjs/asserts/module.f.js'
import { demo } from './demo.f.js'

export const proof = {
    demo: () => assert(demo.init.calls === null),
}
