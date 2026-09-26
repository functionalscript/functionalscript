/**
 * Implementation-private types for the Node.js effect runner: the narrowed
 * structural views of `node:http` objects the runner interprets HTTP
 * operations against.
 *
 * @module
 */

import type { StringMap } from '../../types/object/types.ts'
import type { Headers } from './types.ts'

/** The one thing the runner does with the socket a `connect` event hands it. */
export type _Socket = {
    readonly end: (data: string) => void
}

/**
 * `on` is written as a property, like its three siblings here, not as a
 * method-shorthand member — TypeScript has no `readonly` spelling for method
 * shorthand, and every other member of this type is already a property.
 * Under `strictFunctionTypes` a property function type checks its parameter
 * contravariantly where method shorthand stays bivariant, so this is
 * marginally stricter than the method-shorthand form it replaced; nothing in
 * this module hits that difference; the sole call site
 * (`fjs/effects/node/module.mjs`'s `server.on('connect', …)`) matches the
 * signature exactly, and `_Server` values only ever arrive via a cast from
 * Node's real `http.Server`, never as a wider handler passed into this type.
 */
export type _Server = {
    readonly listen: (port: number, host: string) => void
    readonly once: (event: string, f: (e: unknown) => void) => void
    readonly on: (event: string, f: (req: unknown, socket: _Socket) => void) => void
    readonly removeListener: (event: string, f: (e: unknown) => void) => void
}

export type _Readable = AsyncIterable<Uint8Array>

export type _IncomingMessage = _Readable & {
    readonly method: string
    readonly url: string
    readonly headers: Headers
    /**
     * Whether the whole request has arrived and been parsed. The runner reads it
     * once the listener has answered, to decide whether any of the body is still
     * to come — see `answerRequest` in [`./module.mjs`](./module.mjs).
     */
    readonly complete: boolean
}

/**
 * One request body's cursor, as the Node runner holds it: the bytes at `offset`,
 * at most `size` of them, and none once the client has stopped sending.
 *
 * This is what a `RequestBody` handle carries on this runner. A function rather
 * than a record because the position it keeps is the only mutable thing in the
 * whole operation, and a closure is where it can be kept without anything else
 * being able to see it.
 */
export type _RequestBodyReader = (offset: number, size: number) => Promise<Uint8Array>

/**
 * `write` is here because a response body is a chunk list, so the runner offers
 * Node one chunk at a time and then ends. Its `boolean` is Node's own answer —
 * `false` once the response's buffer is full — and the runner does not read it:
 * every chunk is already in memory by then, so there is nothing left for the
 * socket to throttle. A body pulled at the socket's pace is
 * [streaming-http-bodies](./todo/streaming-http-bodies.md)'s pump, and it is the
 * `false` that the pump exists to wait on.
 */
export type _ServerResponse = {
    /**
     * The map is **optional**, and only the runner's own answers pass one: they
     * are the whole of their response's headers, so there is nothing for an
     * order to decide. A listener's headers go through {@link setHeader}
     * instead — see below.
     */
    readonly writeHead: (status: number, headers?: StringMap<string>) => _ServerResponse
    readonly write: (chunk: Uint8Array) => boolean
    readonly end: (body: Uint8Array) => void
    readonly headersSent: boolean
    /**
     * **Every header of a listener's response is set through here**, because the
     * runner adds one of its own — `connection: close`, for a request whose body
     * has not all arrived — and a header passed to `writeHead` wins over one set
     * here. Passing the listener's map there put it last, so a listener
     * answering `connection: keep-alive` cancelled the close and kept the socket
     * held for a body nobody would read. Set one at a time, the runner's close
     * goes last and wins; Node keys pending headers by the lower-cased name, so
     * it replaces whichever spelling the listener used, and nothing else the
     * listener asked for is touched.
     */
    readonly setHeader: (name: string, value: string) => void
}

export type _RequestListener = (req: _IncomingMessage, res: _ServerResponse) => Promise<void>
