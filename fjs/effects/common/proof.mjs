/**
 * Proofs for the impure half of the host-independent operations.
 *
 * These three handlers are what every runner would otherwise write for itself,
 * so they are proved here rather than only through whichever runner happens to
 * call them — the duplication this module removed was invisible precisely
 * because each copy was covered by its own host's proofs.
 *
 * @import { Result } from '../../types/result/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { awaitPromise, io, sandbox } from './module.mjs'
import { errorMessage } from './module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

export const proof = {
    io: {
        value: async () => {
            assertEq(unwrap(await io(async () => 7)), 7)
        },
        // The one boundary where an exception becomes ordinary effect data.
        thrown: async () => {
            const r = await io(async () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }) })
            assert(r[0] === 'error', r)
            assertEq(errorMessage(r[1]), 'nope')
            assertEq(r[1][0], 'ioError')
        },
    },
    sandbox: {
        value: async () => {
            const { result, duration } = await sandbox(() => 1)
            assertEq(unwrap(result), 1)
            assert(duration >= 0, duration)
        },
        thrown: async () => {
            const { result } = await sandbox(() => { throw new Error('boom') })
            assert(result[0] === 'error', result)
            assertEq(/** @type {Error} */ (result[1]).message, 'boom')
        },
        // A real promise is awaited, and its rejection is the failure — which is
        // the rule every runner has to agree on, since this is the operation
        // that executes a proof body.
        promise: async () => {
            // The thunk is annotated because `Sandbox` declares
            // `SandboxResult<T>` while every runner resolves a real promise
            // before answering, so the declared value type is `Promise<number>`
            // where the runtime value is `2`.
            /** @type {() => unknown} */
            const resolves = () => Promise.resolve(2)
            const { result } = await sandbox(resolves)
            assertEq(unwrap(result), 2)
        },
        rejected: async () => {
            const { result } = await sandbox(() => Promise.reject(new Error('later')))
            assert(result[0] === 'error', result)
            assertEq(/** @type {Error} */ (result[1]).message, 'later')
        },
        // ...and an ordinary object carrying a `then` is a value, never a
        // thenable to adopt.
        thenable: async () => {
            const value = { then: () => undefined }
            const { result } = await sandbox(() => value)
            assertEq(unwrap(result), value)
        },
    },
    awaitPromise: {
        promise: async () => {
            assertEq((await awaitPromise(Promise.resolve(3)))[0], 3)
        },
        plainValue: async () => {
            assertEq((await awaitPromise(3))[0], 3)
        },
    },
}
