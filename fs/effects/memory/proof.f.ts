import type { Assert } from '../../asserts/module.f.ts'
import { asBase, asNominal } from '../../types/nominal/module.f.ts'
import type { Equal } from '../../types/ts/module.f.ts'
import { run, type MemOperationMap } from '../mock/module.f.ts'
import { pure, type Effect } from '../module.f.ts'
import {
    create, read, write,
    type Key, type MemCreate, type MemOp, type MemRead, type MemWrite,
} from './module.f.ts'

type MemoryState = {
    readonly next: number
    readonly values: { readonly [key: string]: unknown }
}

const initial: MemoryState = { next: 0, values: {} }

const mock: MemOperationMap<MemOp, MemoryState> = {
    memCreate: (state, value) => {
        const id = `k${state.next}`
        const key: Key<unknown> = asNominal<'MemKey', 'key', string>(id)
        return [{
            next: state.next + 1,
            values: { ...state.values, [id]: value },
        }, key]
    },
    memRead: (state, key) =>
        [state, state.values[asBase<'MemKey', 'key', string>(key)]],
    memWrite: (state, key, value) => {
        const id = asBase<'MemKey', 'key', string>(key)
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

type _Program = Assert<Equal<
    typeof program,
    Effect<MemCreate<number> | MemRead<number> | MemWrite<number>, number>
>>

const typedKey = create('hello').step(key => pure(key))

type _TypedKey = Assert<Equal<typeof typedKey, Effect<MemCreate<string>, Key<string>>>>

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
                    asBase<'MemKey', 'key', string>(a),
                    asBase<'MemKey', 'key', string>(b),
                ] as const)
            )
        )
        const [state, [a, b]] = run(mock)(initial)(effect)
        if (a !== 'k0') { throw a }
        if (b !== 'k1') { throw b }
        if (state.values.k0 !== 'a') { throw state }
        if (state.values.k1 !== 'b') { throw state }
    },
}
