import { step, decode, do_, foldStep, forEachStep, lazy, match, okStep, frameStep, pure, type Effect, type Operation } from './module.f.ts'
import { error, ok } from '../types/result/module.f.ts'
import { assert, assertEq } from '../asserts/module.f.ts'

const assertPure = <O extends Operation, T>(e: Effect<O, T>, expected: T) => {
    const d = decode(e)
    assert(d.done, e)
    assertEq(d.result, expected)
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
            assert(!(evaluated), 'lazy must not evaluate eagerly')
            assertPure(e, 7)
            assert(evaluated, 'decode must force the thunk')
        },
        step: () => {
            const e = step(lazy(() => 5), v => pure(v * 2))
            assertPure(e, 10)
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
    okStep: {
        ok: () => {
            const e = step(pure(ok(5)), okStep((v: number) => pure(ok(v * 2))))
            const d = decode(e)
            assert(!(!d.done || d.result[0] !== 'ok' || d.result[1] !== 10), e)
        },
        error: () => {
            const e = step(pure(error<string>('oops')), okStep<number, string, never, number>(v => pure(ok(v * 2))))
            const d = decode(e)
            assert(!(!d.done || d.result[0] !== 'error' || d.result[1] !== 'oops'), e)
        },
    },
    decode: () => {
        const d = decode(do_<AddOp>('add')(2, 3))
        assert(!(d.done), d)
        assertEq(d.command, 'add')
        assert(!(d.payload[0] !== 2 || d.payload[1] !== 3), d.payload)
        assertPure(d.continuation(5), 5)
    },
    match: {
        done: () => {
            const r = next(pure(7))
            assert(r[0] === 'done', r)
            assertEq(r[1], 7)
        },
        cont: () => {
            const r = next(do_<AddOp>('add')(2, 3))
            assert(r[0] === 'cont', r)
            assertEq(r[1], 5)
            const r2 = next(r[2](r[1]))
            assert(r2[0] === 'done', r2)
            assertEq(r2[1], 5)
        },
    },
    step: {
        pure: () => {
            assertPure(step(pure(3), v => pure(v + 1)), 4)
        },
        chain: () => {
            // Chains as step(step(e, f), g), raw effect in and out.
            assertPure(step(step(pure(3), v => pure(v + 1)), v => pure(v * 2)), 8)
        },
        over_do: () => {
            // Stepping a Do node preserves the command and threads the result
            // through the rebuilt continuation.
            const e = step(do_<AddOp>('add')(2, 3), r => pure(r * 10))
            const r = next(e)
            assert(r[0] === 'cont', r)
            assertEq(r[1], 5)
            assertPure(r[2](r[1]), 50)
        },
    },
    frameStep: {
        pure: () => {
            const d = decode(frameStep(pure(3), v => pure(v * 2)))
            assert(d.done, d)
            const { result, param } = d.result
            assertEq(param, 3)
            assertEq(result, 6)
        },
        over_do: () => {
            // The captured param survives a command boundary: the frame is
            // rebuilt inside the continuation rather than lost when `e` is a Do.
            const c = next(frameStep(do_<AddOp>('add')(2, 3), r => pure(r * 10)))
            assert(c[0] === 'cont', c)
            assertEq(c[1], 5)
            const d = decode(c[2](c[1]))
            assert(d.done, d)
            const { result, param } = d.result
            assertEq(param, 5)
            assertEq(result, 50)
        },
        chain: () => {
            // Frames chain through `param`, so a value bound two links back
            // reads as `param.param.result`.
            const a = frameStep(pure(1), x => pure(x + 1))
            const b = frameStep(a, ({ result, param }) => pure(result + param))
            assertPure(
                step(b, ({ result: z, param: { result: y, param: x } }) => pure(`${x}${y}${z}`)),
                '123')
        },
        f_receives_whole_frame: () => {
            // `f` is handed the preceding frame, not just its result - which is
            // why frames chain through `param` at all.
            const a = frameStep(pure(1), x => pure(x + 1))
            const b = frameStep(a, p => pure(p.param * 100 + p.result))
            assertPure(step(b, ({ result }) => pure(result)), 102)
        },
    },
}
