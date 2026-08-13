/**
 * JSON-RPC 2.0 envelopes and a pure dispatcher.
 *
 * The envelopes are rtti schemas, so one declaration yields both a runtime
 * decoder (`validate(request)`) and the static type (`Ts<typeof request>`) — no
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
 * @import { Id, RpcError, Handlers, Response } from './types.ts'
 */

import { at } from '../../types/object/module.f.mjs'
import { number, string, or, option } from '../../types/rtti/module.f.mjs'
import { validate } from '../../types/rtti/validate/module.f.mjs'
import { unknown } from '../../media/json/rtti/module.f.mjs'

export const jsonrpc = /** @type {const} */ ('2.0')

/** Request/response identifier: a string, a number, or `null`. */
export const _id = or(string, number, null)

/**
 * A request or notification envelope. `id` present → request (a response is
 * expected); `id` absent → notification (no response). `params` is optional.
 *
 * https://www.jsonrpc.org/specification#request_object
 */
export const request = /** @type {const} */ ({
    jsonrpc,
    method: string,
    params: option(unknown),
    id: option(_id),
})

/** The JSON-RPC error object. */
export const error = /** @type {const} */ ({
    code: number,
    message: string,
    data: option(unknown),
})

export const successResponse = /** @type {const} */ ({ jsonrpc, result: unknown, id: _id })
export const errorResponse = /** @type {const} */ ({ jsonrpc, error, id: _id })

/**
 * A response envelope: either a success (`result`) or an error (`error`).
 * Derived from the rtti schema via `Ts<>` — the same declaration is the
 * runtime decoder and the static type, with no drift. rtti structs are open
 * (extra keys allowed), so "result XOR error" is not enforced at runtime; in
 * practice the dispatcher only ever constructs one or the other.
 *
 * https://www.jsonrpc.org/specification#response_object
 */
export const response = or(successResponse, errorResponse)

/** Decodes an untrusted value as a JSON-RPC request / notification. */
export const decodeRequest = validate(request)

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

/** @type {(id: Id) => (error: RpcError) => Response} */
const errorResponseOf = id => error => ({ jsonrpc, error, id })

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
        ? { jsonrpc, result, id }
        : errorResponseOf(id)(result)
}
