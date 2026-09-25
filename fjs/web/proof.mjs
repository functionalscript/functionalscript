/**
 * Host proofs of `fjs web`: what only a real socket and a real file can settle.
 *
 * The response frame is proven against the virtual runner in
 * [`./proof.f.mjs`](./proof.f.mjs) — request in, response out, every status the
 * table promises. What is left here is the one claim a fixture cannot make: that a
 * file far larger than the process should hold is served **correctly** and
 * **without being held**, which needs a file on a disk and a client at the other
 * end of a socket.
 *
 * @import { NodeProgram, NodeOp } from '../effects/node/types.ts'
 */

import http from 'node:http'
import net from 'node:net'
import process from 'node:process'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assert, assertEq } from '../asserts/module.f.mjs'
import { createServer, listen } from '../effects/node/module.f.mjs'
import { runEffect } from '../effects/node/module.mjs'
import { resultMapStep, step } from '../effects/module.f.mjs'
import { asBase } from '../types/nominal/module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'
import { respond } from './module.f.mjs'

/** The address this binds, for the reason `Listen` takes one. */
const loopback = '127.0.0.1'

/**
 * How large the file the digest is taken over is: sixty-four times the
 * 131,072-byte ceiling this server used to refuse at, and several times what a
 * parked pump was measured holding
 * ([`../effects/node/proof.mjs`](../effects/node/proof.mjs), `createServer`).
 *
 * **It is not larger because a `Vec` is a `bigint`.** Converting 128 KiB of bytes
 * into one and back out again costs tens of milliseconds a chunk — measured at
 * about 320 ms for sixteen conversions on Darwin with Node 26.8.1 — so a body's
 * size is the dominant cost of reading it whole, and a proof that read a hundred
 * megabytes would spend a minute of the suite's time on the representation rather
 * than on the pump. The **bound** is the claim that wants a vast file, and
 * {@link vast} below is vast precisely because nothing ever reads it.
 */
const served = 8 * 1024 * 1024

/**
 * The file the footprint is measured against: a hundred and twenty-eight
 * mebibytes, a thousand times the old ceiling.
 *
 * It costs nothing to make — `truncate` leaves a hole rather than writing zeroes —
 * and nothing to serve, because the client never reads it and so the pump never
 * pulls past the socket's buffers. That asymmetry *is* the property: a route that
 * had the file in hand before the status went out could not have this proof at all.
 */
const vast = 128 * 1024 * 1024

/** The slice the fixture is written in. */
const slice = 1024 * 1024

/**
 * An order-sensitive digest, so that a body which arrives complete but **out of
 * order** — or with one window read twice — fails here.
 *
 * A byte sum would not: the bytes of a spliced or reordered body sum the same as
 * the bytes of the right one, and a proof over a sum would pass on the defect the
 * handle route exists to prevent. This is the ordinary polynomial rolling hash,
 * kept in 32 bits by `Math.imul`.
 *
 * Indexed rather than `for…of`: iterating a typed array through its iterator cost
 * six times as much on the same host, and this runs over every byte twice.
 *
 * @type {(h: number, bytes: Uint8Array) => number}
 */
const digest = (h, bytes) => {
    let acc = h
    for (let i = 0; i < bytes.length; i += 1) { acc = Math.imul(acc, 31) + bytes[i] | 0 }
    return acc
}

/**
 * Writes the fixture and answers its digest, holding one slice at a time — the
 * proof may not spend the memory it is about to claim the server does not.
 *
 * The pattern steps by a prime, so no two windows of it are alike: a body joined
 * out of order, or one window short, changes the digest.
 *
 * @type {(path: string) => Promise<number>}
 */
const writeFixture = async path => {
    const fh = await open(path, 'w')
    try {
        const bytes = Uint8Array.from({ length: slice }, (_, i) => i % 251)
        let h = 0
        for (let written = 0; written < served; written += slice) {
            // Every slice is the same pattern, and its *offset* is what the digest
            // distinguishes: a window read twice lands the same bytes at the wrong
            // place in the polynomial.
            await fh.write(bytes)
            h = digest(h, bytes)
        }
        return h
    } finally {
        await fh.close()
    }
}

/**
 * Serves `root` behind a real socket and hands `client` the port, closing the
 * server afterwards whatever the client did.
 *
 * The server handle is taken out of the program and unwrapped to Node's own
 * object, because no operation closes a server — the same reach-through
 * [`../effects/node/proof.mjs`](../effects/node/proof.mjs) performs, and the
 * reason this file is not a `.f.mjs`.
 *
 * @template T
 * @param {string} root
 * @param {(port: number) => Promise<T>} client
 * @returns {Promise<T>}
 */
const withServer = async (root, client) => {
    /** @type {(server: import('node:http').Server) => void} */
    let created = () => { }
    /** @type {Promise<import('node:http').Server>} */
    const held = new Promise(resolve => { created = resolve })
    /** @type {NodeProgram} */
    const program = () => resultMapStep(
        step(
            createServer(respond(root)),
            server => {
                created(/** @type {import('node:http').Server} */ (asBase(server)))
                return listen(server, 0, loopback)
            }),
        r => r[0] === 'ok' ? ok(0) : error(1))
    assertEq(await runEffect(program), 0)
    const server = await held
    try {
        const address = server.address()
        assert(address !== null && typeof address !== 'string', address)
        return await client(address.port)
    } finally {
        server.closeAllConnections()
        await new Promise(resolve => { server.close(() => resolve(undefined)) })
    }
}

/**
 * A temporary directory holding one file of {@link served} bytes, removed even
 * when an assertion fails.
 *
 * @type {(check: (root: string, name: string, expected: number) => Promise<void>) => Promise<void>}
 */
const withLargeFile = async check => {
    const root = await mkdtemp(join(tmpdir(), 'fjs-web-large-'))
    try {
        const name = 'large.bin'
        await check(root, name, await writeFixture(join(root, name)))
    } finally {
        await rm(root, { recursive: true, force: true })
    }
}

/**
 * The same, for a file of {@link vast} bytes that nothing reads: a hole rather
 * than a hundred and twenty-eight mebibytes of zeroes.
 *
 * @type {(check: (root: string, name: string) => Promise<void>) => Promise<void>}
 */
const withVastFile = async check => {
    const root = await mkdtemp(join(tmpdir(), 'fjs-web-vast-'))
    try {
        const name = 'vast.bin'
        const fh = await open(join(root, name), 'w')
        try { await fh.truncate(vast) } finally { await fh.close() }
        await check(root, name)
    } finally {
        await rm(root, { recursive: true, force: true })
    }
}

/** Fails rather than hangs — see `within` in `../effects/node/proof.mjs`.
 *
 * @template T
 * @param {string} label
 * @param {number} ms
 * @param {Promise<T>} p
 * @returns {Promise<T>}
 */
const within = async (label, ms, p) => {
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

export const proof = {
    // A file five hundred times the size this server used to refuse at, served
    // whole — byte for byte and in order, which the digest is what checks. The
    // client holds one slice at a time, as the server does.
    servesAFileLargerThanItHolds: () => withLargeFile(async (root, name, expected) => {
        const answer = await withServer(root, port => within(
            `a ${served}-byte body`,
            120000,
            /** @type {Promise<{ readonly status: number, readonly length: string, readonly count: number, readonly digest: number, readonly parts: number }>} */
            (new Promise((resolve, reject) => {
                const request = http.request({ host: loopback, port, path: `/${name}` }, response => {
                    let count = 0
                    let h = 0
                    let parts = 0
                    response.on('data', part => {
                        count += part.length
                        parts += 1
                        h = digest(h, part)
                    })
                    response.on('end', () => resolve({
                        status: response.statusCode ?? 0,
                        length: `${response.headers['content-length']}`,
                        count,
                        digest: h,
                        parts,
                    }))
                    response.on('error', reject)
                })
                request.on('error', reject)
                request.end()
            }))))
        assertEq(answer.status, 200)
        // Declared from the `fstat` of the handle the body is read through, and the
        // reads are bounded by that same number — so the header and the bytes are
        // one measurement rather than a promise and a hope.
        assertEq(answer.length, `${served}`)
        assertEq(answer.count, served)
        assertEq(answer.digest, expected)
        // It arrived as a stream and not as one write, which is what a body pulled
        // at the socket's pace looks like from the other end.
        assert(answer.parts > 50, answer.parts)
    }),
    // **And it is served without being held.** A hundred and twenty-eight
    // mebibytes — a thousand times the ceiling this server used to refuse at — and
    // a client that asks and then reads nothing, so nothing can drain the
    // response. A route that had every chunk in hand before the status went out
    // would have the whole file resident by now; this one is parked on the
    // socket's buffers.
    //
    // `arrayBuffers` is where a `Buffer` lives, so it is the figure to read rather
    // than `heapUsed`. It is a **coarse** measurement — it counts the socket's own
    // queue and whatever the collector has not yet taken — so the threshold is a
    // sixteenth of the file and the claim is only that the footprint is nothing
    // like it. The exact bound is the pull count in
    // [`../effects/node/proof.mjs`](../effects/node/proof.mjs)
    // (`createServer.pullsAtTheSocketsPace`), where ten times the body is not ten
    // times the memory.
    holdsNothingLikeTheFile: () => withVastFile(async (root, name) => {
        const before = process.memoryUsage().arrayBuffers
        const held = await withServer(root, port => within(
            'a parked pump on a vast file',
            60000,
            new Promise(resolve => {
                const socket = net.connect(port, loopback, () => {
                    socket.write(`GET /${name} HTTP/1.1\r\nHost: ${loopback}\r\n\r\n`)
                })
                socket.pause()
                socket.on('error', () => { })
                setTimeout(() => {
                    const grew = process.memoryUsage().arrayBuffers - before
                    socket.destroy()
                    resolve(grew)
                }, 900)
            })))
        assert(held < vast / 16, [held, vast])
    }),
}
