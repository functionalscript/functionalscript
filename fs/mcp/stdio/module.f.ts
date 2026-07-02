/**
 * stdio transport for JSON-RPC / MCP servers.
 *
 * `stdioTransport` wraps a step function — the `mcpStep`-shaped
 * `(value) => Effect<O, Response | null>` from `fs/mcp/module.f.ts` — in the
 * canonical read → parse → dispatch → write loop, expressed as a recursive
 * effect so it stays in the pure effect model and is fully testable against a
 * mock stdin / stdout (see `fs/effects/node/virtual`) with no real process.
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
 *
 * @module
 */
import { pure, type Effect, type Operation } from '../../effects/module.f.ts'
import { readLine, write, type IoResult, type Read, type Write } from '../../effects/node/module.f.ts'
import { tryUtf8 } from '../../text/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { stringify, type Unknown } from '../../json/module.f.ts'
import { tokenize } from '../../json/tokenizer/module.f.ts'
import { parse } from '../../json/parser/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { internalError, jsonrpc, parseError, type Response } from '../../json/rpc/module.f.ts'
import { error, ok } from '../../types/result/module.f.ts'

/**
 * A transport step: maps one parsed JSON-RPC message to a response, or `null`
 * for a notification that needs no reply. The shape of `mcpStep(config)(handlers)(key)`.
 */
export type Step<O extends Operation> = (value: Unknown) => Effect<O, Response | null>

const stringifyJson = stringify(sort)

/** The parse-error response (`-32700`, `id: null`) for a malformed input line. */
const parseErrorResponse: Response = { jsonrpc, error: parseError, id: null }

/** Encodes a response as a newline-terminated UTF-8 line and writes it to `stdout`. */
const writeResponse = (resp: Response): Effect<Write, IoResult<void>> => {
    const v = tryUtf8(stringifyJson(resp) + '\n')
    return v === null
        ? pure(error(undefined))
        : write('stdout', v).step(() => pure(ok(undefined)))
}

/**
 * Drives the read-parse-dispatch-write loop for `step` over stdin/stdout.
 *
 * Recurses after each handled line; terminates (resolving to `void`) when
 * `readLine` reports EOF.
 */
export const stdioTransport =
    <O extends Operation>(step: Step<O>): Effect<Read | Write | O, void> =>
    readLine('stdin').step(line =>
        line === null
            ? pure(undefined)
            : handleLine(step)(line))

const handleLine =
    <O extends Operation>(step: Step<O>) =>
    (line: string): Effect<Read | Write | O, void> => {
        const [t, value] = parse(tokenize(stringToList(line)))
        return (t === 'error'
            ? writeResponse(parseErrorResponse)
            : step(value).step(resp =>
                resp === null
                    ? pure(undefined)
                    : writeResponse(resp).step(([t2]) => t2 === 'error'
                        ? writeResponse({ jsonrpc, error: internalError, id: resp.id })
                        : pure(undefined)))
        ).step(() => stdioTransport(step))
    }
