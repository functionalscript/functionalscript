/**
 * Implementation-private types for the Node.js effect runner: the narrowed
 * structural views of `node:http` objects the runner interprets HTTP
 * operations against.
 */

import type { StringMap } from '../../types/object/types.ts'
import type { Headers } from './types.ts'

/** The one thing the runner does with the socket a `connect` event hands it. */
export type _Socket = {
    readonly end: (data: string) => void
}

export type _Server = {
    readonly listen: (port: number, host: string) => void
    readonly once: (event: string, f: (e: unknown) => void) => void
    on(event: string, f: (req: unknown, socket: _Socket) => void): void
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
