import type { Unknown } from '../../media/json/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { id, request, error as errorSchema, response } from './module.f.mjs'
import type { Ts } from '../../types/rtti/ts/types.ts'

export type Id = Ts<typeof id>
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

/** A method implementation: maps `params` to a result or an `RpcError`. */
export type Handler = (params: Unknown | undefined) => Result<Unknown, RpcError>

/** A `method` name → `Handler` map. */
export type Handlers = { readonly [method: string]: Handler }
