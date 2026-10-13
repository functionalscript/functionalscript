import { assertEq } from '../../../asserts/module.f.mjs'
import { _validDuration, _formatDuration } from './module.f.mjs'

export const proof = {
    _validDuration: () => {
        assertEq(_validDuration(0), true)
        assertEq(_validDuration(2), true)
        assertEq(_validDuration(-1), false)
        assertEq(_validDuration(NaN), false)
        assertEq(_validDuration(Infinity), false)
    },
    _formatDuration: () => {
        assertEq(_formatDuration(0), 'too small to report reliably')
        assertEq(_formatDuration(0.009), 'too small to report reliably')
        assertEq(_formatDuration(0.01), '0.01 ms')
        assertEq(_formatDuration(4.8), '4.80 ms')
        assertEq(_formatDuration(999), '999.00 ms')
        assertEq(_formatDuration(2_450), '2.45 s')
    },
}
