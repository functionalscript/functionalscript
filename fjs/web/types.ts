/**
 * Types for the static file server.
 *
 * @module
 */

import type { Effect } from '../effects/types.ts'
import type { Forever, Fs, Http, IncomingMessage, ServerResponse, Write } from '../effects/node/types.ts'
import type { Result } from '../types/result/types.ts'

/** Every operation the server performs: the HTTP setup, the reads it answers with, and its one log line. */
export type WebOp = Fs | Http | Forever | Write

/**
 * Maps a request URL to the path of the file that answers it, or says why no
 * path does. Pure — the whole routing decision, with nothing to run.
 *
 * The error is the sentence a `400` carries. It is the only way this can fail:
 * a URL either names a path under the root or it is malformed, and everything
 * else — a missing file, one too large to send — is discovered by reading, not
 * by resolving.
 */
export type Resolve = (root: string) => (url: string) => Result<string, string>

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
