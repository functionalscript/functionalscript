import { foldStep, forEachStep, pure } from './module.f.ts'

export const proof = {
    foldStep: {
        empty: () => {
            const e = foldStep
                ((x: number) => (s: number) => pure(s + x))
                (10)
                ([])
            const { value } = e
            if (value.length !== 1) { throw value }
            if (value[0] !== 10) { throw value[0] }
        },
        threadsState: () => {
            const e = foldStep
                ((x: number) => (s: number) => pure(s + x))
                (0)
                ([1, 2, 3, 4])
            const { value } = e
            if (value.length !== 1) { throw value }
            if (value[0] !== 10) { throw value[0] }
        },
        order: () => {
            const e = foldStep
                ((x: string) => (s: string) => pure(s + x))
                ('')
                (['a', 'b', 'c'])
            const { value } = e
            if (value.length !== 1) { throw value }
            if (value[0] !== 'abc') { throw value[0] }
        },
    },
    forEachStep: {
        empty: () => {
            const e = forEachStep<never, number>(() => pure(undefined))([])
            const { value } = e
            if (value.length !== 1) { throw value }
            if (value[0] !== undefined) { throw value[0] }
        },
        runs: () => {
            const e = forEachStep<never, number>(() => pure(undefined))([1, 2, 3])
            const { value } = e
            if (value.length !== 1) { throw value }
            if (value[0] !== undefined) { throw value[0] }
        },
    },
}
