/**
 * Node.js interpreter proofs for memory effects.
 *
 * @module
 */

import { asyncRun } from '../../module.ts'
import {
    asNominal,
    create, read, write,
    type Key, type MemOp,
} from '../../memory/module.f.ts'
import { memoryOperationMap, run } from './module.ts'
import { assert } from '../../../asserts/module.f.ts'

export const proof = {
    nodeInterpreter: async () => {
        const result = await run(create(1).step(key =>
            write(key, 2).step(() =>
                read(key)
            )
        ))
        assert(result === 2, result)
    },
    reusedOperationMapPersists: async () => {
        const runner = asyncRun<MemOp>(memoryOperationMap())
        const key = await runner(create(1))
        await runner(write(key, 2))
        const result = await runner(read(key))
        assert(result === 2, result)
    },
    missingKeyThrows: async () => {
        const key: Key<number> = asNominal('missing')
        const result = await run(read(key)).then(
            () => undefined,
            error => error,
        )
        assert(result instanceof Error, result)
        assert(result.message === 'memory key not found: missing', result)
    },
}
