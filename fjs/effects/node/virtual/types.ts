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
import type { StringMap } from '../../../types/object/types.ts'

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
    /**
     * Passed through to the {@link IncomingMessage} `listen` builds — the host's
     * answer about *this* request's response framing, which a fixture states
     * because there is no version or `TE` header here to derive it from. What it
     * decides is gate 3 (`IncomingMessage.chunkedResponse` in
     * [`../types.ts`](../types.ts)).
     */
    readonly chunkedResponse: boolean
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
     *
     * **A chunk the stream refuses is not dropped**, so the head of this stays
     * the chunk a listener's retry meets again. `readChunks` refuses one that is
     * not whole bytes, and dropping it let the retry read the bytes behind it
     * instead ([`./module.f.mjs`](./module.f.mjs), `readRequestBytes`).
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

/**
 * An open file this runner handed out: the identifier a `Handle` carries, what
 * the file holds, and the name that still reaches it.
 *
 * **A handle follows its file, and a name is how it is followed here.** The two
 * halves look alike and are opposites, and a handle owes both:
 *
 * | while a handle is open | the handle reads |
 * | --- | --- |
 * | `rename` puts another file at the name | its own bytes, at its own size |
 * | a write goes through the name | the new bytes, at the new size |
 *
 * Both were measured through a real descriptor — the first on Darwin with Node
 * 26.8.1, the second with Node 23.11.0 — and neither can be had by re-reading
 * the name per read: that answers the second row and gets the first wrong, which
 * is how a response framed by one file's size could carry another file's bytes.
 * So `name` moves the way a host moves an inode. A write through a name copies
 * what the name now holds into every handle under it, `rename` moves the name
 * instead of copying, and `rm` takes it away, leaving `null` — the unlinked file
 * no later write can reach again, which a descriptor on a host goes on reading
 * all the same.
 *
 * **The name is the inode here** because nothing in a {@link Dir} can make two
 * names for one entity: at most one name ever reaches an entity, so which name
 * that is says which entity a write means. It is a path in segments, as
 * `fjs/path`'s `parse` gives it, so that `a.bin` and `./a.bin` are one name.
 *
 * The entity rather than a chunk list, because a directory and a `JsModule` open
 * successfully too and `fstat` has to say what they are. **A directory handle
 * does go stale** — no operation copies a changed directory back into one — and
 * nothing can read the difference: `fstatOp` answers a fixed directory stat and
 * `preadOp` answers `EISDIR`, and neither looks at the entity's contents.
 * Measured the same way, a descriptor on a removed directory still stats as a
 * directory and still reads `EISDIR` after a file has taken its name.
 *
 * @internal
 */
export type _OpenFile = {
    readonly id: number
    readonly entity: _Entity
    /** The name that reaches {@link entity}, or `null` once none does. */
    readonly name: Nullable<readonly string[]>
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
    readonly internet: StringMap<Vec>
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
    /** What went out, oldest first. */
    readonly responses: readonly RecordedResponse[]
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
