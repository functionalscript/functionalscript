import { at } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    ctor: () => {
        const a = {}
        const value = at('constructor')(a)
        assertEq(value, null)
    },
    property: () => {
        const a = { constructor: 42 }
        const value = at('constructor')(a)
        assertEq(value, 42)
    }
}
