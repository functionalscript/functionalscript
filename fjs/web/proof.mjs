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
 * The file the two byte-for-byte proofs read: sixteen 131,072-byte chunks and a
 * short seventeenth.
 *
 * **Many chunks is the claim here, not many bytes.** Size is
 * {@link holdsNothingLikeTheFile}'s, and {@link vast} is vast because nothing
 * reads it. This file is read twice over — once by the fixture writer and once by
 * the server — and a `Vec` is a `bigint`, so every 128 KiB costs tens of
 * milliseconds going in and the same coming out: about 320 ms for sixteen
 * conversions, measured on Darwin with Node 26.8.1. Bun's test runner gives one
 * proof five seconds, so a size chosen for effect would time out there rather than
 * prove anything.
 *
 * **The odd thousand bytes are load-bearing.** A size that is a whole number of
 * chunks is a size the reads reach *exactly*, so a fold that ignored the bound and
 * read to the end of the file would still hand the client every byte the header
 * promised before the runner's count noticed — and {@link boundedByTheFstat} would
 * pass with the bound removed. It did, the first time it was written. With the
 * bound falling inside a chunk, ignoring it reads 131,072 bytes where 1,000 were
 * owed, and the count refuses that chunk whole.
 */
const served = 2 * 1024 * 1024 + 1000

/**
 * The file the footprint is measured against: half a gibibyte, four thousand times
 * the ceiling this server used to refuse at.
 *
 * It costs nothing to make — `truncate` leaves a hole rather than writing zeroes —
 * and nothing to serve, because the client stops at the headers and the pump never
 * pulls past the socket's buffers. That asymmetry *is* the property: a route that
 * had the file in hand before the status went out could not have this proof at all.
 *
 * **It is this large so that the instrument can be crude.** `rss` is the only
 * footprint figure every runtime reports, and it moves for reasons that have
 * nothing to do with the body: measured on Darwin with Node 26.8.1, a warmed-up
 * process still drifted about 23 MB across one request. A file eight times the
 * threshold leaves that drift no way to look like a held body.
 */
const vast = 512 * 1024 * 1024

/** The header the bound proof reads the declared length out of. */
const lengthHeader = 'content-length:'

/** The slice the fixture is written in, and the slice the bound proof appends. */
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
        let written = 0
        while (written < served) {
            // Every slice is the same pattern, and its *offset* is what the digest
            // distinguishes: a window read twice lands the same bytes at the wrong
            // place in the polynomial. The last one is short, because
            // {@link served} is deliberately not a whole number of chunks.
            const take = Math.min(slice, served - written)
            const part = take === slice ? bytes : bytes.subarray(0, take)
            await fh.write(part)
            h = digest(h, part)
            written += take
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
 * Requests `name` over a raw socket and answers once the response **headers** are
 * in, or once the whole body is, depending on `stopAtTheHeaders`.
 *
 * Stopping at the headers is what makes the footprint proof cheap and exact: the
 * listener has opened the file and taken its size by then, so an eager body would
 * already be in memory, while a lazy one has read only what the socket took.
 *
 * @type {(port: number, name: string, stopAtTheHeaders: boolean) => Promise<{ readonly length: string, readonly count: number }>}
 */
const read = (port, name, stopAtTheHeaders) => new Promise(resolve => {
    let count = 0
    let head = true
    let length = 'absent'
    /** @type {Uint8Array[]} */
    const pending = []
    const socket = net.connect(port, loopback, () => {
        socket.write(`GET /${name} HTTP/1.1\r\nHost: ${loopback}\r\n\r\n`)
    })
    socket.on('error', () => { })
    socket.on('close', () => resolve({ length, count }))
    socket.on('data', part => {
        const bytes = Buffer.from(part)
        if (!head) {
            count += bytes.length
            return
        }
        pending.push(bytes)
        const all = Buffer.concat(pending)
        const at = all.indexOf('\r\n\r\n')
        if (at < 0) { return }
        head = false
        const headers = `${all.subarray(0, at)}`.toLowerCase()
        const stated = headers.split('\r\n').find(l => l.startsWith(lengthHeader))
        length = stated === undefined ? 'absent' : stated.slice(lengthHeader.length).trim()
        count += all.length - at - 4
        if (!stopAtTheHeaders) { return }
        socket.destroy()
        resolve({ length, count })
    })
})

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
 * @type {(check: (root: string, vastName: string, smallName: string) => Promise<void>) => Promise<void>}
 */
const withVastFile = async check => {
    const root = await mkdtemp(join(tmpdir(), 'fjs-web-vast-'))
    try {
        const vastName = 'vast.bin'
        const fh = await open(join(root, vastName), 'w')
        try { await fh.truncate(vast) } finally { await fh.close() }
        // A file to warm the path up with, so the baseline is taken after the
        // one-time cost of compiling `respond` rather than before it.
        const smallName = 'small.bin'
        const small = await open(join(root, smallName), 'w')
        try { await small.write(Uint8Array.from({ length: 64 }, (_, i) => i)) }
        finally { await small.close() }
        await check(root, vastName, smallName)
    } finally {
        await rm(root, { recursive: true, force: true })
    }
}

/**
 * Whether Bun's own test runner is what is running this, because it gives one
 * proof **five seconds** and will not be told otherwise: `bunfig.toml`'s
 * `[test] timeout` is ignored by Bun 1.4.2, measured.
 *
 * **Two proofs below need longer than that on Bun, and the reason is the `Vec`.**
 * A `Vec` is a `bigint`, so every 131,072-byte chunk is converted going in and
 * coming out, and Bun pays about 600 ms a chunk where Node 26.8.1 pays about 40 —
 * measured on Darwin against the same files. Neither proof can be made smaller to
 * fit: both need a body larger than the loopback socket's accept window, or the
 * pump finishes before the client can do anything, and that window is about a
 * megabyte. Standalone on Bun they take 10,362 ms and 6,516 ms.
 *
 * So they are skipped there, with the figures rather than a shrug. What is *not*
 * skipped anywhere is the runner's own behaviour: every proof in
 * [`../effects/node/proof.mjs`](../effects/node/proof.mjs) runs on all three
 * runtimes, which is the question `./todo/`'s design set out to settle. This is a
 * budget, not a difference in what Bun does.
 *
 * @type {boolean}
 */
const bunGivesFiveSeconds = 'Bun' in globalThis

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
    // A file of seventeen reads, served whole — byte for byte and in order, which
    // the digest is what checks. The client holds one slice at a time, as the
    // server does.
    servesEveryByteInOrder: () => withLargeFile(async (root, name, expected) => {
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
        assert(answer.parts > 10, answer.parts)
    }),
    // **The declared length is the bound the reads stop at.** The file **grows
    // through the inode the handle holds** while the pump is parked, which is the
    // guess the design measured going wrong: a length declared ahead of an
    // unbounded read, 131,072 bytes promised from a `stat` and 132,072 sent, under
    // a header nothing can check. The reads stop at the number in the header, so
    // the client gets the body it was promised and nothing of what was appended.
    //
    // A fixture cannot state this case — the virtual file system replaces a `Dir`
    // entry, and a handle holds what it opened, so a replacement is invisible
    // rather than longer. Appending to an open file is a thing only a disk does.
    //
    // **The append waits for the headers rather than for a clock**, which is what
    // makes this a proof of the bound and not of a race: a `Content-Length` in hand
    // is the `fstat` already taken, so the size the header names was read before
    // the file grew. A timer could have let the `fstat` see the grown file on a
    // starved machine, and the proof would then have failed for the wrong reason.
    //
    // Removing the bound is caught twice over: the reads run past the declared
    // length, and the runner's own count then refuses the overrunning chunk and
    // destroys the socket — so the client is left short of what it was promised.
    boundedByTheFstat: async () => {
        if (bunGivesFiveSeconds) { return }
        await withLargeFile(async (root, name, expected) => {
            const answer = await withServer(root, port => within(
                'a body bounded by the fstat',
                60000,
                /** @type {Promise<{ readonly count: number, readonly digest: number, readonly length: string }>} */
                (new Promise(resolve => {
                    let count = 0
                    let h = 0
                    let head = true
                    let length = 'undefined'
                    /** @type {Uint8Array[]} */
                    const pending = []
                    const socket = net.connect(port, loopback, () => {
                        socket.write(`GET /${name} HTTP/1.1\r\nHost: ${loopback}\r\n\r\n`)
                    })
                    socket.on('error', () => { })
                    socket.on('close', () => resolve({ count, digest: h, length }))
                    /** Appends to the file the response is being read from, then lets
                     * the pump go on. */
                    const grow = async () => {
                        const fh = await open(join(root, name), 'a')
                        try { await fh.write(Uint8Array.from({ length: slice }, () => 0xFF)) }
                        finally { await fh.close() }
                        socket.resume()
                    }
                    socket.on('data', part => {
                        const bytes = Buffer.from(part)
                        if (!head) {
                            count += bytes.length
                            h = digest(h, bytes)
                            return
                        }
                        pending.push(bytes)
                        const all = Buffer.concat(pending)
                        const at = all.indexOf('\r\n\r\n')
                        if (at < 0) { return }
                        head = false
                        const headers = `${all.subarray(0, at)}`.toLowerCase()
                        const stated = headers.split('\r\n').find(l => l.startsWith(lengthHeader))
                        length = stated === undefined ? 'absent' : stated.slice(lengthHeader.length).trim()
                        const body = all.subarray(at + 4)
                        count += body.length
                        h = digest(h, body)
                        // The headers are in hand, so the `fstat` is taken. Stop
                        // reading — the pump parks on the socket's buffers with most of
                        // the file still unread — append, and let it go on.
                        socket.pause()
                        grow().catch(() => { })
                    })
                }))))
                // The size the `fstat` gave, read before the file grew.
                assertEq(answer.length, `${served}`)
                // Exactly that, and nothing of the appended slice.
                assertEq(answer.count, served)
                assertEq(answer.digest, expected)
            })
    },
    // **And it is served without being held.** A hundred and twenty-eight
    // mebibytes — a thousand times the ceiling this server used to refuse at — and
    // the figure is read the moment the **response headers** reach the client. By
    // then a route that had every chunk in hand before the status went out would
    // have read the whole file; this one has read what the socket's buffers took.
    //
    // **A small file is served first, and the reading starts after it.** The first
    // request through this path compiles most of `respond` and allocates the effect
    // runner's own working set, which lands in `rss` and has nothing to do with the
    // body. Measured on Darwin with Node 26.8.1, that one-time cost is tens of
    // megabytes — larger than the whole of what this proof is looking for. So the
    // warm-up is spent before the baseline is taken.
    //
    // **`rss` is the figure, and it is the only one all three runtimes give.**
    // `process.memoryUsage().arrayBuffers` is where a `Buffer` lives and would be
    // the sharper reading, but it is Node's alone: measured against a retained
    // 32 MiB allocation, Node reported the whole of it there while Bun 1.4.2 and
    // Deno 2.8.3 both reported nought. All three moved `rss` by about the
    // allocation, so that is what is read.
    //
    // It stays a **coarse** measurement — `rss` counts the socket's own queue and
    // whatever the collector has not yet taken — so the threshold is an eighth of
    // the file and the claim is only that the footprint is nothing like it. The
    // exact bound is the pull count in
    // [`../effects/node/proof.mjs`](../effects/node/proof.mjs)
    // (`createServer.pullsAtTheSocketsPace`), where ten times the body is not ten
    // times the memory.
    holdsNothingLikeTheFile: async () => {
        if (bunGivesFiveSeconds) { return }
        await withVastFile(async (root, vastName, smallName) => {
            const held = await withServer(root, async port => {
                await within('a warm-up request', 30000, read(port, smallName, false))
                const before = process.memoryUsage().rss
                const answer = await within('a vast file', 30000, read(port, vastName, true))
                // The headers are in hand, so the listener has opened the file and
                // taken its size. An eager body would be in memory by now.
                assertEq(answer.length, `${vast}`)
                return process.memoryUsage().rss - before
            })
            assert(held < vast / 8, [held, vast])
        })
    },
}
