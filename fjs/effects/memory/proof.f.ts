import { assert, assertEq } from '../../asserts/module.f.ts'
import { run, type MemOperationMap } from '../mock/module.f.ts'
import { pure } from '../module.f.ts'
import { eff } from '../eff/module.f.ts'
import {
    asBase, asNominal,
    create, read, write,
    type Key, type MemOp,
} from './module.f.ts'

type MemoryState = {
    readonly next: number
    readonly values: { readonly [key: string]: unknown }
}

const initial: MemoryState = { next: 0, values: {} }

const mock: MemOperationMap<MemOp, MemoryState> = {
    memCreate: value => state => {
        const id = `k${state.next}`
        const key: Key<unknown> = asNominal(id)
        return [{
            next: state.next + 1,
            values: { ...state.values, [id]: value },
        }, key]
    },
    memRead: key => state =>
        [state, state.values[asBase(key)]],
    memWrite: (key, value) => state => {
        const id = asBase(key)
        assert(id in state.values, id)
        return [{
            ...state,
            values: { ...state.values, [id]: value },
        }, undefined]
    },
}

const program = eff(create(1)).step(key =>
    eff(read(key)).step(value =>
        eff(write(key, value + 41)).step(() =>
            read(key)).value).value).value

export const proof = {
    roundTrip: () => {
        const [state, result] = run(mock)(initial)(program)
        assertEq(result, 42)
        assertEq(state.values.k0, 42, state)
    },
    allocatesFreshKeys: () => {
        const effect = eff(create('a')).step(a =>
            eff(create('b')).step(b =>
                pure([
                    asBase(a),
                    asBase(b),
                ] as const)).value).value
        const [state, [a, b]] = run(mock)(initial)(effect)
        assertEq(a, 'k0')
        assertEq(b, 'k1')
        assertEq(state.values.k0, 'a', state)
        assertEq(state.values.k1, 'b', state)
    },
    typeTest: () => {
        // const e = eff(create(1)).step(k => eff(write(k, 'bad')).step(() => read(k)).value).value
        eff(create(1)).step(k => eff(write(k, 5)).step(() => read(k)).value).value
    },
    throw: () => {
        const key: Key<number> = asNominal('missing')
        run(mock)(initial)(write(key, 1))
    },
}
