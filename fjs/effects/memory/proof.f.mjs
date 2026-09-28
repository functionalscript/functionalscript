/**
 * @import { Key } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { run } from '../mock/module.f.mjs'
import { pureOk, step } from '../module.f.mjs'
import {
    asBase, asNominal,
    create, read, write,
    memoryInitial, memoryOperationMap,
} from './module.f.mjs'

const runMemory = run(memoryOperationMap)(memoryInitial)

// `step`: each link runs only because the previous one returned `ok`,
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
        const [state, result] = runMemory(program)
        assert(result[0] === 'ok', result)
        assertEq(result[1], 42)
        assertEq(state.values.mem0, 42, state)
    },
    allocatesFreshKeys: () => {
        const effect = step(
            create('a'),
            a => step(
                create('b'),
                b => pureOk(/** @type {const} */ ([asBase(a), asBase(b)]))))
        const [state, result] = runMemory(effect)
        assert(result[0] === 'ok', result)
        const [a, b] = result[1]
        assertEq(a, 'mem0')
        assertEq(b, 'mem1')
        assertEq(state.next, 2, state)
        assertEq(state.values.mem0, 'a', state)
        assertEq(state.values.mem1, 'b', state)
    },
    // What makes presence the test rather than the value: a slot holding
    // `undefined` was allocated, and reading one is not the failure below.
    // A guard written as `=== undefined` would answer them alike.
    holdsUndefined: () => {
        const [, result] = runMemory(step(create(undefined), key => read(key)))
        assert(result[0] === 'ok', result)
        assertEq(result[1], undefined)
    },
    typeTest: () => {
        step(
            create(1),
            k => step(write(k, 5), () => read(k)))
    },
    // `mem0` is the name `memCreate` would hand out first, so these are not
    // spellings no run could produce — they are the slot a caller forgot to
    // allocate.
    throw: {
        readOfNeverCreated: () => {
            /** @type {Key<number>} */
            const key = asNominal('mem0')
            runMemory(read(key))
        },
        writeToNeverCreated: () => {
            /** @type {Key<number>} */
            const key = asNominal('mem0')
            runMemory(write(key, 1))
        },
    },
}
