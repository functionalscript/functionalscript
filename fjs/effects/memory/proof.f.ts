import { assert, assertEq } from '../../asserts/module.f.ts'
import { run, type MemOperationMap } from '../mock/module.f.ts'
import { pure } from '../module.f.ts'
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

const program = create(1).step(key =>
    read(key).step(value =>
        write(key, value + 41).step(() =>
            read(key)
        )
    )
)

export const proof = {
    roundTrip: () => {
        const [state, result] = run(mock)(initial)(program)
        assertEq(result, 42)
        assertEq(state.values.k0, 42, state)
    },
    allocatesFreshKeys: () => {
        const effect = create('a').step(a =>
            create('b').step(b =>
                pure([
                    asBase(a),
                    asBase(b),
                ] as const)
            )
        )
        const [state, [a, b]] = run(mock)(initial)(effect)
        assertEq(a, 'k0')
        assertEq(b, 'k1')
        assertEq(state.values.k0, 'a', state)
        assertEq(state.values.k1, 'b', state)
    },
    typeTest: () => {
        // const e = create(1).step(k => write(k, 'bad').step(() => read(k)))
        create(1).step(k => write(k, 5).step(() => read(k)))
    },
    throw: () => {
        const key: Key<number> = asNominal('missing')
        run(mock)(initial)(write(key, 1))
    },
}
