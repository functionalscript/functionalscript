import { decode, do_, foldStep, forEachStep, lazy, match, pure, type Effect, type Operation } from './module.f.ts'

const assertPure = <O extends Operation, T>(e: Effect<O, T>, expected: T) => {
    const d = decode(e)
    if (!d.done) { throw e.value }
    if (d.result !== expected) { throw d.result }
}

type AddOp = readonly['add', (a: number, b: number) => number]

const next = match<AddOp, number>({ add: (a, b) => a + b })

export const proof = {
    lazy: {
        value: () => {
            assertPure(lazy(() => 42), 42)
        },
        deferred: () => {
            // The thunk runs only when the effect is decoded, not when `lazy` is called.
            let evaluated = false
            const e = lazy(() => { evaluated = true; return 7 })
            if (evaluated) { throw 'lazy must not evaluate eagerly' }
            assertPure(e, 7)
            if (!evaluated) { throw 'decode must force the thunk' }
        },
    },
    foldStep: {
        empty: () => {
            const e = foldStep
                ((x: number) => (s: number) => pure(s + x))
                (10)
                ([])
            assertPure(e, 10)
        },
        threadsState: () => {
            const e = foldStep
                ((x: number) => (s: number) => pure(s + x))
                (0)
                ([1, 2, 3, 4])
            assertPure(e, 10)
        },
        order: () => {
            const e = foldStep
                ((x: string) => (s: string) => pure(s + x))
                ('')
                (['a', 'b', 'c'])
            assertPure(e, 'abc')
        },
    },
    forEachStep: {
        empty: () => {
            const e = forEachStep<never, number>(() => pure(undefined))([])
            assertPure(e, undefined)
        },
        runs: () => {
            const e = forEachStep<never, number>(() => pure(undefined))([1, 2, 3])
            assertPure(e, undefined)
        },
    },
    decode: () => {
        const d = decode(do_<AddOp>('add')(2, 3))
        if (d.done) { throw d }
        if (d.command !== 'add') { throw d.command }
        if (d.payload[0] !== 2 || d.payload[1] !== 3) { throw d.payload }
        assertPure(d.continuation(5), 5)
    },
    match: {
        done: () => {
            const r = next(pure(7))
            if (r[0] !== 'done') { throw r }
            if (r[1] !== 7) { throw r[1] }
        },
        cont: () => {
            const r = next(do_<AddOp>('add')(2, 3))
            if (r[0] !== 'cont') { throw r }
            if (r[1] !== 5) { throw r[1] }
            const r2 = next(r[2](r[1]))
            if (r2[0] !== 'done') { throw r2 }
            if (r2[1] !== 5) { throw r2[1] }
        },
    },
}
