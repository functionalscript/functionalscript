/**
 * Node.js interpreter proofs for memory effects.
 *
 * @module
 *
 * @import { Key, MemOp } from '../../memory/types.ts'
 */

import { asyncRun } from '../../module.mjs'
import { errorSummary } from '../module.f.mjs'
import {
    asNominal,
    create, read, write,
} from '../../memory/module.f.mjs'
import { memoryOperationMap, run } from './module.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { step, unwrapStep } from '../../io/module.f.mjs'

export const proof = {
    nodeInterpreter: async () => {
        const x = step(
            create(1),
            key => step(
                write(key, 2),
                () => read(key)))
        const r = await run(x)
        assert(r[0] === 'ok', r)
        assertEq(r[1], 2)
    },
    reusedOperationMapPersists: async () => {
        const runner = asyncRun(/** @type {import('../../types.ts').ToAsyncOperationMap<MemOp>} */ (memoryOperationMap()))
        const key = await runner(unwrapStep(create(1), errorSummary))
        await runner(write(key, 2))
        const result = await runner(unwrapStep(read(key), errorSummary))
        assertEq(result, 2)
    },
    missingKeyThrows: async () => {
        /** @type {Key<number>} */
        const key = asNominal('missing')
        const result = await run(read(key)).then(
            () => undefined,
            error => error,
        )
        assert(result instanceof Error, result)
        assertEq(result.message, 'memory key not found: missing', result)
    },
}
