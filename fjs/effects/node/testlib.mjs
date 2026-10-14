/**
 * Scaffolding shared by the host proofs that drive the Node runner against the
 * real host: [`./proof.mjs`](./proof.mjs), [`../../web/proof.mjs`](../../web/proof.mjs)
 * and the filesystem proofs beside them. A deadline, a server behind a real
 * socket, a temporary directory, and which runtime is running the proof.
 *
 * Impure, and so not a `.f.mjs`: each helper awaits the host, and
 * {@link withServer} reaches through a `NodeProgram` to the `http.Server` it
 * created. The production runner does not depend on this file.
 *
 * @module
 *
 * @import { NodeProgram, NodeOp, RequestListener, Server } from './types.ts'
 * @import { Server as HostServer } from 'node:http'
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { resultMapStep, step } from '../module.f.mjs'
import { asBase } from '../../types/nominal/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { createServer, listen } from './module.f.mjs'
import { isBun, runEffect } from './module.mjs'

export { isBun }

/**
 * Whether this run is Node itself, for the proofs whose claim is what Node
 * does: they bind a real socket and read what Node does with a body it was
 * given. Bun and Deno answer the same operations through their own
 * `node:http`, which is a separate claim and not this runner's.
 *
 * @type {() => boolean}
 */
export const isNode = () => !isBun && !('Deno' in globalThis)

/**
 * A unique temporary directory for one proof, removed even when writing a
 * fixture, importing it or an assertion fails. Nothing a proof leaves behind
 * reaches the repository, its npm declarations or Cloudflare's asset manifest.
 *
 * @type {(prefix: string, check: (root: string) => Promise<void>) => Promise<void>}
 */
export const withTemporary = async (prefix, check) => {
    const temporary = await mkdtemp(join(tmpdir(), prefix))
    try {
        await check(temporary)
    } finally {
        await rm(temporary, { recursive: true, force: true })
    }
}

/** The address {@link withServer} binds, for the reason `Listen` takes one. */
export const loopback = '127.0.0.1'

/**
 * Fails rather than hangs.
 *
 * The proofs that use this are about a pump or a socket, and the failure mode
 * either has is *not finishing*: a park nothing releases, a body nobody pulls,
 * a socket that never closes. A proof that waited for such a thing would stop
 * the whole suite with no verdict, which is the one outcome worse than a red
 * one. So each of them runs inside a deadline that rejects, and the message
 * says which wait it was.
 *
 * @template T
 * @param {string} label
 * @param {number} ms
 * @param {Promise<T>} p
 * @returns {Promise<T>}
 */
export const within = async (label, ms, p) => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer
    try {
        return await Promise.race([
            p,
            /** @type {Promise<never>} */ (new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${label}: nothing happened within ${ms} ms`)), ms)
            })),
        ])
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Runs `listener` behind a real socket, hands `client` the port it bound, and
 * closes the server afterwards whatever the client did.
 *
 * **The server is closed by this function and not by the program**, because
 * there is no operation that closes one: a `NodeProgram` answers an exit code,
 * so the handle is taken out of it here and unwrapped to the `http.Server`
 * underneath. That reach-through is why the proofs using this live in the
 * impure shell beside the runner rather than in a `.f.mjs`.
 *
 * Port `0` asks the host for a free one — a fixed port makes a proof fail when
 * something else on the machine happens to hold it. `fjs web` refusing `0` is
 * its own command-line policy and not this operation's.
 *
 * Connections are destroyed before the close, since half of the runner's
 * proofs leave a keep-alive socket open on purpose and `server.close` waits for
 * the last one.
 *
 * `client` is handed the `Server` the program created, not the host's object:
 * a declaration this package publishes names no `node:` type, because its
 * consumers need not have Node's. A client that observes the host server
 * unwraps it with `asBase`, as this function does.
 *
 * @template T
 * @param {RequestListener<NodeOp>} listener
 * @param {(port: number, server: Server) => Promise<T>} client
 * @returns {Promise<T>}
 */
export const withServer = async (listener, client) => {
    /** @type {(server: Server) => void} */
    let created = () => { }
    /** @type {Promise<Server>} */
    const held = new Promise(resolve => { created = resolve })
    /** @type {NodeProgram} */
    const program = () => resultMapStep(
        step(
            createServer(listener),
            server => {
                created(server)
                return listen(server, 0, loopback)
            }),
        r => r[0] === 'ok' ? ok(0) : error(1))
    assertEq(await runEffect(program), 0)
    const server = await held
    // The boundary the runner itself crosses the same way: a `Server` is a
    // `Nominal` over the host's own object, and `asBase` is how the runner
    // reads it back.
    const host = /** @type {HostServer} */ (asBase(server))
    try {
        const address = host.address()
        assert(address !== null && typeof address !== 'string', address)
        return await client(address.port, server)
    } finally {
        host.closeAllConnections()
        await new Promise(resolve => { host.close(() => resolve(undefined)) })
    }
}
