import { assertEq } from '../../asserts/module.f.ts'
import { pure, type Effect } from '../../effects/module.f.ts'
import { emptyState, virtual, type State } from '../../effects/node/virtual/module.f.ts'
import type { Unknown } from '../../json/module.f.ts'
import { stringify } from '../../json/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { fromVec } from '../../types/uint8array/module.f.ts'
import { maxLengthBytes } from '../../types/bit_vec/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { internalError, jsonrpc, parseError, type Id, type Response } from '../../json/rpc/module.f.ts'
import { stdioTransport, type Step } from './module.f.ts'

const stringifyJson = stringify(sort)

// Extracts the request `id` (a request has one; a notification does not).
const idOf = (value: Unknown): Id | undefined =>
    value !== null && typeof value === 'object' && !(value instanceof Array)
        ? (value as { readonly id?: Unknown }).id as Id | undefined
        : undefined

// A step that mirrors the mcpStep contract closely enough to drive the loop:
// a message carrying an `id` (a request) gets an echo success response; a
// message without an `id` (a notification) yields `null` — no reply.
const echoStep: Step<never> = (value: Unknown): Effect<never, Response | null> => {
    const id = idOf(value)
    return pure(id === undefined
        ? null
        : { jsonrpc, result: { ok: true }, id })
}

// UTF-8 bytes of `s` as a plain array — the virtual stdin byte stream.
const toBytes = (s: string): readonly number[] => [...fromVec(utf8(s))]

// Run the transport with `step` over `input` fed to stdin one byte at a time;
// return the final state. `input` is raw text so tests control newline framing.
const runStep = (step: Step<never>) => (input: string): State =>
    virtual({ ...emptyState, stdin: toBytes(input) })(stdioTransport(step))[0]

const run = runStep(echoStep)

const okResponse = (id: Id): string =>
    stringifyJson({ jsonrpc, result: { ok: true }, id } as Unknown) + '\n'

const parseErrorLine: string =
    stringifyJson({ jsonrpc, error: parseError, id: null } as Unknown) + '\n'

const internalErrorLine = (id: Id): string =>
    stringifyJson({ jsonrpc, error: internalError, id } as Unknown) + '\n'

const ping = (id: number): string => `{"jsonrpc":"2.0","method":"ping","id":${id}}`

// One byte past `maxLengthBytes` on its own; embedded in a response envelope
// it stays comfortably over the limit despite the surrounding JSON overhead.
const oversizedString = 'a'.repeat(Number(maxLengthBytes) + 1)

const notification = '{"jsonrpc":"2.0","method":"notifications/initialized"}'

export const proof = {
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
        const step: Step<never> = (value: Unknown): Effect<never, Response | null> => {
            const id = idOf(value)
            return pure(id === undefined
                ? null
                : { jsonrpc, result: { ok: true, nextCursor: undefined }, id } as unknown as Response)
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
        const step: Step<never> = (value: Unknown): Effect<never, Response | null> => {
            const id = idOf(value)
            return pure(id === undefined
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
        const step: Step<never> = (value: Unknown): Effect<never, Response | null> => {
            const id = idOf(value)
            return pure(id === undefined
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
        const step: Step<never> = (value: Unknown): Effect<never, Response | null> => {
            const id = idOf(value)
            return pure(id === undefined
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
