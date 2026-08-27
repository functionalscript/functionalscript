/**
 * Proofs for the host-independent operations and the helpers that read their
 * error channel.
 *
 * The operations are proved against a stand-in interpreter declared here rather
 * than against a host runner: what this module owns is the *constructors* and
 * the `ok`-channel collapse, and a proof that reached for `../node/virtual`
 * would be reading a Node runner's answers to decide whether `all` builds the
 * right node. Each host runner proves its own handlers — `../node/proof.f.mjs`
 * for the virtual and Node ones, `../../emergent_testing/browser/proof.mjs` for
 * the browser one.
 *
 * @import { Effect } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { MemOperationMap, RunInstance } from '../mock/types.ts'
 * @import { CommonOp, SandboxResult } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import {
    all, allOk, awaitIfPromise, both, errorMessage, errorSummary, fetch, import_,
    ioError, isNotFound, now, sandbox, toIoError,
} from './module.f.mjs'
import { run as mockRun } from '../mock/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { vec8 } from '../../types/bit_vec/module.f.mjs'

/** The one number the stand-in clock ever answers. */
const fixedNow = 1_700_000_000

/** @type {MemOperationMap<CommonOp, null>} */
const map = {
    all: (...a) => state => [state, ok(a.map(i => common(state)(i)[1]))],
    await: p => state => [state, ok([p])],
    fetch: url => state => [
        state,
        url === 'ok' ? ok(vec8(0x2An)) : error(ioError({ message: `cannot fetch ${url}` })),
    ],
    import: source => state => [
        state,
        source === 'ok' ? ok({ value: 1 }) : error(ioError({ code: 'ENOENT', message: source })),
    ],
    now: () => state => [state, ok(fixedNow)],
    // The same pass-through the virtual Node runner uses: a fixture returns the
    // `SandboxResult` it wants reported, so an outcome is dictated rather than
    // measured.
    sandbox: f => state => [state, ok(/** @type {SandboxResult<unknown>} */ (f()))],
}

/** @type {RunInstance<CommonOp, null>} */
const common = mockRun(map)

/** @type {<T, E>(e: Effect<CommonOp, T, E>) => Result<T, E>} */
const run = e => common(null)(e)[1]

export const proof = {
    // The one boundary where a runner's `catch` becomes effect data: whatever
    // was thrown is reduced to a code (when the host attached a string one)
    // and a message.
    toIoError: {
        error: () => {
            assertEq(toIoError(new Error('boom'))[1].message, 'boom')
        },
        withCode: () => {
            const [, info] = toIoError(Object.assign(new Error('missing'), { code: 'ENOENT' }))
            assertEq(info.code, 'ENOENT')
            assertEq(info.message, 'missing')
        },
        // A thrown non-`Error` still normalizes: the value's string form is the
        // message, and there is no code to carry.
        string: () => {
            const [, info] = toIoError('plain')
            assertEq(info.code, undefined)
            assertEq(info.message, 'plain')
        },
        null: () => {
            assertEq(toIoError(null)[1].message, 'null')
        },
        // An object whose `code` is not a string is not an OS error code, so it
        // is dropped rather than carried as one.
        nonStringCode: () => {
            assertEq(toIoError({ code: 42 })[1].code, undefined)
        },
        noCode: () => {
            assertEq(toIoError({})[1].code, undefined)
        },
    },
    isNotFound: {
        enoent: () => {
            assert(isNotFound(ioError({ code: 'ENOENT', message: 'no such file or directory' })))
        },
        otherCode: () => {
            assert(!isNotFound(ioError({ code: 'EACCES', message: 'permission denied' })))
        },
        // A runner that cannot perform the operation has not looked for the
        // path at all, so a missing handler is never "not found".
        notImplemented: () => {
            assert(!isNotFound(['notImplemented', 'readFile']))
        },
    },
    errorMessage: {
        io: () => {
            assertEq(errorMessage(ioError({ message: 'disk full' })), 'disk full')
        },
        notImplemented: () => {
            assertEq(errorMessage(['notImplemented', 'readFile']), 'operation not implemented: readFile')
        },
    },
    errorSummary: {
        // The distinction that matters: `errorMessage` hands back the host's
        // words, which is where the path lives; `errorSummary` never does.
        io: () => {
            assertEq(errorSummary(ioError({ code: 'ENOENT', message: "no such file or directory, scandir '/home/u/.cas'" })), 'io error: ENOENT')
        },
        ioWithoutCode: () => {
            assertEq(errorSummary(ioError({ message: "cannot read '/home/u/.cas'" })), 'io error')
        },
        notImplemented: () => {
            assertEq(errorSummary(['notImplemented', 'readdir']), 'operation not implemented: readdir')
        },
    },
    // `all` answers each effect's whole `Result`: its own envelope says only
    // whether the operation could be dispatched.
    all: () => {
        const r = unwrap(run(all(fetch('ok'), fetch('no'))))
        assertEq(r.length, 2)
        assertEq(r[0]?.[0], 'ok')
        assertEq(r[1]?.[0], 'error')
    },
    allOk: {
        // The collapse a fallible chain wants: values when every effect
        // succeeded...
        collects: () => {
            assertEq(unwrap(run(allOk(now(), now()))).join(','), `${fixedNow},${fixedNow}`)
        },
        // ...and the first failure in list order otherwise.
        firstError: () => {
            const r = run(allOk(fetch('no'), fetch('worse')))
            assert(r[0] === 'error', r)
            assertEq(errorMessage(r[1]), 'cannot fetch no')
        },
    },
    both: () => {
        const [a, b] = unwrap(run(both(now())(import_('ok'))))
        assertEq(unwrap(a ?? error(0)), fixedNow)
        assertEq(unwrap(b ?? error(0)).value, 1)
    },
    import: {
        linked: () => {
            assertEq(unwrap(run(import_('ok'))).value, 1)
        },
        missing: () => {
            const r = run(import_('nope'))
            assert(r[0] === 'error', r)
            assert(isNotFound(r[1]), r[1])
        },
    },
    sandbox: () => {
        const { result, duration } = unwrap(run(sandbox(() => ({ result: ok(7), duration: 3 }))))
        assertEq(unwrap(result), 7)
        assertEq(duration, 3)
    },
    // A promise is the runner's business, so what the constructor owns is
    // unwrapping the one-element tuple the operation answers with.
    awaitIfPromise: () => {
        assertEq(unwrap(run(awaitIfPromise(5))), 5)
    },
}
