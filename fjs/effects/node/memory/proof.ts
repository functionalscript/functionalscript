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
import { assert, assertEq } from '../../../asserts/module.f.ts'
import { step } from '../../module.f.ts'

export const proof = {
    nodeInterpreter: async () => {
        const x = step(
            create(1),
            key => step(
                write(key, 2),
                () => read(key)))
        assertEq(await run(x), 2)
    },
    reusedOperationMapPersists: async () => {
        const runner = asyncRun<MemOp>(memoryOperationMap())
        const key = await runner(create(1))
        await runner(write(key, 2))
        const result = await runner(read(key))
        assertEq(result, 2)
    },
    missingKeyThrows: async () => {
        const key: Key<number> = asNominal('missing')
        const result = await run(read(key)).then(
            () => undefined,
            error => error,
        )
        assert(result instanceof Error, result)
        assertEq(result.message, 'memory key not found: missing', result)
    },
}
