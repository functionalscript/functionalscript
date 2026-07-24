import { assertEq, assert } from '../../asserts/module.f.ts'
import { decode, do_, match, type Effect, type Operation } from '../module.f.ts'
import { eff, pure } from './module.f.ts'

const assertPure = <O extends Operation, T>(e: Effect<O, T>, expected: T) => {
    const d = decode(e)
    assert(d.done, e)
    assertEq(d.result, expected)
}

type AddOp = readonly['add', (a: number, b: number) => number]

const next = match<AddOp, number>({ add: (a, b) => a + b })

export const proof = {
    pure: () => {
        assertPure(pure(5).value, 5)
    },
    value: () => {
        assertPure(eff(pure(5).value).value, 5)
    },
    chain: () => {
        assertPure(eff(pure(5).value).step(v => pure(v + 1)).step(v => pure(v * 2)).value, 12)
    },
    over_do: () => {
        const e = eff(do_<AddOp>('add')(2, 3)).step(r => pure(r + 1)).value
        const r = next(e)
        assert(r[0] === 'cont', r)
        assertEq(r[1], 5)
        assertPure(r[2](r[1]), 6)
    },
}
