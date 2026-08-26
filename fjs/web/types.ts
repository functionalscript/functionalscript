/** Types for the static file server. */

import type { Effect } from '../effects/types.ts'
import type { Forever, Fs, Http, IncomingMessage, ServerResponse, Write } from '../effects/node/types.ts'
import type { Result } from '../types/result/types.ts'

/** Every operation the server performs: the HTTP setup, the reads it answers with, and its one log line. */
export type WebOp = Fs | Http | Forever | Write

/**
 * Why a URL names no path this server will answer with, as the response it
 * earns: `400` for a URL that is malformed or climbs out of the root, `404` for
 * one this server declines to admit exists.
 *
 * Both the status and the sentence are decided here, where the reason is known,
 * rather than at the point that turns the refusal into a frame — which would
 * then have to re-derive from a message string which kind of refusal it was.
 */
export type Refusal = {
    readonly status: number
    readonly message: string
}

/**
 * Maps a request URL to the path of the file that answers it, or says why no
 * path does. Pure — the whole routing decision, with nothing to run.
 *
 * Everything it can fail on is a property of the URL. What is discovered by
 * *reading* — a missing file, one too large to send — is not its business.
 */
export type Resolve = (root: string) => (url: string) => Result<string, Refusal>

/**
 * Answers one request by reading a file under `root`.
 *
 * Effectful but socket-free, which is what makes it provable against the
 * virtual runner's file system: it takes a request frame and returns a response
 * frame, and the sockets on either side belong to `main`.
 *
 * The channel is `never` for the reason {@link ServerResponse} exists — a
 * server that cannot read a file still has a status code to answer with, so
 * every failure becomes a response rather than an error.
 */
export type Respond = (root: string) => (request: IncomingMessage) => Effect<Fs, ServerResponse, never>
