import { assertEq } from '../../../asserts/module.f.mjs'
import { matches } from './module.f.js'

export const proof = {
    search: () => {
        assertEq(matches('compile c Compile modules', '  COMPILE  '), true)
        assertEq(matches('cas s Content-addressable storage', 'storage'), true)
        assertEq(matches('help h ?', '?'), true)
        assertEq(matches('compile c Compile modules', 'web'), false)
        assertEq(matches('test t', '  '), true)
    },
}
