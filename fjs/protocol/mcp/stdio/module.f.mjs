/**
 * stdio transport for JSON-RPC / MCP servers.
 *
 * `stdioTransport` wraps a step function — the `mcpStep`-shaped
 * `(value) => Effect<O, Response | null, never>` from `fjs/protocol/mcp/module.f.mjs` — in the
 * canonical read → parse → dispatch → write loop, expressed as a recursive
 * effect so it stays in the pure effect model and is fully testable against a
 * mock stdin / stdout (see `fjs/effects/node/virtual`) with no real process.
 *
 * The loop only consumes `Read` (stdin, one byte at a time, via the pure
 * `readLine` combinator) and emits `Write` (stdout) on top of whatever `O` the
 * step needs (e.g. `MemOp`); it is transport-agnostic and carries no filesystem
 * dependency.
 *
 * Edge cases, matching the issue's spec:
 * - `readLine` yields `null` (EOF) → the loop returns, a clean shutdown.
 * - a malformed JSON line → a JSON-RPC parse-error response (`-32700`, `id`
 *   `null`) is written rather than silently discarded, per JSON-RPC 2.0 §5.
 * - the step yields `null` (a notification needing no reply) → nothing is
 *   written and the loop continues.
 * - a response that doesn't fit in one encoded line (`tryUtf8` overflow —
 *   `maxLength`, 128 KiB) never throws. `writeResponse` retries with a fixed,
 *   small `-32603` internal-error body carrying the original `id`; if even
 *   that overflows (a pathological caller-controlled `id`, e.g. a very large
 *   string), it retries once more with `id: null` — a fully constant response
 *   shape that is always small enough to encode. Every request that reaches
 *   `step` therefore gets *some* response line, never silence and never a
 *   crashed process.
 *
 * @module
 *
 * @import { Operation } from '../../../effects/types.ts'
 * @import { IoChannel, Read, Write } from '../../../effects/node/types.ts'
 * @import { Effect } from '../../../effects/types.ts'
 * @import { Response } from '../../json_rpc/types.ts'
 * @import { Step } from './types.ts'
 */

import { pureError, pureOk, resultStep, step } from '../../../effects/module.f.mjs'
import { ioError, readLine, write } from '../../../effects/node/module.f.mjs'
import { tryUtf8 } from '../../../text/module.f.mjs'
import { parse, stringify } from '../../../media/json/module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { internalError, jsonrpc, parseError } from '../../json_rpc/module.f.mjs'
import { error } from '../../../types/result/module.f.mjs'

const stringifyJson = stringify(sort)

/** The parse-error response (`-32700`, `id: null`) for a malformed input line. */
/** @type {Response} */
const parseErrorResponse = { jsonrpc, error: parseError, id: null }

/** An internal-error response (`-32603`) carrying `id`.
 * @type {(id: Response['id']) => Response}
 */
const internalErrorResponse = id => ({ jsonrpc, error: internalError, id })

/** Encodes a response as a newline-terminated UTF-8 line and writes it to `stdout`.
 * @type {(resp: Response) => Effect<Write, void, IoChannel>}
 */
const writeResponse = resp => {
    const v = tryUtf8(stringifyJson(resp) + '\n')
    return v === null
        ? pureError(ioError({ message: 'response does not encode as UTF-8' }))
        : write('stdout', v)
}

/**
 * Drives the read-parse-dispatch-write loop for `handler` over stdin/stdout.
 *
 * Recurses after each handled line; terminates (resolving to `void`) when
 * `readLine` reports EOF.
 *
 * A transport that cannot read its own input has no fallback to choose, but it
 * does not have to decide that here: the failure ends the loop and travels to
 * whoever started the server, which for `fjs mcp` is a message on `stderr` and
 * exit `1`. EOF is not that — `readLine` answers `ok(null)`, the loop ends, and
 * the server has done its job.
 *
 * @template {Operation} O
 * @param {Step<O>} handler
 * @returns {Effect<Read | Write | O, void, IoChannel>}
 */
export const stdioTransport = handler =>
    step(
        readLine('stdin'),
        line => line === null
            ? pureOk(undefined)
            : handleLine(handler)(line),
    )

/**
 * @template {Operation} O
 * @param {Step<O>} handler
 * @returns {(line: string) => Effect<Read | Write | O, void, IoChannel>}
 */
const handleLine = handler => line => {
    const [t, value] = parse(line)
    return resultStep(
        t === 'error'
            ? writeResponse(parseErrorResponse)
            // `step`, because a `Handle` answers `Effect<O, Response | null,
            // never>` — it absorbs its own failures into the response body — so
            // the continuation receives the response itself and there is no
            // error branch left for this chain to consider.
            : step(
                handler(value),
                resp => resp === null
                    ? pureOk(undefined)
                    // `resultStep` from here down: each write's *failure* is
                    // what selects the next, smaller fallback, so these are the
                    // both-branches case rather than a chain to short-circuit.
                    : resultStep(
                        writeResponse(resp),
                        r2 => r2[0] === 'error'
                            // The real response didn't fit. Retry with a fixed, small
                            // internal-error body carrying `resp.id` — but a
                            // caller-controlled `id` (e.g. a very large string) can
                            // itself push even this fallback over `maxLength`, so
                            // that retry is bounded by one more: an `id: null`
                            // internal-error, whose fully-constant shape is the only
                            // line in this transport guaranteed to always encode.
                            ? resultStep(
                                writeResponse(internalErrorResponse(resp.id)),
                                r3 => r3[0] === 'error'
                                    ? resultStep(
                                        writeResponse(internalErrorResponse(null)),
                                        () => pureOk(undefined),
                                    )
                                    : pureOk(undefined)
                            )
                            : pureOk(undefined)),
            ),
        // The loop continues whatever the line's own handling answered: a
        // transport that could not write one response still serves the next.
        () => stdioTransport(handler),
    )
}
