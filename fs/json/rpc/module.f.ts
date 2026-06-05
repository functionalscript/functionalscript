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
 * @module
 */
import { number, string, unknown, or, option } from '../../types/rtti/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { validate } from '../../types/rtti/validate/module.f.ts'
import type { Result } from '../../types/result/module.f.ts'
import type { Unknown } from '../../djs/module.f.ts'

const jsonrpc = '2.0' as const

/** Request/response identifier: a string, a number, or `null`. */
const idSchema = or(string, number, null)

/**
 * A request or notification envelope. `id` present → request (a response is
 * expected); `id` absent → notification (no response). `params` is optional.
 */
export const request = {
    jsonrpc,
    method: string,
    params: option(unknown),
    id: option(idSchema),
} as const

/** The JSON-RPC error object. */
export const error = {
    code: number,
    message: string,
    data: option(unknown),
} as const

const successResponse = { jsonrpc, result: unknown, id: idSchema } as const
const errorResponse = { jsonrpc, error, id: idSchema } as const

/** A response envelope: exactly one of `result` (success) or `error` (failure). */
export const response = or(successResponse, errorResponse)

export type Id = Ts<typeof idSchema>
export type Request = Ts<typeof request>
export type RpcError = Ts<typeof error>
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

const errorResponseOf = (id: Id) => (e: RpcError): Response =>
    ({ jsonrpc, error: e, id })

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
    const decoded = decodeRequest(value)
    if (decoded[0] === 'error') {
        return errorResponseOf(null)(invalidRequest)
    }
    const message = decoded[1]
    const id = message.id
    if (id === undefined) {
        return null
    }
    const handler: Handler | undefined = handlers[message.method]
    if (handler === undefined) {
        return errorResponseOf(id)(methodNotFound)
    }
    const result = handler(message.params)
    return result[0] === 'ok'
        ? { jsonrpc, result: result[1], id }
        : errorResponseOf(id)(result[1])
}
