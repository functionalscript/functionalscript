/**
 * @import { MemOperationMap } from '../mock/types.ts'
 * @import { Key, MemOp } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { run } from '../mock/module.f.mjs'
import { pureOk, step } from '../io/module.f.mjs'
import {
    asBase, asNominal,
    create, read, write,
} from './module.f.mjs'

/**
 * @typedef {{
 *   readonly next: number,
 *   readonly values: { readonly [key: string]: unknown },
 * }} _MemoryState
 */

/** @type {_MemoryState} */
const initial = { next: 0, values: {} }

/** @type {MemOperationMap<MemOp, _MemoryState>} */
const mock = {
    memCreate: value => state => {
        const id = `k${state.next}`
        /** @type {Key<unknown>} */
        const key = asNominal(id)
        return [{
            next: state.next + 1,
            values: { ...state.values, [id]: value },
        }, ok(key)]
    },
    memRead: key => state =>
        [state, ok(state.values[asBase(key)])],
    memWrite: (key, value) => state => {
        const id = asBase(key)
        assert(id in state.values, id)
        return [{
            ...state,
            values: { ...state.values, [id]: value },
        }, ok(undefined)]
    },
}

// The Io `step`: each link runs only because the previous one returned `ok`,
// and a runner that omitted a handler would propagate rather than be ignored.
const program = step(
    create(1),
    key => {
        const x = step(
            read(key),
            value => write(key, value + 41))
        return step(
            x,
            () => read(key))
    })

export const proof = {
    roundTrip: () => {
        const [state, result] = run(mock)(initial)(program)
        assert(result[0] === 'ok', result)
        assertEq(result[1], 42)
        assertEq(state.values.k0, 42, state)
    },
    allocatesFreshKeys: () => {
        const effect = step(
            create('a'),
            a => step(
                create('b'),
                b => pureOk(/** @type {const} */ ([asBase(a), asBase(b)]))))
        const [state, result] = run(mock)(initial)(effect)
        assert(result[0] === 'ok', result)
        const [a, b] = result[1]
        assertEq(a, 'k0')
        assertEq(b, 'k1')
        assertEq(state.values.k0, 'a', state)
        assertEq(state.values.k1, 'b', state)
    },
    typeTest: () => {
        step(
            create(1),
            k => step(write(k, 5), () => read(k)))
    },
    throw: () => {
        /** @type {Key<number>} */
        const key = asNominal('missing')
        run(mock)(initial)(write(key, 1))
    },
}
