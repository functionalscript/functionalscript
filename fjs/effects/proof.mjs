/**
 * Host proofs of the asynchronous runners: `all`, which a runner answers
 * over itself rather than from a host's handler.
 *
 * @import { All, RandomInt } from './common/types.ts'
 * @import { Commands, Effect } from './types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { assert, assertStructurallySame } from '../asserts/module.f.js'
import { ok } from '../types/result/module.f.js'
import { asyncTryCatch } from '../types/result/module.mjs'
import { all, randomInt } from './common/module.f.mjs'
import { asyncPartialRun, asyncRunAll } from './module.mjs'

/** A `randomInt` that always answers `4`. @type {() => Promise<ReturnType<RandomInt[1]>>} */
const four = async () => ok(4)

/** The vocabulary these proofs ask, with `all`. @type {Commands<RandomInt | All>} */
const withAll = ['all', 'randomInt']

/** The same without `all`. @type {Commands<RandomInt | All>} */
const withoutAll = ['randomInt']

export const proof = {
    // The whole runner ties `all` over its own loop: the host's map holds
    // every other handler.
    asyncRunAll: async () => {
        /** @type {<T, E>(effect: Effect<RandomInt | All, T, E>) => Promise<Result<T, E>>} */
        const run = asyncRunAll({ randomInt: four })
        assertStructurallySame(await run(all(randomInt(), randomInt())), ['ok', [['ok', 4], ['ok', 4]]])
    },
    asyncPartialRun: {
        // A partial runner answers `all` where its commands name it, the
        // effects inside it run by the same runner.
        named: async () => {
            const run = asyncPartialRun(withAll)({ randomInt: four })
            const [kind, results] = await run(all(randomInt()))
            assert(kind === 'ok')
            assertStructurallySame(results, [['ok', 4]])
        },
        // One whose commands name no `all` answers none: the node asserts as
        // the command it is not.
        unnamed: async () => {
            const run = asyncPartialRun(withoutAll)({ randomInt: four })
            const [kind] = await asyncTryCatch(() => run(all(randomInt())))
            assert(kind === 'error')
        },
    },
}
