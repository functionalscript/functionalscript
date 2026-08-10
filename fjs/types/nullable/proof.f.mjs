import { fromUndefined, map, match, toOption } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

export const proof = [
    () => {
        /** @type {(v: number) => number} */
        const sq = v => v * v
        const optionSq = map(sq)
        const sq3 = optionSq(3)
        assertEq(sq3, 9)
        const sqNull = optionSq(null)
        assertEq(sqNull, null)
    },
    () => {
        const opt1 = toOption(5)
        assert(!(opt1.length !== 1 || opt1[0] !== 5), opt1)
        const opt2 = toOption(null)
        assertEq(opt2.length, 0, opt2)
    },
    () => {
        /** @type {(v: number) => number} */
        const twice = v => v * 2
        const double = match(twice)(() => -1)
        assertEq(double(3), 6)
        assertEq(double(null), -1)
    },
    () => {
        assertEq(fromUndefined(undefined), null, 0)
        assertEq(fromUndefined(5), 5, 1)
        assertEq(fromUndefined(0), 0, 2)
        assertEq(fromUndefined(null), null, 3)
        assertEq(fromUndefined(''), '', 4)
    },
]
