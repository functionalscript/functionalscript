import { assertEq } from '../../asserts/module.f.ts'
import { pure, type Effect } from '../../effects/module.f.ts'
import { emptyState, virtual, type State } from '../../effects/node/virtual/module.f.ts'
import type { Unknown } from '../../json/module.f.ts'
import { stringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { jsonrpc, parseError, type Id, type Response } from '../../json/rpc/module.f.ts'
import { stdioTransport, type Step } from './module.f.ts'

const stringifyJson = stringify(sort)

// A step that mirrors the mcpStep contract closely enough to drive the loop:
// a message carrying an `id` (a request) gets an echo success response; a
// message without an `id` (a notification) yields `null` — no reply.
const echoStep: Step<never> = (value: Unknown): Effect<never, Response | null> => {
    const id = value !== null && typeof value === 'object' && !(value instanceof Array)
        ? (value as { readonly id?: Unknown }).id
        : undefined
    return pure(id === undefined
        ? null
        : { jsonrpc, result: { ok: true }, id: id as Id })
}

// Run the transport over a fixed list of stdin lines, return the final state.
const runLines = (lines: readonly string[]): State =>
    virtual({ ...emptyState, stdin: lines })(stdioTransport(echoStep))[0]

const okResponse = (id: Id): string =>
    stringifyJson({ jsonrpc, result: { ok: true }, id } as Unknown) + '\n'

const parseErrorLine: string =
    stringifyJson({ jsonrpc, error: parseError, id: null } as Unknown) + '\n'

export const proof = {
    // EOF on the very first read: clean shutdown, nothing written, no further reads.
    eofImmediately: () => {
        const state = runLines([])
        assertEq(state.stdout, '')
        assertEq(state.stdin.length, 0)
    },

    // A request line is parsed, dispatched, and its response written to stdout;
    // stdin is fully consumed before the terminating EOF.
    requestWritesResponse: () => {
        const state = runLines(['{"jsonrpc":"2.0","method":"ping","id":1}'])
        assertEq(state.stdout, okResponse(1))
        assertEq(state.stdin.length, 0)
    },

    // A notification (no `id`) yields a `null` step result → nothing is written.
    notificationWritesNothing: () => {
        const state = runLines(['{"jsonrpc":"2.0","method":"notifications/initialized"}'])
        assertEq(state.stdout, '')
    },

    // A malformed JSON line produces a JSON-RPC parse-error response (-32700),
    // not a silent discard.
    malformedJsonWritesParseError: () => {
        const state = runLines(['{ this is not json'])
        assertEq(state.stdout, parseErrorLine)
    },

    // A multi-line session interleaving all three cases: request, notification,
    // and malformed line. Two lines are written (request + parse error); the
    // notification contributes nothing. Order is preserved.
    multipleLines: () => {
        const state = runLines([
            '{"jsonrpc":"2.0","method":"ping","id":1}',
            '{"jsonrpc":"2.0","method":"notifications/initialized"}',
            'not json',
            '{"jsonrpc":"2.0","method":"ping","id":2}',
        ])
        assertEq(state.stdout, okResponse(1) + parseErrorLine + okResponse(2))
        assertEq(state.stdin.length, 0)
    },
}
