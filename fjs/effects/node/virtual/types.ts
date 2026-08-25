/**
 * Types for the virtual Node-effect operations used by filesystem and
 * process tests.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Nullable } from '../../../types/nullable/types.ts'
import type { Effect } from '../../types.ts'
import type { IncomingMessage, Module, NodeOp, ServerResponse } from '../types.ts'

/**
 * In-memory JS module entry. When `import_` is called on the path, the
 * function is invoked and its return value is the module value (with a
 * `default` export and optional named exports). Using a function (not a
 * plain value) lets the entry be distinguished from `Vec`/`Dir` at runtime
 * via `typeof === 'function'`, and lets the fixture compute the module on
 * each import for closures/state.
 */
export type JsModule = () => Module

/** @internal */
export type _Entity = readonly Vec[] | Dir | JsModule

export type Dir = {
    readonly[name in string]?: _Entity
}

/**
 * The listener a virtual `createServer` stored, at the operation set this
 * runner can actually run it with. `CreateServer` declares its listener over
 * `Operation` — an unresolved type parameter would leak into every consumer of
 * `Server` — so the handler narrows it here, exactly as the Node runner does
 * before handing a request to it.
 *
 * @internal
 */
export type _VirtualListener = (request: IncomingMessage) => Effect<NodeOp, ServerResponse, never>

export type State = {
    stdout: string
    stderr: string
    /** Remaining stdin bytes; each `read` pops the first, `null` at EOF. */
    stdin: readonly number[]
    root: Dir
    internet: {
        readonly[url: string]: Vec
    }
    epochNs: number
    memoryNext: number
    memoryValues: { readonly [key: string]: unknown }
    /** Monotonically increasing counter returned by `randomInt`; starts at 0. */
    randomNext: number
    /** The listener `createServer` stored; `null` until a program creates one. */
    server: Nullable<_VirtualListener>
    /** The port `listen` was called with; `null` until then. */
    port: Nullable<number>
    /**
     * The requests a fixture queues for the server to answer. `listen` delivers
     * every one of them to {@link _VirtualListener} and empties the queue — the
     * virtual counterpart of accepting connections.
     */
    requests: readonly IncomingMessage[]
    /** What the listener answered, oldest first. */
    responses: readonly ServerResponse[]
}
