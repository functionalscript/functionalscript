import { assertEq } from '../../../asserts/module.f.mjs'
import { validDuration, formatDuration } from './module.f.mjs'

export const proof = {
    validDuration: () => {
        assertEq(validDuration(0), true)
        assertEq(validDuration(2), true)
        assertEq(validDuration(-1), false)
        assertEq(validDuration(NaN), false)
        assertEq(validDuration(Infinity), false)
    },
    format: () => {
        assertEq(formatDuration(0), '<0.01 ms')
        assertEq(formatDuration(0.009), '<0.01 ms')
        assertEq(formatDuration(4.8), '4.80 ms')
        assertEq(formatDuration(999), '999.00 ms')
        assertEq(formatDuration(2_450), '2.45 s')
    },
}
