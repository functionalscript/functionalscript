import { fromUndefined, map, match, toOption } from './module.f.ts'

export const proof = [
    () => {
        const optionSq = map((v: number) => v * v)
        const sq3 = optionSq(3)
        if (sq3 !== 9) { throw sq3 }
        const sqNull = optionSq(null)
        if (sqNull !== null) { throw sqNull }
    },
    () => {
        const opt1 = toOption(5)
        if (opt1.length !== 1 || opt1[0] !== 5) { throw opt1 }
        const opt2 = toOption(null)
        if (opt2.length !== 0) { throw opt2 }
    },
    () => {
        const double = match((v: number) => v * 2)(() => -1)
        if (double(3) !== 6) { throw double(3) }
        if (double(null) !== -1) { throw double(null) }
    },
    () => {
        if (fromUndefined(undefined) !== null) { throw 0 }
        if (fromUndefined(5) !== 5) { throw 1 }
        if (fromUndefined(0) !== 0) { throw 2 }
        if (fromUndefined(null) !== null) { throw 3 }
        if (fromUndefined('') !== '') { throw 4 }
    },
]
