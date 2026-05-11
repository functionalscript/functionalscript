import { map, toOption } from './module.f.ts'

export default [
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
    }
]
