/**
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { State } from '../../../effects/node/virtual/types.ts'
 * @import { Id } from '../../json_rpc/types.ts'
 * @import { Step } from './types.ts'
 * @import { Read, Write } from '../../../effects/node/types.ts'
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { pure } from '../../../effects/module.f.mjs'
import { pureOk } from '../../../effects/module.f.mjs'
import { emptyState, virtual } from '../../../effects/node/virtual/module.f.mjs'
import { stringify } from '../../../media/json/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { fromVec } from '../../../types/uint8array/module.f.mjs'
import { maxLengthBytes } from '../../../types/bit_vec/module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { internalError, jsonrpc, parseError } from '../../json_rpc/module.f.mjs'
import { stdioTransport } from './module.f.mjs'
import { run as mockRun } from '../../../effects/mock/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'

const stringifyJson = stringify(sort)

// Extracts the request `id` (a request has one; a notification does not).
/** @type {(value: Unknown) => Id | undefined} */
const idOf = value =>
    value !== null && typeof value === 'object' && !(value instanceof Array)
        ? /** @type {{ readonly id?: Id }} */ (value).id
        : undefined

// A step that mirrors the mcpStep contract closely enough to drive the loop:
// a message carrying an `id` (a request) gets an echo success response; a
// message without an `id` (a notification) yields `null` — no reply.
/** @type {Step<never>} */
const echoStep = value => {
    const id = idOf(value)
    return pureOk(id === undefined
        ? null
        : { jsonrpc, result: { ok: true }, id })
}

// UTF-8 bytes of `s` as a plain array — the virtual stdin byte stream.
/** @type {(s: string) => readonly number[]} */
const toBytes = s => [...fromVec(utf8(s))]

// Run the transport with `step` over `input` fed to stdin one byte at a time;
// return the final state. `input` is raw text so tests control newline framing.
/** @type {(step: Step<never>) => (input: string) => State} */
const runStep = step => input =>
    virtual({ ...emptyState, stdin: toBytes(input) })(stdioTransport(step))[0]

const run = runStep(echoStep)

/** @type {(id: Id) => string} */
const okResponse = id =>
    stringifyJson({ jsonrpc, result: { ok: true }, id }) + '\n'

/** @type {string} */
const parseErrorLine =
    stringifyJson({ jsonrpc, error: parseError, id: null }) + '\n'

/** @type {(id: Id) => string} */
const internalErrorLine = id =>
    stringifyJson({ jsonrpc, error: internalError, id }) + '\n'

/** @type {(id: number) => string} */
const ping = id => `{"jsonrpc":"2.0","method":"ping","id":${id}}`

// One byte past `maxLengthBytes` on its own; embedded in a response envelope
// it stays comfortably over the limit despite the surrounding JSON overhead.
const oversizedString = 'a'.repeat(Number(maxLengthBytes) + 1)

const notification = '{"jsonrpc":"2.0","method":"notifications/initialized"}'

export const proof = {
    // A stdin that cannot be read ends the loop and hands the failure back,
    // where it used to panic. EOF is not this case: that is `ok(null)`, and
    // `eofImmediately` above pins it as the clean shutdown it should be.
    readFailurePropagates: () => {
        const runner = mockRun(/** @type {Parameters<typeof mockRun<Read | Write, undefined>>[0]} */ ({
            read: () => (/** @type {undefined} */ s) => [s, error(/** @type {const} */ (['notImplemented', 'read']))],
            write: () => (/** @type {undefined} */ s) => [s, ok(undefined)],
        }))
        const [, result] = runner(undefined)(stdioTransport(echoStep))
        assert(result[0] === 'error', result)
    },

    // The same, one turn of the loop later. The proof above only reaches the
    // *first* read, so a tail that swallowed the failure on recursion would
    // still pass it: here stdin yields one complete line, the handler answers
    // it, and the read after that fails.
    readFailureAfterALinePropagates: () => {
        const bytes = toBytes(ping(1) + '\n')
        const runner = mockRun(/** @type {Parameters<typeof mockRun<Read | Write, readonly number[]>>[0]} */ ({
            read: () => (/** @type {readonly number[]} */ s) =>
                s.length === 0
                    ? [s, error(/** @type {const} */ (['notImplemented', 'read']))]
                    : [s.slice(1), ok(s[0])],
            write: () => (/** @type {readonly number[]} */ s) => [s, ok(undefined)],
        }))
        const [rest, result] = runner(bytes)(stdioTransport(echoStep))
        assertEq(rest.length, 0, 'expected the line to be consumed before the failure')
        assert(result[0] === 'error', result)
    },

    // EOF on the very first read: clean shutdown, nothing written, no further reads.
    eofImmediately: () => {
        const state = run('')
        assertEq(state.stdout, '')
        assertEq(state.stdin.length, 0)
    },

    // A newline-terminated request is parsed, dispatched, and its response
    // written; stdin is fully drained before the terminating EOF.
    requestWritesResponse: () => {
        const state = run(ping(1) + '\n')
        assertEq(state.stdout, okResponse(1))
        assertEq(state.stdin.length, 0)
    },

    // A final line lacking a trailing newline is still flushed and dispatched
    // (covers `readLine`'s EOF-with-buffered-bytes branch).
    requestWithoutTrailingNewline: () => {
        const state = run(ping(2))
        assertEq(state.stdout, okResponse(2))
    },

    // A notification (no `id`) yields a `null` step result → nothing is written.
    notificationWritesNothing: () => {
        const state = run(notification + '\n')
        assertEq(state.stdout, '')
    },

    // A malformed JSON line produces a JSON-RPC parse-error response (-32700),
    // not a silent discard.
    malformedJsonWritesParseError: () => {
        const state = run('not json\n')
        assertEq(state.stdout, parseErrorLine)
    },

    // A request that is not strict JSON (trailing comma) must be rejected with
    // a parse error, never dispatched to the step.
    trailingCommaWritesParseError: () => {
        const state = run('{"jsonrpc":"2.0","method":"ping","id":1,}\n')
        assertEq(state.stdout, parseErrorLine)
    },

    // A response with an optional field explicitly `undefined` serializes like
    // JSON.stringify — the field is omitted, not a thrown TypeError that would
    // abort the loop.
    undefinedFieldOmitted: () => {
        /** @type {Step<never>} */
        const step = value => {
            const id = idOf(value)
            return pureOk(id === undefined
                ? null
                : { jsonrpc, result: { ok: true, nextCursor: undefined }, id })
        }
        const state = runStep(step)(ping(1) + '\n')
        assertEq(state.stdout, okResponse(1))
    },

    // A response that would exceed `maxLengthBytes` once UTF-8 encoded cannot
    // be written as a single bit vector (`tryUtf8` reports overflow); the loop
    // writes a JSON-RPC internal-error response — carrying the original
    // request's `id`, not `null` — instead of throwing or silently dropping
    // the reply.
    oversizedResponseWritesInternalError: () => {
        /** @type {Step<never>} */
        const step = value => {
            const id = idOf(value)
            return pureOk(id === undefined
                ? null
                : { jsonrpc, result: { big: oversizedString }, id })
        }
        const state = runStep(step)(ping(1) + '\n')
        assertEq(state.stdout, internalErrorLine(1))
    },
    // The loop recovers from the oversized-response error and keeps draining
    // stdin: a well-behaved request on the next line still gets its normal
    // reply.
    loopContinuesAfterOversizedResponse: () => {
        /** @type {Step<never>} */
        const step = value => {
            const id = idOf(value)
            return pureOk(id === undefined
                ? null
                : id === 1
                    ? { jsonrpc, result: { big: oversizedString }, id }
                    : { jsonrpc, result: { ok: true }, id })
        }
        const state = runStep(step)([ping(1), ping(2)].join('\n'))
        assertEq(state.stdout, internalErrorLine(1) + okResponse(2))
        assertEq(state.stdin.length, 0)
    },

    // When even the `id`-preserving internal-error fallback would overflow —
    // because the `id` itself is the oversized part, not just `result` — the
    // loop falls back once more to a fixed `id: null` internal-error, the only
    // shape in this transport guaranteed to always fit. Without this second
    // fallback tier the request would get no response line at all.
    oversizedIdFallsBackToNullId: () => {
        /** @type {Step<never>} */
        const step = value => {
            const id = idOf(value)
            return pureOk(id === undefined
                ? null
                : { jsonrpc, result: { ok: true }, id: oversizedString })
        }
        const state = runStep(step)(ping(1) + '\n')
        assertEq(state.stdout, internalErrorLine(null))
    },

    // A multi-line session interleaving all cases: request, notification, and
    // malformed line, ending with an unterminated request. Order is preserved
    // and the notification contributes nothing.
    multipleLines: () => {
        const state = run([ping(1), notification, 'not json', ping(2)].join('\n'))
        assertEq(state.stdout, okResponse(1) + parseErrorLine + okResponse(2))
        assertEq(state.stdin.length, 0)
    },
}
