/**
 * Types for the virtual Node-effect operations used by filesystem and
 * process tests.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Effect, IoChannel } from '../../types.ts'
import type { Headers, IncomingMessage, Module, NodeOp, ServerResponse } from '../types.ts'
import type { MemoryState } from '../../memory/types.ts'
import type { Nullable } from '../../../types/nullable/types.ts'

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
export type _VirtualListener = (request: IncomingMessage) => Effect<NodeOp, ServerResponse<NodeOp>, never>

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

/**
 * An open file this runner handed out: the identifier a `Handle` carries, and
 * **what the name held at the moment it was opened**.
 *
 * That snapshot is the whole of what a handle is for. A `Dir` entry can be
 * replaced while a program runs — `rename` does it, and a fixture that pulls a
 * body one cell at a time can do it between two pulls — so a reader that went
 * back to the *name* per chunk would answer an old prefix joined to a new suffix.
 * Reads through a handle come from the entity recorded here, which is the same
 * thing a descriptor gives on a host: measured on Darwin with Node 26.8.1, a file
 * renamed over the name a handle was opened on is still read as the bytes the
 * handle opened.
 *
 * The entity rather than a chunk list, because a directory and a `JsModule` open
 * successfully too and `fstat` has to say what they are.
 *
 * @internal
 */
export type _OpenFile = {
    readonly id: number
    readonly entity: _Entity
}

/**
 * What went out, as the pump left it.
 *
 * `readonly Vec[]` is the shape a `Dir` already stores a file in
 * ({@link _Entity}), so a fixture and a recorded response read alike.
 *
 * `failure` is what a proof asserting a whole body needs and a bare chunk array
 * cannot give: a body that stopped and one that finished hold the same chunks up
 * to the point they differ. It widens past {@link IoChannel} because two of the
 * three ways a response ends early are the *runner's* refusals rather than the
 * producer's failures — the cell was fine, and a proof that could not tell those
 * destroys from a clean end could not assert the count at all.
 */
export type RecordedResponse = {
    readonly status: number
    readonly headers: Headers
    readonly body: readonly Vec[]
    /**
     * What made this response incomplete, or `null` for one a client reads as
     * whole.
     */
    readonly failure: Nullable<IoChannel | Overrun | Underrun>
}

/**
 * A cell that would have carried the body past its declared length. None of that
 * chunk is recorded: a body exactly as long as it promised is a body every client
 * reads as whole, so the runner leaves it **short** over a socket no client can
 * read a whole body from rather than cutting the chunk to fit. The number is the
 * length that was declared.
 */
export type Overrun = readonly['overrun', number]

/**
 * A body that ended before the length it declared, which nothing on a host's
 * server side notices: `res.end()` raises nothing and the socket goes back into
 * the keep-alive pool, so what tells the client is the idle timeout — or, for a
 * pipelined connection, the next response's status line read as the tail of this
 * body. The record states it rather than a proof deriving it, because the
 * subtraction is wrong exactly where it would matter: a `HEAD` or a `304` declares
 * a length and records an empty body, and a proof comparing the two would fail the
 * responses the gates were written to let through. The number is the declared
 * length again.
 */
export type Underrun = readonly['underrun', number]

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
    readonly requests: readonly IncomingMessage[]
    /** What went out, oldest first. */
    readonly responses: readonly RecordedResponse[]
    /**
     * The files that are open, in the order they were opened.
     *
     * **A proof reads this to fail a leak.** A held handle is the one thing in
     * `Fs` that outlives the operation that produced it, so a program that drops
     * one leaks a descriptor — and a leak per request is descriptor exhaustion
     * rather than something to notice later. The list being empty once a request
     * is over is the assertion; nothing else reports it, and nothing needs to.
     */
    readonly handles: readonly _OpenFile[]
    /** The identifier the next {@link _OpenFile} takes; starts at 0. */
    readonly handleNext: number
}
