import { fromUndefined, map, match, toOption } from './module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

export const proof = [
    () => {
        const optionSq = map((v: number) => v * v)
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
        const double = match((v: number) => v * 2)(() => -1)
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
