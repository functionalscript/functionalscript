/**
 * Node.js interpreter proofs for memory effects.
 *
 * @import { Key } from '../../memory/types.ts'
 * @import { Uuid } from './types.ts'
 */

import { errorSummary } from '../module.f.mjs'
import {
    asBase, asNominal,
    create, read, write,
} from '../../memory/module.f.mjs'
import { memoryRun, run } from './module.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { unwrap } from "../../../types/result/module.f.mjs"
import { step, unwrapStep } from '../../module.f.mjs'

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
    reusedRunnerPersists: async () => {
        const runner = memoryRun()
        // `unwrapStep` empties the channel, so what the runner hands back is
        // an `ok` and these unwraps are total.
        const key = unwrap(await runner(unwrapStep(create(1), errorSummary)))
        await runner(write(key, 2))
        const result = unwrap(await runner(unwrapStep(read(key), errorSummary)))
        assertEq(result, 2)
    },
    runnersDoNotShareStore: async () => {
        // Both runners mint the *same* key id, so the id cannot be what tells
        // them apart — only store ownership can. A store shared between
        // runners (module-level rather than per call) passes every other proof
        // here; this is the one that fails it.
        /** @type {Uuid} */
        const uuid = () => 'fixed'
        const a = memoryRun(uuid)
        const b = memoryRun(uuid)
        const key = unwrap(await a(unwrapStep(create(1), errorSummary)))
        const result = await b(read(key)).then(
            () => undefined,
            error => error,
        )
        assert(result instanceof Error, result)
        assertEq(result.message, 'memory key not found: fixed', result)
    },
    runIsPerCall: async () => {
        // `run` builds a runner per call, so the store the first call wrote to
        // is gone by the second. One runner shared across every `run` — the
        // other half of the store-ownership mutant — passes every other proof
        // here, including `runnersDoNotShareStore`.
        const key = unwrap(await run(unwrapStep(create(1), errorSummary)))
        const result = await run(read(key)).then(
            () => undefined,
            error => error,
        )
        assert(result instanceof Error, result)
        assertEq(result.message, `memory key not found: ${asBase(key)}`, result)
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
