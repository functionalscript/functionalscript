import { assertEq } from '../../asserts/module.f.mjs'
import { entry } from './module.f.js'
import { entry as objectEntry } from '../../types/object/entry/module.f.js'

export const proof = {
    entry: () => {
        assertEq(entry, objectEntry)
        assertEq(entry({ a: 7 }, 'a'), 7)
    },
}
