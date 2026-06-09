/**
 * Node.js interpreter proofs for memory effects.
 *
 * @module
 */

import { asNominal } from '../../types/nominal/module.f.ts'
import { asyncRun } from '../module.ts'
import { create, read, write, type Key, type MemOp } from './module.f.ts'
import { memoryOperationMap, run } from './module.ts'

export const proof = {
    nodeInterpreter: async () => {
        const result = await run(create(1).step(key =>
            write(key, 2).step(() =>
                read(key)
            )
        ))
        if (result !== 2) { throw result }
    },
    reusedOperationMapPersists: async () => {
        const runner = asyncRun<MemOp>(memoryOperationMap())
        const key = await runner(create(1))
        await runner(write(key, 2))
        const result = await runner(read(key))
        if (result !== 2) { throw result }
    },
    missingKeyThrows: async () => {
        const key: Key<number> = asNominal<'MemKey', 'key', string>('missing')
        const result = await run(read(key)).then(
            () => undefined,
            error => error,
        )
        if (!(result instanceof Error)) { throw result }
        if (result.message !== 'memory key not found: missing') { throw result }
    },
}
