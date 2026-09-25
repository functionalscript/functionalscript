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
}

/**
 * What the runner does with a response, which is now a pump rather than a write.
 *
 * `write`'s `boolean` is Node's own answer — `false` once the response's buffer is
 * full — and the pump reads it, because that answer is the only memory bound a
 * lazy body has: a pump that pulls anyway is throttled by the disk rather than by
 * the client, and one slow client is enough to spend the whole streaming benefit.
 * `false` parks the pull on `drain`.
 *
 * `destroy` is what a body that failed *after* the headers went out is owed.
 * `res.end()` on a chunked response writes the terminating chunk, so a truncated
 * body arrives as a clean, complete one and no client can tell — measured, with
 * `res.complete` `true` and no error raised. Destroying leaves the client an
 * `ECONNRESET` instead.
 *
 * `on`/`removeListener` carry the `close` event and the `drain` event, and the
 * runner records the first of those once, before the listener is called: a client
 * that hangs up before the pump exists would otherwise close a response nothing is
 * watching, and `close` does not come twice.
 *
 * **`res.closed` is deliberately absent from this view**, though Node has it.
 * Measured on Darwin against a client that hung up while the handler was still
 * running, `res.closed` read `true` on Node 26.8.1 and on Bun 1.4.2 and
 * `undefined` on Deno 2.8.3 — while the `close` *event* fired within three
 * milliseconds of the same moment on all three. Recording the event is what the
 * design asks for anyway, and it is also the property every runtime agrees on.
 *
 * `useChunkedEncodingByDefault` is Node's own answer to whether an unsized body
 * will be framed chunked for this request — the request's version and its `TE`
 * header, decided in `ServerResponse`'s constructor — and it is readable before
 * `writeHead`, which is what makes gate 3 a refusal rather than a discovery.
 * `res.chunkedEncoding` is the value that is right in every row of that table, and
 * it is set by `writeHead`: after that call `headersSent` is `true` and there is no
 * `500` left to send, so the flag is read instead and the listener is forbidden a
 * `Transfer-Encoding` of its own.
 */
export type _ServerResponse = {
    readonly writeHead: (status: number, headers: StringMap<string>) => _ServerResponse
    readonly write: (chunk: Uint8Array) => boolean
    readonly end: (body: Uint8Array) => void
    readonly destroy: () => void
    readonly on: (event: string, f: () => void) => void
    readonly removeListener: (event: string, f: () => void) => void
    readonly headersSent: boolean
    readonly useChunkedEncodingByDefault: boolean
}

export type _RequestListener = (req: _IncomingMessage, res: _ServerResponse) => Promise<void>

/**
 * That the client has gone, recorded once — see `recordClose` in
 * [`./module.mjs`](./module.mjs) for why it is a value and not an edge.
 *
 * Both fields are mutable, which is what a record of an event that has already
 * happened is: this lives in the impure shell, never leaves the one request it
 * belongs to, and is the reason `close` arriving before the pump exists is the
 * same case as `close` arriving during it rather than a second policy beside it.
 */
export type _CloseRecord = {
    closed: boolean
    /** Each parked pull, as the one function that both `drain` and `close` call. */
    readonly waiting: Set<() => void>
}
