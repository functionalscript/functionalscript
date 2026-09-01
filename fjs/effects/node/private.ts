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

export type _ServerResponse = {
    readonly writeHead: (status: number, headers: StringMap<string>) => _ServerResponse
    readonly end: (body: Uint8Array) => void
    readonly headersSent: boolean
}

export type _RequestListener = (req: _IncomingMessage, res: _ServerResponse) => Promise<void>
