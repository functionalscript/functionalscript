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
    memCreate: (state, value) => {
        const id = `k${state.next}`
        const key: Key<unknown> = asNominal(id)
        return [{
            next: state.next + 1,
            values: { ...state.values, [id]: value },
        }, key]
    },
    memRead: (state, key) =>
        [state, state.values[asBase(key)]],
    memWrite: (state, key, value) => {
        const id = asBase(key)
        if (!(id in state.values)) { throw id }
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

const typedKey = create('hello').step(key => pure(key))

export const proof = {
    roundTrip: () => {
        const [state, result] = run(mock)(initial)(program)
        if (result !== 42) { throw result }
        if (state.values.k0 !== 42) { throw state }
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
        if (a !== 'k0') { throw a }
        if (b !== 'k1') { throw b }
        if (state.values.k0 !== 'a') { throw state }
        if (state.values.k1 !== 'b') { throw state }
    },
    typeTest: () => {
        // const e = create(1).step(k => write(k, 'bad').step(() => read(k)))
        const e = create(1).step(k => write(k, 5).step(() => read(k)))
    },
}
