import { assertEq } from '../../../asserts/module.f.mjs'

import { add } from './module.f.js'

export const proof = {
    add: () => {
        assertEq(add(20)(22), 42)
    },
}
