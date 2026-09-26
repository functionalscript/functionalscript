/**
 * Types for the virtual Node-effect operations used by filesystem and
 * process tests.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Effect } from '../../types.ts'
import type { Headers, IncomingMessage, Module, NodeOp, ServerResponse } from '../types.ts'
import type { MemoryState } from '../../memory/types.ts'

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
 * A request as a fixture queues it: the head, and the body as the chunks a
 * client sends.
 *
 * **This is not an {@link IncomingMessage}, and the difference is the body.** A
 * listener receives its body as a `List` it pulls from — a stream over a socket
 * the runner holds — and a fixture has no socket and nothing to pull from. What
 * a fixture states is what *arrives*: `readonly Vec[]`, which is also the shape
 * a {@link Dir} stores a file in ({@link _Entity}), so a file fixture can be
 * posted as a body without being reshaped. `listen` is what turns one of these
 * into the request the listener sees.
 *
 * Chunks rather than one `Vec` because the chunk boundaries are part of what a
 * fixture is describing: a body arriving in many small pieces and a body
 * arriving in one are different inputs to a listener's fold, and only the first
 * of them catches a fold that drops all but its last chunk.
 *
 * @internal
 */
export type _QueuedRequest = {
    readonly method: string
    readonly url: string
    readonly headers: Headers
    readonly body: readonly Vec[]
}

/**
 * How far one delivered request's body has been read.
 *
 * `rest` shrinks by a chunk per pull and `offset` grows by that chunk's bytes,
 * so between them they say both what is left to hand out and where the next pull
 * must claim to be. The position is in the state rather than behind the handle
 * because this runner is pure: a `RequestBody` handle carries nothing but which
 * of these it is, and the reading is a state transition like every other.
 *
 * **A proof reads it to ask what the listener did.** A body the listener never
 * touched is a `rest` as long as the fixture's and an `offset` of nought; one it
 * read to the end is an empty `rest`. That is how a listener answering without
 * reading its body is observable here, where on a host it is observable as the
 * connection the runner closes — there being no socket to close.
 *
 * @internal
 */
export type _RequestBodyCursor = {
    /**
     * The chunks not yet handed out, oldest first. A fixture chunk of no bytes
     * is never handed out — a pull steps over it, and drops it from here with
     * the pull that did, so nothing left here is waiting to be read.
     */
    readonly rest: readonly Vec[]
    /** The byte offset the next pull must name. */
    readonly offset: number
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
    readonly stdout: string
    readonly stderr: string
    /** Remaining stdin bytes; each `read` pops the first, `null` at EOF. */
    readonly stdin: readonly number[]
    readonly root: Dir
    readonly internet: {
        readonly[url: string]: Vec
    }
    readonly epochNs: number
    /** The slots of `memCreate`, kept by `../../memory`'s interpreter. */
    readonly memory: MemoryState
    /** Monotonically increasing counter returned by `randomInt`; starts at 0. */
    readonly randomNext: number
    /**
     * What is listening, oldest first. An address appears once: a second
     * `listen` on one that is taken fails, as it does on a host.
     */
    readonly listening: readonly _Binding[]
    /**
     * The requests a fixture queues for the server to answer. `listen` delivers
     * every one of them to the {@link _VirtualListener} its handle carries, and
     * empties the queue — the virtual counterpart of accepting connections.
     */
    readonly requests: readonly _QueuedRequest[]
    /** What the listener answered, oldest first. */
    readonly responses: readonly ServerResponse[]
    /**
     * One cursor per request `listen` has delivered, in delivery order — the
     * bodies, as far as the listeners read them.
     *
     * It is not emptied with {@link requests}: what a listener did with the body
     * it was handed is the record a proof reads afterwards, and a `listen` that
     * cleared it would take that away. A `RequestBody` handle is an index into
     * it.
     */
    readonly bodies: readonly _RequestBodyCursor[]
}
