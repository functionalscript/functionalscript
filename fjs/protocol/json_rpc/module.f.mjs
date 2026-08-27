/**
 * JSON-RPC 2.0 envelopes and a pure dispatcher.
 *
 * The envelopes are rtti schemas, so one declaration yields both a runtime
 * decoder (`parse(request)`) and the static type (`Ts<typeof request>`) — no
 * drift between them. The dispatcher is pure: it maps an already-parsed request
 * value to a response value (or `null` for a notification) and performs no I/O.
 *
 * Out of scope here (follow-ups): transports — stdio / HTTP framing — over
 * `fjs/effects/node`, and concrete method sets such as MCP (i665-mcp), which layer
 * on top of `dispatch`.
 *
 * https://www.jsonrpc.org/specification
 *
 * @module
 *
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { Id, RpcError, Handlers, Response, SuccessResponse, ErrorResponse } from './types.ts'
 */

import { at } from '../../types/object/module.f.mjs'
import { number, open, string, or, option } from '../../rtti/module.f.mjs'
import { parse } from '../../types/rtti/parse/module.f.mjs'
import { unknown } from '../../media/json/rtti/module.f.mjs'

export const jsonrpc = /** @type {const} */ ('2.0')

/** Request/response identifier: a string, a number, or `null`. */
export const _id = or(string, number, null)

/**
 * A request or notification envelope. `id` present → request (a response is
 * expected); `id` absent → notification (no response). `params` is optional.
 *
 * `open`, as every envelope in this module is: a bare struct is closed, and a
 * peer implementing a later revision of the protocol may send members this one
 * does not name — rejecting those outright is the opposite of what a wire
 * format wants. Do not drop the wrapper.
 *
 * https://www.jsonrpc.org/specification#request_object
 */
export const request = open(/** @type {const} */ ({
    jsonrpc,
    method: string,
    params: option(unknown),
    id: option(_id),
}))

/** The JSON-RPC error object — `open`, for the reason {@link request} gives. */
export const error = open(/** @type {const} */ ({
    code: number,
    message: string,
    data: option(unknown),
}))

export const successResponse = open(/** @type {const} */ ({ jsonrpc, result: unknown, id: _id }))
export const errorResponse = open(/** @type {const} */ ({ jsonrpc, error, id: _id }))

/**
 * A response envelope: either a success (`result`) or an error (`error`).
 * Derived from the rtti schema via `Ts<>` — the same declaration is the
 * runtime decoder and the static type, with no drift. Both arms say `open`
 * (extra keys allowed), so "result XOR error" is not enforced at runtime; in
 * practice the dispatcher only ever constructs one or the other.
 *
 * https://www.jsonrpc.org/specification#response_object
 */
export const response = or(successResponse, errorResponse)

/** Decodes an untrusted value as a JSON-RPC request / notification. */
export const decodeRequest = parse(request)

/**
 * Builds an `RpcError` with the given `code` and `message` (no `data`).
 * @type {(code: number) => (message: string) => RpcError}
 */
export const rpcError = code => message => ({ code, message })

// The standard JSON-RPC 2.0 errors.
export const parseError = rpcError(-32700)('Parse error')
export const invalidRequest = rpcError(-32600)('Invalid Request')
export const methodNotFound = rpcError(-32601)('Method not found')
export const invalidParams = rpcError(-32602)('Invalid params')
export const internalError = rpcError(-32603)('Internal error')

/**
 * The error half of the response envelope: `{ jsonrpc, error, id }`.
 *
 * Exported as one of a pair with {@link successResponseOf} — the `Response`
 * schema, `jsonrpc`, `Id` and `RpcError` are all owned here, so the two shapes
 * built from them are too. Every protocol layered on this module needs both
 * (`fjs/protocol/mcp` and its stdio transport are the two consumers today),
 * and a private constructor is what made each of them re-roll its own.
 *
 * It answers the `Response` union rather than {@link ErrorResponse}, the branch
 * it always builds. That is deliberate: every consumer in the tree is a
 * dispatcher answering either arm — `dispatch` here, `mcpStep` and the stdio
 * transport in `fjs/protocol/mcp` — and `Handle` is defined in terms of the
 * union, so the branch type would have to be widened again at each of them.
 * {@link ErrorResponse} is exported for a caller that does want it.
 *
 * @type {(id: Id) => (error: RpcError) => Response}
 */
export const errorResponseOf = id => error => ({ jsonrpc, error, id })

/**
 * The success half of the response envelope: `{ jsonrpc, result, id }`.
 *
 * The `…Of` suffix pairs with {@link errorResponseOf}, and both name the
 * already-exported `successResponse` / `errorResponse` schemas they build a
 * value of.
 *
 * It answers the union for the reason {@link errorResponseOf} does, and
 * {@link SuccessResponse} names the branch for a caller that wants it.
 *
 * @type {(id: Id) => (result: Unknown) => Response}
 */
export const successResponseOf = id => result => ({ jsonrpc, result, id })

/**
 * Dispatches an already-parsed JSON-RPC value against `handlers`.
 *
 * - invalid envelope → `Invalid Request` (`-32600`) with `id: null`
 * - notification (no `id`) → `null` (never a response)
 * - unknown method → `Method not found` (`-32601`)
 * - otherwise the handler's `ok` / `error` result becomes a success / error response
 *
 * @param {Handlers} handlers
 * @returns {(value: Unknown) => Response | null}
 */
export const dispatch = handlers => value => {
    const [t, message] = decodeRequest(value)
    if (t === 'error') {
        return errorResponseOf(null)(invalidRequest)
    }
    const { id, method, params } = message
    if (id === undefined) {
        return null
    }
    // `at`, not `handlers[method]`: `method` is untrusted wire data, and a
    // bracket lookup on a plain object resolves inherited `Object.prototype`
    // names (`constructor`, `toString`, …) to callables.
    const handler = at(method)(handlers)
    if (handler === null) {
        return errorResponseOf(id)(methodNotFound)
    }
    const [t2, result] = handler(params)
    return t2 === 'ok'
        ? successResponseOf(id)(result)
        : errorResponseOf(id)(result)
}
