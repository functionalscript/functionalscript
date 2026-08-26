/**
 * Type-level API for `fjs/protocol/json_rpc/module.f.mjs`: `Id`, `Request`,
 * `RpcError`, and `Response`, derived from the module's own rtti schemas,
 * plus the `Handler` / `Handlers` shapes a dispatcher is built from.
 *
 * @module
 */

import type { Unknown } from '../../media/json/types.ts'
import type { Result } from '../../types/result/types.ts'
import type {
    _id, request, error as errorSchema, response, successResponse, errorResponse,
} from './module.f.mjs'
import type { Ts } from '../../types/rtti/ts/types.ts'

export type Id = Ts<typeof _id>
export type Request = Ts<typeof request>
export type RpcError = Ts<typeof errorSchema>

/**
 * A response envelope: either a success (`result`) or an error (`error`).
 * Derived from the rtti schema via `Ts<>` — the same declaration is the
 * runtime decoder and the static type, with no drift. rtti structs are open
 * (extra keys allowed), so "result XOR error" is not enforced at runtime; in
 * practice the dispatcher only ever constructs one or the other.
 *
 * https://www.jsonrpc.org/specification#response_object
 */
export type Response = Ts<typeof response>

/**
 * The success branch of {@link Response}: `result` is present, `error` is not.
 *
 * `successResponseOf` answers the `Response` union, not this — every consumer
 * in the tree is a dispatcher that returns either arm. Name this where a
 * caller genuinely holds one branch and wants `.result` without an `in` check.
 */
export type SuccessResponse = Ts<typeof successResponse>

/** The error branch of {@link Response}, the mirror of {@link SuccessResponse}. */
export type ErrorResponse = Ts<typeof errorResponse>

/** A method implementation: maps `params` to a result or an `RpcError`. */
export type Handler = (params: Unknown | undefined) => Result<Unknown, RpcError>

/** A `method` name → `Handler` map. */
export type Handlers = { readonly [method: string]: Handler }
