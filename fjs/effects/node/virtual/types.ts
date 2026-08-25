/**
 * Types for the virtual Node-effect operations used by filesystem and
 * process tests.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
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
 * The listener a virtual `Server` handle carries, at the operation set this
 * runner can actually run it with. `CreateServer` declares its listener over
 * `Operation` — an unresolved type parameter would leak into every consumer of
 * `Server` — so the handler narrows it, exactly as the Node runner does before
 * handing a request to it. It rides in the handle rather than in the state, so
 * that two servers in one program are two servers here too.
 *
 * @internal
 */
export type _VirtualListener = (request: IncomingMessage) => Effect<NodeOp, ServerResponse, never>

/**
 * What a virtual `Server` handle carries.
 *
 * It is a record rather than the listener itself so that each `createServer`
 * gets its own identity: on a host, creating two servers from one listener
 * gives two servers, and a handle that *was* the listener would make them the
 * same one — which `listen` would then read as the same server listening twice.
 *
 * @internal
 */
export type _VirtualServer = {
    readonly listener: _VirtualListener
}

/**
 * A server that is listening, and the address it took.
 *
 * The *server* is what is recorded, not its listener: two servers built from one
 * listener are two servers, and only the second `listen` on the same **server**
 * is the one Node refuses as already listening.
 *
 * @internal
 */
export type _Binding = {
    /**
     * `host:port`, with the host lower-cased — a name is case-insensitive, and
     * so is the hexadecimal of an IPv6 literal, so `LOCALHOST` and `localhost`
     * are one address here as they are on a host.
     */
    readonly address: string
    readonly server: _VirtualServer
}

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
    /**
     * What is listening, oldest first. An address appears once: a second
     * `listen` on one that is taken fails, as it does on a host.
     */
    listening: readonly _Binding[]
    /**
     * The requests a fixture queues for the server to answer. `listen` delivers
     * every one of them to the {@link _VirtualListener} its handle carries, and
     * empties the queue — the virtual counterpart of accepting connections.
     */
    requests: readonly IncomingMessage[]
    /** What the listener answered, oldest first. */
    responses: readonly ServerResponse[]
}
