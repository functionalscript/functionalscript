/**
 * stdio transport for JSON-RPC / MCP servers.
 *
 * `stdioTransport` wraps a step function — the `mcpStep`-shaped
 * `(value) => Effect<O, Response | null>` from `fjs/mcp/module.f.ts` — in the
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
 */
import { pure, step, type Effect, type Operation } from '../../effects/module.f.ts'
import { readLine, write, type IoResult, type Read, type Write } from '../../effects/node/module.f.ts'
import { tryUtf8 } from '../../text/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { stringify, type Unknown } from '../../media/json/module.f.ts'
import { tokenize } from '../../media/json/tokenizer/module.f.ts'
import { parse } from '../../media/json/parser/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { internalError, jsonrpc, parseError, type Response } from '../../media/json/rpc/module.f.ts'
import { error, ok } from '../../types/result/module.f.ts'

/**
 * A transport step: maps one parsed JSON-RPC message to a response, or `null`
 * for a notification that needs no reply. The shape of `mcpStep(config)(handlers)(key)`.
 */
export type Step<O extends Operation> = (value: Unknown) => Effect<O, Response | null>

const stringifyJson = stringify(sort)

/** The parse-error response (`-32700`, `id: null`) for a malformed input line. */
const parseErrorResponse: Response = { jsonrpc, error: parseError, id: null }

/** An internal-error response (`-32603`) carrying `id`. */
const internalErrorResponse = (id: Response['id']): Response => ({ jsonrpc, error: internalError, id })

/** Encodes a response as a newline-terminated UTF-8 line and writes it to `stdout`. */
const writeResponse = (resp: Response): Effect<Write, IoResult<void>> => {
    const v = tryUtf8(stringifyJson(resp) + '\n')
    return v === null
        ? pure(error(undefined))
        : step(write('stdout', v), () => pure(ok(undefined)))
}

/**
 * Drives the read-parse-dispatch-write loop for `handler` over stdin/stdout.
 *
 * Recurses after each handled line; terminates (resolving to `void`) when
 * `readLine` reports EOF.
 */
export const stdioTransport =
    <O extends Operation>(handler: Step<O>): Effect<Read | Write | O, void> =>
    step(readLine('stdin'), line =>
        line === null
            ? pure(undefined)
            : handleLine(handler)(line))

const handleLine =
    <O extends Operation>(handler: Step<O>) =>
    (line: string): Effect<Read | Write | O, void> => {
        const [t, value] = parse(tokenize(stringToList(line)))
        return step(
            t === 'error'
                ? writeResponse(parseErrorResponse)
                : step(handler(value), resp =>
                    resp === null
                        ? pure(undefined)
                        : step(writeResponse(resp), ([t2]) => t2 === 'error'
                            // The real response didn't fit. Retry with a fixed, small
                            // internal-error body carrying `resp.id` — but a
                            // caller-controlled `id` (e.g. a very large string) can
                            // itself push even this fallback over `maxLength`, so
                            // that retry is bounded by one more: an `id: null`
                            // internal-error, whose fully-constant shape is the only
                            // line in this transport guaranteed to always encode.
                            ? step(writeResponse(internalErrorResponse(resp.id)), ([t3]) => t3 === 'error'
                                ? step(writeResponse(internalErrorResponse(null)), () => pure(undefined))
                                : pure(undefined))
                            : pure(undefined))),
            () => stdioTransport(handler))
    }
