import { assertEq } from '../../../asserts/module.f.mjs'
import { validDuration, median, ratio, formatDuration } from './module.f.mjs'

export const proof = {
    median: () => {
        assertEq(median([]), null)
        assertEq(median([4, 1, 9, 2, 3]), 3)
        assertEq(median([4, 1, 3, 2]), 2.5)
        assertEq(median([0]), 0)
        assertEq(median([-1, 2]), null)
        assertEq(median([Infinity]), null)
        assertEq(median([NaN]), null)
    },
    ratio: () => {
        assertEq(ratio(100, 2), 50)
        assertEq(ratio(2, 100), 0.02)
        assertEq(ratio(1, 1), 1)
        assertEq(ratio(0, 2), null)
        assertEq(ratio(10, 0), null)
        assertEq(ratio(10, 0.999), null)
        assertEq(ratio(NaN, 2), null)
        assertEq(ratio(2, Infinity), null)
        assertEq(validDuration(-1), false)
        assertEq(validDuration(0), true)
    },
    format: () => {
        assertEq(formatDuration(0), '<0.01 ms')
        assertEq(formatDuration(0.009), '<0.01 ms')
        assertEq(formatDuration(4.8), '4.80 ms')
        assertEq(formatDuration(999), '999.00 ms')
        assertEq(formatDuration(2_450), '2.45 s')
    },
}
