/**
 * JSON-RPC 2.0 envelopes and a pure dispatcher.
 *
 * The envelopes are rtti schemas, so one declaration yields both a runtime
 * decoder (`validate(request)`) and the static type (`Ts<typeof request>`) — no
 * drift between them. The dispatcher is pure: it maps an already-parsed request
 * value to a response value (or `null` for a notification) and performs no I/O.
 *
 * Out of scope here (follow-ups): transports — stdio / HTTP framing — over
 * `fs/effects/node`, and concrete method sets such as MCP (i665-mcp), which layer
 * on top of `dispatch`.
 *
 * https://www.jsonrpc.org/specification
 *
 * @module
 */
import { number, string, or, option } from '../../../types/rtti/module.f.ts'
import type { Ts } from '../../../types/rtti/ts/module.f.ts'
import { validate } from '../../../types/rtti/validate/module.f.ts'
import type { Result } from '../../../types/result/module.f.ts'
import { unknown, type Unknown } from '../module.f.ts'

export const jsonrpc = '2.0' as const

/** Request/response identifier: a string, a number, or `null`. */
const id = or(string, number, null)

/**
 * A request or notification envelope. `id` present → request (a response is
 * expected); `id` absent → notification (no response). `params` is optional.
 *
 * https://www.jsonrpc.org/specification#request_object
 */
export const request = {
    jsonrpc,
    method: string,
    params: option(unknown),
    id: option(id),
} as const

/** The JSON-RPC error object. */
export const error = {
    code: number,
    message: string,
    data: option(unknown),
} as const

export type Id = Ts<typeof id>
export type Request = Ts<typeof request>
export type RpcError = Ts<typeof error>

export const successResponse = { jsonrpc, result: unknown, id } as const
export const errorResponse = { jsonrpc, error, id } as const

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
export type Response = Ts<typeof response>

/** Decodes an untrusted value as a JSON-RPC request / notification. */
export const decodeRequest = validate(request)

/** A method implementation: maps `params` to a result or an `RpcError`. */
export type Handler = (params: Unknown | undefined) => Result<Unknown, RpcError>

/** A `method` name → `Handler` map. */
export type Handlers = { readonly [method: string]: Handler }

/** Builds an `RpcError` with the given `code` and `message` (no `data`). */
export const rpcError = (code: number) => (message: string): RpcError =>
    ({ code, message })

// The standard JSON-RPC 2.0 errors.
export const parseError = rpcError(-32700)('Parse error')
export const invalidRequest = rpcError(-32600)('Invalid Request')
export const methodNotFound = rpcError(-32601)('Method not found')
export const invalidParams = rpcError(-32602)('Invalid params')
export const internalError = rpcError(-32603)('Internal error')

const errorResponseOf = (id: Id) => (error: RpcError): Response =>
    ({ jsonrpc, error, id })

/**
 * Dispatches an already-parsed JSON-RPC value against `handlers`.
 *
 * - invalid envelope → `Invalid Request` (`-32600`) with `id: null`
 * - notification (no `id`) → `null` (never a response)
 * - unknown method → `Method not found` (`-32601`)
 * - otherwise the handler's `ok` / `error` result becomes a success / error response
 */
export const dispatch =
    (handlers: Handlers) =>
    (value: Unknown): Response | null =>
{
    const [t, message] = decodeRequest(value)
    if (t === 'error') {
        return errorResponseOf(null)(invalidRequest)
    }
    const { id, method, params } = message
    if (id === undefined) {
        return null
    }
    const handler: Handler | undefined = handlers[method]
    if (handler === undefined) {
        return errorResponseOf(id)(methodNotFound)
    }
    const [t2, result] = handler(params)
    return t2 === 'ok'
        ? { jsonrpc, result, id }
        : errorResponseOf(id)(result)
}
