import { fromUndefined, map, match, toOption } from './module.f.ts'
import { assert } from '../../asserts/module.f.ts'

export const proof = [
    () => {
        const optionSq = map((v: number) => v * v)
        const sq3 = optionSq(3)
        assert(sq3 === 9, sq3)
        const sqNull = optionSq(null)
        assert(sqNull === null, sqNull)
    },
    () => {
        const opt1 = toOption(5)
        assert(!(opt1.length !== 1 || opt1[0] !== 5), opt1)
        const opt2 = toOption(null)
        assert(opt2.length === 0, opt2)
    },
    () => {
        const double = match((v: number) => v * 2)(() => -1)
        assert(double(3) === 6, double(3))
        assert(double(null) === -1, double(null))
    },
    () => {
        assert(fromUndefined(undefined) === null, 0)
        assert(fromUndefined(5) === 5, 1)
        assert(fromUndefined(0) === 0, 2)
        assert(fromUndefined(null) === null, 3)
        assert(fromUndefined('') === '', 4)
    },
]
