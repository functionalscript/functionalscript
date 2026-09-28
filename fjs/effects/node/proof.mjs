/**
 * Host proofs of the Node runner: the operations whose whole contract is
 * what the host does with them, driven against the real host. Each is a
 * `NodeProgram` run through `runEffect`, answering `0` where the host did
 * what the operation promises and a code naming what it did instead.
 *
 * Proofs that need a filesystem own a temporary tree and remove it in
 * `finally`, through {@link withTemporary}. They exercise the sibling host
 * runner; compiler traversal and diagnostics are proved synchronously in
 * `compiler/transpiler/proof.f.mjs`.
 *
 * @import { All, Handle, NodeProgram, NodeOp, ReadRequestBytes, RequestListener as Erl, ServerResponse } from './types.ts'
 * @import { Effect, IoChannel, Operation } from '../types.ts'
 * @import { List, Next } from '../list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import http from 'node:http'
import net from 'node:net'
import { constants as fsConstants } from 'node:fs'
import process from 'node:process'
import zlib from 'node:zlib'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError, pureError, pureOk, resultMapStep, resultStep, step } from '../module.f.mjs'
import { empty as listEnd, nonEmpty } from '../list/module.f.mjs'
import { byteLength, length, maxLengthBytes, u8ListMsb, u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { asBase } from '../../types/nominal/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { toVec } from '../../types/uint8array/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { tagLoose, tagPayload } from '../../git/testlib.f.mjs'
import {
    awaitIfPromise, both, catch_, close, createServer, doubledLengthMessage, errorMessage,
    framingHeaderMessage, fstat,
    inflate, inflateTrailingCode, listen, open, pread, readWhole, rename, requestBodyOffsetMessage,
    resolveFileModule, maxOffset, readBytes, rmdir, unframedBodyMessage, writeExclusive,
} from './module.f.mjs'
import { readFlags, runEffect } from './module.mjs'

/** @type {(program: NodeProgram) => Promise<number>} */
const exitCode = runEffect

/** @type {(n: number) => Uint8Array} */
const bytes = n => Uint8Array.from({ length: n }, (_, i) => i * 7 & 0xFF)

/** @type {(data: Uint8Array) => Uint8Array} */
const deflated = data => new Uint8Array(zlib.deflateSync(data))

/** @type {(...parts: readonly Uint8Array[]) => Uint8Array} */
const joined = (...parts) => new Uint8Array(parts.flatMap(p => [...p]))

/**
 * @template T, E
 * @param {Effect<NodeOp, T, E>} effect
 * @param {(result: Result<T, E>) => void} check
 * @returns {Promise<void>}
 */
const hostCheck = async (effect, check) => {
    assertEq(await runEffect(() => resultMapStep(effect, result => {
        check(result)
        return ok(0)
    })), 0)
}

/**
 * `O_EXCL` refusing a name something already holds. The code is the host's,
 * unwrapped, so that a change of flag shows up as a missing refusal rather than
 * as a different message.
 *
 * @type {(result: Result<void, IoChannel>) => void}
 */
const refusedTaken = result => refusedWith('EEXIST')(result)

/**
 * A failure carrying the host's own code, unwrapped so that a change of
 * operation shows up as a different code rather than as a different message.
 *
 * @type {(code: string) => (result: Result<void, IoChannel>) => void}
 */
const refusedWith = code => result => {
    assert(result[0] === 'error')
    assert(result[1][0] === 'ioError')
    assertEq(result[1][1].code, code)
}

/** @type {(n: number) => Uint8Array} */
const payload = n => Uint8Array.from({ length: 8 }, (_, i) => n + i & 0xFF)

const fixtures = {
    'dep #%.mjs': 'export const url = import.meta.url; export default [42];',
    'other.mjs': 'export default [42];',
    'left.mjs': 'import value from "./dep%20%23%25.mjs"; export default value;',
    'right.mjs': 'import value from "./absent/%2e%2e/dep%20%23%25.mjs"; export default value;',
    'cycle.mjs': 'import value from "./%63ycle.mjs"; export default value;',
    'entry #%.mjs': 'export const url = import.meta.url; import a from "./left.mjs"; import b from "./right.mjs"; import c from "./%64ep%20%23%25.mjs"; import d from "./other.mjs"; export default [a, b, c, d];',
}

/**
 * A unique temporary directory for one proof, removed even when writing a
 * fixture, importing it or an assertion fails. Nothing a proof leaves behind
 * reaches the repository, its npm declarations or Cloudflare's asset manifest.
 *
 * @type {(prefix: string, check: (root: string) => Promise<void>) => Promise<void>}
 */
const withTemporary = async (prefix, check) => {
    const temporary = await mkdtemp(join(tmpdir(), prefix))
    try {
        await check(temporary)
    } finally {
        await rm(temporary, { recursive: true, force: true })
    }
}

/**
 * The module-resolution tree, in a directory of its own so that native
 * module-cache keys differ between proofs. Deliberately unusual filenames stay
 * out of the repository.
 *
 * @type {(check: (directory: URL) => Promise<void>) => Promise<void>}
 */
const withFixtures = check => withTemporary('fjs-module-url-', async temporary => {
    const path = join(temporary, 'url%23identity')
    await mkdir(path)
    for (const [name, source] of Object.entries(fixtures)) {
        await writeFile(join(path, name), source)
    }
    // The temporary root may itself be reached through a symlink. Expected
    // identities use its canonical location, independently of this loader.
    await check(pathToFileURL(`${await realpath(path)}${sep}`))
})

/**
 * Bytes whose pattern does not repeat on a chunk boundary. {@link bytes} steps
 * by seven and so repeats every 256, and a `Vec` is 131,072 bytes — a multiple
 * of 256 — so a chunk list joined *out of order* compares equal to one in order
 * and a proof over it watches only the length. A prime modulus leaves no such
 * alignment: every chunk boundary falls somewhere new in the cycle.
 *
 * @type {(n: number) => Uint8Array}
 */
const unalignedBytes = n => Uint8Array.from({ length: n }, (_, i) => i % 251)

/** Every byte a chunk list holds, in order.
 *
 * @type {(chunks: readonly Vec[]) => readonly number[]}
 */
const chunkBytes = chunks => chunks.flatMap(v => toArray(u8ListMsb(v)))

/**
 * Asserts that two byte sequences are the same, by length and then by the first
 * byte that differs.
 *
 * Not `assertStructurallySame` on the two arrays: a body here runs past a
 * hundred thousand bytes, and a failure that prints both of them names nothing a
 * reader can act on, where an index names where the bytes went wrong.
 *
 * @type {(actual: readonly number[], expected: readonly number[]) => void}
 */
const assertSameBytes = (actual, expected) => {
    assertEq(actual.length, expected.length)
    assertEq(actual.findIndex((b, i) => b !== expected[i]), -1)
}

/** How many bytes a chunk list holds.
 *
 * @type {(chunks: readonly Vec[]) => bigint}
 */
const chunkLength = chunks => chunks.reduce((n, v) => n + byteLength(v), 0n)

/** The address every proof here binds, for the reason `Listen` takes one. */
const loopback = '127.0.0.1'

/**
 * Fails rather than hangs.
 *
 * Every proof below is about a pump, and the failure mode a pump has is *not
 * finishing*: a park nothing releases, a body nobody pulls, a socket that never
 * closes. A proof that waited for such a thing would stop the whole suite with no
 * verdict, which is the one outcome worse than a red one. So each of them runs
 * inside a deadline that rejects, and the message says which wait it was.
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

/**
 * Runs `listener` behind a real socket, hands `client` the port it bound, and
 * closes the server afterwards whatever the client did.
 *
 * **The server is closed by this function and not by the program**, because
 * there is no operation that closes one: a `NodeProgram` answers an exit code,
 * so the handle is taken out of it here and unwrapped to the `http.Server`
 * underneath. That reach-through is why these proofs live in the impure shell
 * beside the runner rather than in a `.f.mjs`.
 *
 * Port `0` asks the host for a free one — a fixed port makes a proof fail when
 * something else on the machine happens to hold it. `fjs web` refusing `0` is
 * its own command-line policy and not this operation's.
 *
 * Connections are destroyed before the close, since half of these proofs leave a
 * keep-alive socket open on purpose and `server.close` waits for the last one.
 *
 * @template T
 * @param {Erl<NodeOp>} listener
 * @param {(port: number) => Promise<T>} client
 * @returns {Promise<T>}
 */
const withServer = async (listener, client) => {
    /** @type {(server: import('node:http').Server) => void} */
    let created = () => { }
    /** @type {Promise<import('node:http').Server>} */
    const held = new Promise(resolve => { created = resolve })
    /** @type {NodeProgram} */
    const program = () => resultMapStep(
        step(
            createServer(listener),
            server => {
                // The one cast, and the boundary the runner itself crosses the
                // same way: a `Server` is a `Nominal` over the host's own
                // object, and `asBase` is how the runner reads it back.
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
 * The chunks given, as a body already in hand: every cell is pure, so the whole
 * chain is built before the runner pulls any of it. That is what a listener
 * answering out of memory looks like, beside the lazy bodies the pump proofs
 * below drive.
 *
 * @type {(chunks: readonly Vec[]) => List<never, Vec, IoChannel>}
 */
const ofChunks = chunks => chunks.reduceRight(
    (tail, chunk) => nonEmpty(chunk, tail),
    /** @type {List<never, Vec, IoChannel>} */(listEnd()))

/** A listener holding nothing writes the pure end.
 *
 * @type {Effect<never, null, never>}
 */
const holdsNothing = pureOk(null)

/**
 * A listener that reads its whole request body and answers with it, counting the
 * cells it took in a header.
 *
 * The count is there because a body echoed from one chunk and a body echoed from
 * many are different claims, and the bytes alone do not tell them apart.
 *
 * @type {Erl<ReadRequestBytes>}
 */
const echoBody = ({ body }) => {
    /** @type {(taken: readonly Vec[], rest: List<ReadRequestBytes, Vec, IoChannel>) => Effect<ReadRequestBytes, readonly Vec[], IoChannel>} */
    const loop = (taken, rest) => step(rest, node =>
        node === undefined ? pureOk(taken) : loop([...taken, node.first], node.tail))
    return resultMapStep(loop([], body), r => ok(r[0] === 'ok'
        ? {
            status: 200,
            headers: { 'content-length': `${chunkLength(r[1])}`, 'x-chunks': `${r[1].length}` },
            body: ofChunks(r[1]),
            release: holdsNothing,
        }
        : reported(errorMessage(r[1]))))
}

/**
 * A `500` carrying `text`, which is how a listener reports what it saw of its
 * own request body. The refusal is observable nowhere else: the runner hands the
 * body to the listener and the listener's only way out is a response.
 *
 * @type {(text: string) => ServerResponse<never>}
 */
const reported = text => {
    const bytes = new TextEncoder().encode(text)
    return {
        status: 500,
        headers: { 'content-length': `${bytes.length}` },
        body: ofChunks([toVec(bytes)]),
        release: holdsNothing,
    }
}

/**
 * What one pull of a body cell answered: the number of bytes it took, the end of
 * the stream, or the refusal it met.
 *
 * @type {(r: Result<Next<ReadRequestBytes, Vec, IoChannel>, IoChannel>) => string}
 */
const pulled = r => r[0] === 'error'
    ? `error ${errorMessage(r[1])}`
    : r[1] === undefined ? 'end' : `ok ${byteLength(r[1].first)}`

/**
 * Pulls one body cell twice **at the same time**, then pulls the winner's tail,
 * and answers with what each of the three pulls saw.
 *
 * `both` rather than a second `step` is the whole subject: the Node runner's
 * `all` is `Promise.all`, so it starts both effects before it awaits either, and
 * a sequential re-pull cannot reach that interleaving. The tail pull is here
 * because a refused pull must not refuse the pulls after it — the refusal
 * belongs to the pull that lost, not to the body.
 *
 * @type {Erl<ReadRequestBytes | All>}
 */
const concurrentPulls = ({ body }) => resultMapStep(
    step(both(body)(body), ([a, b]) => {
        const seen = `${pulled(a)} | ${pulled(b)}`
        const won = a[0] === 'ok' && a[1] !== undefined
            ? a[1]
            : b[0] === 'ok' && b[1] !== undefined ? b[1] : null
        /** @type {Effect<ReadRequestBytes, string, never>} */
        const then = won === null
            ? pureOk(seen)
            : resultMapStep(won.tail, t => ok(`${seen} | ${pulled(t)}`))
        return then
    }),
    r => ok(reported(r[0] === 'ok' ? r[1] : 'all was not dispatched')))

/**
 * Reads the body until a pull fails, then pulls the *same* cell again and
 * answers with what the failed pull and its retry each saw.
 *
 * `started` is called after every pull that answered bytes, so the client can
 * cut the connection knowing the listener is already reading. Nothing else
 * orders the two, and a timer would make the proof a race.
 *
 * The retry is the subject: a `List`'s tail is a value, and a listener that
 * caught a failure has the cell it failed on still in hand. What it must not get
 * is the end of the body.
 *
 * @type {(started: () => void, report: (text: string) => void) => Erl<ReadRequestBytes>}
 */
const retriesAFailedPull = (started, report) => ({ body }) => {
    /** @type {(cell: List<ReadRequestBytes, Vec, IoChannel>) => Effect<ReadRequestBytes, string, never>} */
    const loop = cell => resultStep(cell, r => {
        if (r[0] === 'error') {
            return resultMapStep(cell, again => ok(`${pulled(r)} | ${pulled(again)}`))
        }
        if (r[1] === undefined) { return pureOk('the body ended with nothing refused') }
        started()
        return loop(r[1].tail)
    })
    return resultMapStep(loop(body), r => {
        const seen = r[0] === 'ok' ? r[1] : 'the fold failed'
        report(seen)
        return ok(reported(seen))
    })
}

/** A listener that answers at once, reading no part of the request body.
 *
 * @type {Erl<never>}
 */
const ignoresBody = () => pureOk({
    status: 200,
    headers: { 'content-length': '2' },
    body: ofChunks([toVec(new TextEncoder().encode('ok'))]),
    release: holdsNothing,
})

/**
 * The same listener, contradicting the runner: it reads no part of the body and
 * asks for the connection to be **kept**.
 *
 * A listener has every reason to write that header — it is what Node's default
 * already implies — so this is the ordinary case and not a hostile one. The
 * sentinel rides in `x-chunks` because {@link overAnAgent} already reports that
 * header, so the claim *the rest of the listener's headers still go out* needs
 * no new plumbing to assert.
 *
 * @type {Erl<never>}
 */
const keepsAliveIgnoringBody = () => pureOk({
    status: 200,
    headers: { 'content-length': '2', connection: 'keep-alive', 'x-chunks': 'kept' },
    body: ofChunks([toVec(new TextEncoder().encode('ok'))]),
    release: holdsNothing,
})

/**
 * What one request over `agent` came back with, and whether it went out over a
 * socket an earlier request had used.
 *
 * **A later `error` does not undo a response that arrived.** The server may
 * close the connection while the client is still writing an unread body, so
 * `http.request` can emit `EPIPE` or `ECONNRESET` *after* the whole answer has
 * been read. The response wins where there is one, and the error is only an
 * answer where there is not.
 *
 * @type {(port: number, method: string, body: Nullable<Uint8Array>, agent: import('node:http').Agent) => Promise<{ readonly status: number, readonly connection: string, readonly chunks: string, readonly body: Uint8Array, readonly reused: boolean }>}
 */
const overAnAgent = (port, method, body, agent) => new Promise((resolve, reject) => {
    /** @type {boolean} */
    let answered = false
    const request = http.request(
        {
            host: loopback,
            port,
            method,
            path: '/',
            agent,
            headers: body === null ? {} : { 'content-length': `${body.length}` },
        },
        response => {
            let parts = /** @type {readonly Uint8Array[]} */ ([])
            response.on('data', part => { parts = [...parts, part] })
            response.on('end', () => {
                answered = true
                resolve({
                    status: response.statusCode ?? 0,
                    connection: `${response.headers['connection']}`,
                    chunks: `${response.headers['x-chunks']}`,
                    body: Buffer.concat(parts),
                    reused: request.reusedSocket === true,
                })
            })
        })
    request.on('error', e => { if (!answered) { reject(e) } })
    request.end(body ?? undefined)
})

/**
 * Whether this run is the one whose host behaviour the HTTP proofs below are
 * about. They bind a real socket and read what Node does with a body it was
 * given; Bun and Deno answer the same operations through their own `node:http`,
 * which is a separate claim and not this runner's.
 *
 * @type {() => boolean}
 */
const isNode = () => !('Bun' in globalThis) && !('Deno' in globalThis)

/**
 * What one ordinary request came back with: the status, the declared length, and
 * the bytes that reached the socket — plus how it ended and **how long it waited**,
 * since half of these proofs are about a response that ends badly and one of them
 * is about a client being told at once rather than at an idle timeout.
 *
 * @type {(port: number, method: string) => Promise<{ readonly status: number, readonly length: string, readonly body: Uint8Array, readonly ending: string, readonly ms: number }>}
 */
const answered = (port, method) => new Promise((resolve, reject) => {
    let parts = /** @type {readonly Uint8Array[]} */ ([])
    /** @type {number} */
    let status = 0
    /** @type {string} */
    let length = 'undefined'
    const start = now()
    /** @type {(ending: string) => void} */
    const done = ending => resolve({ status, length, body: Buffer.concat(parts), ending, ms: now() - start })
    const request = http.request({ host: loopback, port, method, path: '/' }, response => {
        status = response.statusCode ?? 0
        length = `${response.headers['content-length']}`
        response.on('data', part => { parts = [...parts, part] })
        response.on('end', () => done('end'))
        response.on('error', e => done(errorCode(e)))
    })
    // The agent keeps the connection alive, which is what makes the short-body
    // case take the idle timeout rather than the close — see `underrunDestroys`.
    request.on('error', e => (status === 0 ? reject(e) : done(errorCode(e))))
    request.end()
})

/** The code a client's failure carries, or its message where the host gave none.
 *
 * @type {(e: unknown) => string}
 */
const errorCode = e => {
    const { code, message } = /** @type {{ readonly code?: string, readonly message: string }} */ (e)
    return code ?? message
}

/**
 * A counter a proof reads and an effect writes, which is how a pump's stopping
 * place is observed from the listener's side rather than from the response's.
 *
 * @typedef {{ n: number }} _Counter
 */

/**
 * What a host answered when asked to open a **directory** — one shape or the
 * other, never both, and `fjs/web` maps each to the same `404`.
 *
 * @typedef {{
 *   readonly refused: Nullable<IoChannel>,
 *   readonly stats: Nullable<{ readonly isFile: boolean, readonly isDirectory: boolean }>,
 *   readonly read: Nullable<Result<Vec, IoChannel>>,
 * }} _DirectoryAnswer
 */

/** @type {() => _Counter} */
const counter = () => ({ n: 0 })

const { now } = Date

/**
 * Waits for `count` to reach `n`, and **gives up** — because a proof that spins
 * until a counter moves is a proof that wedges the whole suite when it never
 * does. Giving up leaves the assertion to report the number, which is a verdict;
 * spinning leaves no verdict at all, and the timer chain keeps the process alive
 * past the failure it was supposed to report.
 *
 * @type {(count: _Counter, n: number) => Promise<void>}
 */
const reaches = (count, n) => new Promise(resolve => {
    /** @type {(left: number) => void} */
    const poll = left => {
        if (count.n >= n || left === 0) {
            resolve(undefined)
            return
        }
        setTimeout(() => poll(left - 1), 20)
    }
    poll(100)
})

/**
 * An effect that counts, and answers the pure end: `release` as a listener would
 * write it if it had something to give back.
 *
 * `catch_` because its thunk runs when the runner dispatches the command rather
 * than when the effect is built, which is the only lazy impure hook the operation
 * set offers. This is the impure shell, where such a thing is allowed.
 *
 * @type {(count: _Counter) => Effect<NodeOp, null, never>}
 */
const counting = count => resultMapStep(catch_(() => { count.n += 1 }), () => ok(null))

/**
 * A body of `count` chunks, produced **one cell per pull** — each cell is built
 * inside a command's continuation, so nothing of it exists until the pump asks —
 * and counting the pulls.
 *
 * That count is how these proofs see a bound rather than assert one: a pump parked
 * on `drain` has pulled a small number of chunks whatever the body's length is,
 * and a pump that read `res.write`'s answer and pulled anyway would have pulled
 * all of them.
 *
 * `chunk` is converted once, before the body exists: `toVec` of 128 KiB costs tens
 * of milliseconds, and paying it per cell would make the pull count a measure of
 * this machine rather than of the socket.
 *
 * @type {(chunk: Vec, count: number, pulls: _Counter) => List<NodeOp, Vec, IoChannel>}
 */
const lazyBody = (chunk, count, pulls) => {
    /** @type {(i: number) => List<NodeOp, Vec, IoChannel>} */
    const cell = i => step(catch_(() => { pulls.n += 1 }), () =>
        i === count ? listEnd() : nonEmpty(chunk, cell(i + 1)))
    return cell(0)
}

/** One `Vec`'s worth of bytes, the chunk every pump proof below writes. */
const oneVec = Number(maxLengthBytes)

/** @type {Vec} */
const vecChunk = toVec(new Uint8Array(oneVec).fill(7))

const expectedValue = [[42], [42], [42], [42]]
const expectedSharing = [true, true, true]

/** Observe sharing, not just equal contents. @type {(value: unknown) => readonly boolean[]} */
const sharing = value => {
    assert(value instanceof Array)
    const [a, b, c, d] = value
    return [a === b, b === c, c !== d]
}

export const proof = {
    resolveFileModule: {
        symlinkIdentity: () => withFixtures(async directory => {
            const root = fileURLToPath(directory)
            const real = join(root, 'real')
            await mkdir(real)
            await symlink(real, join(root, 'alias'), 'junction')
            await writeFile(join(real, 'dep.mjs'), 'export const url = import.meta.url; export default [42];')
            const entry = new URL('entry%20%23%25.mjs', directory)
            const expected = pathToFileURL(join(real, 'dep.mjs')).href
            for (const name of ['./real/dep.mjs', './alias/dep.mjs']) {
                await hostCheck(resolveFileModule(name, entry.href), result => {
                    assertStructurallySame(unwrap(result), { id: expected, path: join(real, 'dep.mjs') })
                })
            }
            if (isNode()) {
                const direct = await import(new URL('./real/dep.mjs', entry).href)
                const alias = await import(new URL('./alias/dep.mjs', entry).href)
                assertEq(alias.url, expected)
                assertEq(alias.default, direct.default)
            }
        }),
        fileIdentity: () => withFixtures(async directory => {
            const entry = new URL('entry%20%23%25.mjs', directory)
            const dependency = new URL('dep%20%23%25.mjs', directory)
            const path = fileURLToPath(entry)
            for (const name of [path, relative(process.cwd(), path), `${fileURLToPath(directory)}./entry #%.mjs`]) {
                await hostCheck(resolveFileModule(name, null), result => {
                    const location = unwrap(result)
                    assertEq(location.id, entry.href)
                    assertEq(location.path, path)
                })
            }
            for (const spelling of ['./dep%20%23%25.mjs', './%64ep%20%23%25.mjs', './absent/%2e%2e/dep%20%23%25.mjs']) {
                await hostCheck(resolveFileModule(spelling, entry.href), result => {
                    const location = unwrap(result)
                    assertEq(location.id, dependency.href)
                    assertEq(location.path, fileURLToPath(dependency))
                })
            }
        }),
        // Only Node's loader defines this profile. Compare the adapter's
        // identities with import.meta.url and actual native module instances;
        // compiler graph sharing is proved through synchronous mock effects.
        nativeIdentity: () => withFixtures(async directory => {
            if (isNode()) {
                const entry = new URL('entry%20%23%25.mjs', directory)
                const dependency = new URL('dep%20%23%25.mjs', directory)
                const native = await import(entry.href)
                assertStructurallySame(native.default, expectedValue)
                assertStructurallySame(sharing(native.default), expectedSharing)
                for (const name of [fileURLToPath(entry), relative(process.cwd(), fileURLToPath(entry))]) {
                    await hostCheck(resolveFileModule(name, null), result => assertEq(unwrap(result).id, native.url))
                }
                for (const spelling of ['./dep%20%23%25.mjs', './%64ep%20%23%25.mjs', './absent/%2e%2e/dep%20%23%25.mjs']) {
                    const imported = await import(new URL(spelling, entry).href)
                    assertEq(imported.default, native.default[0])
                    await hostCheck(resolveFileModule(spelling, entry.href), result => {
                        assertEq(unwrap(result).id, imported.url)
                        assertEq(unwrap(result).path, fileURLToPath(dependency))
                    })
                }
            }
        }),
        cycleIdentity: () => withFixtures(async directory => {
            const cycle = new URL('cycle.mjs', directory)
            await hostCheck(resolveFileModule(fileURLToPath(cycle), null), result => assertEq(unwrap(result).id, cycle.href))
            await hostCheck(resolveFileModule('./%63ycle.mjs', cycle.href), result => assertEq(unwrap(result).id, cycle.href))
        }),
        resolutionErrors: () => withFixtures(async directory => {
            const entry = new URL('entry%20%23%25.mjs', directory)
            for (const name of ['./missing.mjs', './dep%2Fmjs', './bad%', 'https://example.com/dep.mjs', entry.href, './dep%20%23%25.mjs?v=1', './dep%20%23%25.mjs#copy']) {
                await hostCheck(resolveFileModule(name, entry.href), result => assertEq(result[0], 'error'))
            }
            const missing = fileURLToPath(new URL('missing.mjs', directory))
            await hostCheck(resolveFileModule(missing, null), result => assertEq(result[0], 'error'))
        }),
    },
    inflate: {
        // A stream through the real zlib: the bytes it was made from, every
        // one, and the whole input taken.
        roundTrip: async () => {
            const data = bytes(1000)
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(toVec(deflated(data))), r => {
                if (r[0] === 'error') { return error(1) }
                const out = toArray(u8ListMsb(r[1]))
                return out.length === data.length && out.every((b, i) => b === data[i]) ? ok(0) : error(2)
            })
            assertEq(await exitCode(program), 0)
        },
        // A stream another zlib wrote: the loose object file Git 2.43 wrote
        // for the checked-in tag, inflated to the envelope the tag's bytes
        // make, every one, so what the runner reads is what Git writes and
        // not only what Node deflates.
        gitWrote: async () => {
            const envelope = toArray(writeEnvelope('tag', tagPayload))
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(u8ListToVecMsb(tagLoose)), r => {
                if (r[0] === 'error') { return error(1) }
                const out = toArray(u8ListMsb(r[1]))
                return out.length === envelope.length && out.every((b, i) => b === envelope[i]) ? ok(0) : error(2)
            })
            assertEq(await exitCode(program), 0)
        },
        // Bytes after the end of the stream are refused with the runner's
        // own code, since zlib alone would read the stream and say nothing.
        trailing: async () => {
            const input = joined(deflated(bytes(10)), new Uint8Array([1, 2, 3]))
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(toVec(input)), r =>
                r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === inflateTrailingCode
                    && r[1][1].message === '3 bytes after the end of the zlib stream' ? ok(0) : error(1))
            assertEq(await exitCode(program), 0)
        },
        // Bytes that are no zlib stream are the channel's: Node's own code, kept.
        notZlib: async () => {
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(toVec(new Uint8Array([0x6A, 0x75, 0x6E, 0x6B]))), r =>
                r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'Z_DATA_ERROR' ? ok(0) : error(1))
            assertEq(await exitCode(program), 0)
        },
        // A stream that inflates past the bound is refused, not cut short:
        // one byte over `maxLengthBytes` is `ERR_BUFFER_TOO_LARGE`, and the
        // bound itself inflates.
        bound: async () => {
            const most = Number(maxLengthBytes)
            /** @type {NodeProgram} */
            const over = () => resultMapStep(inflate(toVec(deflated(new Uint8Array(most + 1)))), r =>
                r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'ERR_BUFFER_TOO_LARGE' ? ok(0) : error(1))
            assertEq(await exitCode(over), 0)
            /** @type {NodeProgram} */
            const fits = () => resultMapStep(inflate(toVec(deflated(new Uint8Array(most)))), r => r[0] === 'ok' ? ok(0) : error(1))
            assertEq(await exitCode(fits), 0)
        },
    },
    // The operation exists for one property the host holds and no runner here
    // models: the file is created by *this* call or not at all. `O_EXCL` is the
    // whole of it, and these are what fail if the flag goes back to `w`.
    writeExclusive: {
        // A free name is created holding exactly the bytes given, and the same
        // name a second time is refused with the bytes it held left alone. `w`
        // would answer `ok` and truncate.
        exclusive: () => withTemporary('fjs-write-exclusive-', async root => {
            const path = join(root, 'ref')
            const first = payload(1)
            await hostCheck(writeExclusive(path, [toVec(first)]), result => assertEq(result[0], 'ok'))
            assertStructurallySame([...await readFile(path)], [...first])
            await hostCheck(writeExclusive(path, [toVec(payload(100))]), refusedTaken)
            assertStructurallySame([...await readFile(path)], [...first])
        }),
        // Several chunks land in order through the one open: a file has no
        // `Vec`'s bound, and a caller whose contents outgrow one — a rewritten
        // `packed-refs` does at about 1,870 refs — must not have to fall back to
        // a create followed by a reopen by name.
        chunks: () => withTemporary('fjs-write-exclusive-chunks-', async root => {
            const path = join(root, 'packed-refs.new')
            const [a, b, c] = [payload(1), payload(50), payload(99)]
            await hostCheck(writeExclusive(path, [toVec(a), toVec(b), toVec(c)]), result => assertEq(result[0], 'ok'))
            assertStructurallySame([...await readFile(path)], [...a, ...b, ...c])
        }),
        // A symlink planted at the name is refused without being followed: the
        // link is still a link and its target still holds what it held. This is
        // the hole the `createExclusive` + `writeFile` pair had — that write
        // followed the link and overwrote the target — so it is the case the
        // operation was added for.
        //
        // A file symlink needs a privilege on Windows, where the two directory
        // junctions this repository already plants are what is available; the
        // refusal above is platform-independent and covers the flag on its own.
        symlink: () => withTemporary('fjs-write-exclusive-link-', async root => {
            if (process.platform === 'win32') { return }
            const target = join(root, 'target')
            const held = payload(2)
            await writeFile(target, held)
            const link = join(root, 'link')
            await symlink(target, link)
            await hostCheck(writeExclusive(link, [toVec(payload(200))]), refusedTaken)
            assertStructurallySame([...await readFile(target)], [...held])
            assert((await lstat(link)).isSymbolicLink())
            // A dangling link is refused the same way, rather than creating the
            // target it names — `w` through one of those is how a planted link
            // writes a file anywhere the process can reach.
            const dangling = join(root, 'dangling')
            await symlink(join(root, 'absent'), dangling)
            await hostCheck(writeExclusive(dangling, [toVec(payload(300))]), refusedTaken)
            assert(!(await readdir(root)).includes('absent'))
        }),
    },
    // What a ref delete prunes with. The two refusals are the whole reason to use
    // `rmdir` rather than a recursive `rm` behind an emptiness check: a directory
    // holding anything is `ENOTEMPTY` by the host's own decision, so a ref landing
    // in it between the check and the removal cannot be lost; and a symbolic link
    // is `ENOTDIR` rather than followed, so a planted link cannot turn the prune
    // into a removal somewhere else.
    rmdir: {
        emptyOnly: () => withTemporary('fjs-rmdir-', async root => {
            const empty = join(root, 'empty')
            await mkdir(empty)
            await hostCheck(rmdir(empty), result => assertEq(result[0], 'ok'))
            assert(!(await readdir(root)).includes('empty'))
            const full = join(root, 'full')
            await mkdir(join(full, 'ref'), { recursive: true })
            await hostCheck(rmdir(full), refusedWith('ENOTEMPTY'))
            assert((await readdir(full)).includes('ref'))
            await hostCheck(rmdir(join(root, 'absent')), refusedWith('ENOENT'))
        }),
        // A link to a directory is refused and not followed: the link and the
        // directory it names both survive, and so does what is in it. On Windows
        // the link is a junction, which needs no privilege to create and which
        // `RemoveDirectoryW` would remove outright — so this is the case that
        // holds the runner's `lstat` there, and POSIX's own `ENOTDIR` elsewhere.
        // The target holds a file so that removing the link, not the target, is
        // the only way the host could answer `ok`.
        symlink: () => withTemporary('fjs-rmdir-link-', async root => {
            const target = join(root, 'target')
            await mkdir(join(target, 'ref'), { recursive: true })
            const link = join(root, 'link')
            await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir')
            await hostCheck(rmdir(link), refusedWith('ENOTDIR'))
            assert((await lstat(link)).isSymbolicLink())
            assert((await readdir(target)).includes('ref'))
        }),
    },
    readWhole: {
        // A file larger than one `Vec` comes back as more than one chunk, in
        // order and byte for byte — the property the accumulator inside the
        // operation has to keep whichever way it collects. Nothing else proves
        // the chunking against a real file: the virtual runner hands back the
        // chunk list a fixture was written as, so a fixture cannot be wrong
        // about the boundaries the way an accumulator can.
        pastOneVec: () => withTemporary('fjs-read-whole-', async root => {
            const path = join(root, 'large.bin')
            const content = unalignedBytes(Number(maxLengthBytes) + 1024)
            await writeFile(path, content)
            await hostCheck(readWhole(path), result => {
                const chunks = unwrap(result)
                assert(chunks.length > 1, chunks.length)
                assertEq(chunkLength(chunks), BigInt(content.length))
                assertSameBytes(chunkBytes(chunks), [...content])
            })
        }),
    },
    // An open file as a value, asked of the host. The virtual runner models these
    // and a fixture is a snapshot by construction there, so the claims that make
    // the model worth trusting are the ones only a descriptor can settle.
    open: {
        // **The one-inode claim.** A file renamed over the name a handle was
        // opened on is still read as the bytes the handle opened, and `fstat`
        // through it still answers the original size. That is what no
        // path-taking operation can offer, and it is what lets a response body be
        // read in windows without the windows coming from two files.
        namesAnInode: () => withTemporary('fjs-handle-inode-', async root => {
            // Replacing a name another handle holds open is what Windows shares
            // least willingly, and nothing here has measured what it does — the
            // same reason `writeExclusive.symlink` above guards it. The claim is
            // modelled on every platform by the virtual runner
            // (`handles.namesAnInode` in `./virtual/proof.f.mjs`); this is the
            // descriptor it is modelled after.
            if (process.platform === 'win32') { return }
            const path = join(root, 'a.bin')
            const other = join(root, 'b.bin')
            await writeFile(path, 'old')
            await writeFile(other, 'new')
            await hostCheck(step(open(path), handle =>
                step(rename(other, path), () =>
                    step(fstat(handle), s =>
                        step(pread(handle, 0, 8), taken =>
                            step(close(handle), () => pureOk([s.size, utf8ToString(taken)])))))),
                result => assertStructurallySame(unwrap(result), [3, 'old']))
            // The rename landed, so the read above answered the entry the open
            // resolved to rather than the one the name holds.
            assertEq(`${await readFile(path)}`, 'new')
        }),
        // **The open does not wait for a writer, and this is the weakest proof in
        // this file — deliberately.** It asserts the flag the runner asks for,
        // not what the flag does, and the reason is worth stating rather than
        // hiding: the behaviour needs a FIFO, `fs` offers no operation that makes
        // one, and calling `mkfifo` would be this repository's code calling an
        // external tool, which [AGENTS.md §6](../../../AGENTS.md#6-external-tools)
        // does not allow without approval first.
        //
        // What the flag does was measured by hand on Darwin with Node 26.8.1 and
        // is recorded where the decision is: `Open` in [`./types.ts`](./types.ts).
        // A plain read-only open of a writerless FIFO never returned and left the
        // process unable to exit at all, holding its thread-pool slot for as long
        // as it lived; `O_RDONLY | O_NONBLOCK` answered in nought milliseconds and
        // the `fstat` said `isFile: false`. Bun 1.4.2 and Deno 2.8.3 answered the
        // same.
        //
        // So this line is here for one reason: it turns dropping the flag from an
        // invisible change into a red test. The `fstat`-through-a-descriptor half
        // of the same guard *is* proven by behaviour, on a directory, below.
        //
        // Windows has no `O_NONBLOCK` and no FIFO an `open` reaches, so the runner
        // asks for `0` there and the open is the one it always had.
        asksForANonBlockingOpen: () => {
            if (process.platform === 'win32') { return }
            assert((readFlags & fsConstants.O_NONBLOCK) !== 0, readFlags)
        },
        // **A directory is never readable as a file, and the two families of host
        // say so differently.** POSIX opens one and fails the *read* with `EISDIR`,
        // measured on Darwin with Node 26.8.1; Windows refuses the **open** with
        // the same code. `fjs/web` maps both to `404` — the `fstat` answers the
        // first and `openFailure` the second — so what is asserted here is the
        // property both shapes have to give it, and a third shape (an open that
        // succeeds and an `fstat` that calls a directory a file) fails.
        //
        // Per platform rather than skipped, because a proof that runs nowhere says
        // nothing about the platform it was skipped on.
        aDirectoryIsNeverAFile: () => withTemporary('fjs-handle-dir-', async root => {
            /** @type {(opened: Result<Handle, IoChannel>) => Effect<NodeOp, _DirectoryAnswer, IoChannel>} */
            const ask = opened => {
                if (opened[0] === 'error') {
                    /** @type {Effect<NodeOp, _DirectoryAnswer, IoChannel>} */
                    const refused = pureOk({ refused: opened[1], stats: null, read: null })
                    return refused
                }
                const handle = opened[1]
                /** @type {Effect<NodeOp, _DirectoryAnswer, IoChannel>} */
                const described = step(fstat(handle), stats =>
                    resultStep(pread(handle, 0, 8), read =>
                        step(close(handle), () => pureOk({ refused: null, stats, read }))))
                return described
            }
            await hostCheck(resultStep(open(root), ask), result => {
                const { refused, stats, read } = unwrap(result)
                if (refused !== null) {
                    // Windows refuses the open. The code is the one `fjs/web`
                    // maps, which is what keeps the `404` the same on both
                    // families of host.
                    assert(refused[0] === 'ioError', refused)
                    assertEq(refused[1].code, 'EISDIR')
                    return
                }
                // POSIX opens it and fails the read.
                assert(stats !== null, stats)
                assert(read !== null, read)
                assertEq(stats.isDirectory, true)
                assertEq(stats.isFile, false)
                assert(read[0] === 'error', read)
                assert(read[1][0] === 'ioError', read[1])
                assertEq(read[1][1].code, 'EISDIR')
            })
        }),
        // Reading through a handle that was given back is `EBADF`, and a second
        // close is `ok` — the two answers the virtual runner copies, so that a
        // caller's branch for either is reachable on both.
        afterClose: () => withTemporary('fjs-handle-closed-', async root => {
            const path = join(root, 'a.bin')
            await writeFile(path, 'abc')
            await hostCheck(step(open(path), handle =>
                step(close(handle), () =>
                    resultStep(pread(handle, 0, 1), first =>
                        resultMapStep(close(handle), again => ok([first, again]))))),
                result => {
                    const [first, again] = unwrap(result)
                    assert(first[0] === 'error', first)
                    assert(first[1][0] === 'ioError', first[1])
                    assertEq(first[1][1].code, 'EBADF')
                    assertEq(again[0], 'ok', again)
                })
        }),
        // **The numbers a read refuses, asked of the host because the host is the
        // side that used to answer them.** `Buffer.alloc` truncates a fractional
        // size instead of refusing it — measured on Node 23.11.0,
        // `Buffer.alloc(1.5)` is one byte long — so a size of `1.5` read one byte
        // here and said nothing, where the virtual runner refused the same call.
        // An offset past the last addressable byte is the mirror of it: Node's own
        // `read` refuses that one, `ERR_OUT_OF_RANGE`, where the virtual runner
        // answered a plausible empty read.
        //
        // Both now go through `windowRefusal`, before the allocation and before
        // the read, so the two runners refuse the same numbers **in the same
        // words** — which is what a proof written against either can rely on.
        // `./proof.f.mjs` (`windowRefusal`) holds the words; this is the host
        // producing them.
        refusesAWindowNoHostCanRead: () => withTemporary('fjs-handle-window-', async root => {
            const path = join(root, 'a.bin')
            await writeFile(path, 'abc')
            // Both positional reads, because both allocate the buffer the same way
            // and a bound asked in one of them is a bound the other reads through.
            /** @type {(offset: number, size: number) => Effect<NodeOp, Result<Vec, IoChannel>, IoChannel>} */
            const throughHandle = (offset, size) => step(open(path), handle =>
                resultStep(pread(handle, offset, size), taken =>
                    step(close(handle), () => pureOk(taken))))
            /** @type {(offset: number, size: number) => Effect<NodeOp, Result<Vec, IoChannel>, IoChannel>} */
            const throughName = (offset, size) => resultStep(readBytes(path, offset, size), pureOk)
            /** @type {(offset: number, size: number, message: string) => Promise<void>} */
            const refuses = async (offset, size, message) => {
                for (const read of [throughHandle, throughName]) {
                    await hostCheck(read(offset, size), result => {
                        const taken = unwrap(result)
                        assert(taken[0] === 'error', taken)
                        assert(taken[1][0] === 'ioError', taken[1])
                        assertEq(taken[1][1].message, message)
                    })
                }
            }
            await refuses(0, 1.5, 'Chunk size 1.5 is not an integer')
            await refuses(1.5, 1, 'Offset 1.5 is not an integer')
            await refuses(-1, 1, 'Offset -1 is negative')
            await refuses(0, -1, 'Chunk size -1 is negative')
            await refuses(
                maxOffset + 1, 1,
                `Offset ${maxOffset + 1} exceeds maximum allowed offset of ${maxOffset}`)
            await refuses(
                0, Number(maxLengthBytes) + 1,
                `Chunk size ${Number(maxLengthBytes) + 1} exceeds maximum allowed size of ${maxLengthBytes} bytes`)
            // And the largest offset a read may name is not refused: it is an
            // ordinary read past the end of a short file, which answers nothing.
            for (const read of [throughHandle, throughName]) {
                await hostCheck(read(maxOffset, 1), result => {
                    const taken = unwrap(result)
                    assertEq(taken[0], 'ok', taken)
                    assertEq(length(unwrap(taken)), 0n)
                })
            }
        }),
    },
    createServer: {
        // The runner pulls a chunk list a cell at a time, so a body of more
        // than one `Vec` reaches the client whole — the half of
        // [#1819](https://github.com/functionalscript/functionalscript/issues/1819)
        // that is the runner's rather than `fjs/web`'s.
        //
        // **It runs on every runtime**, where it used to run on Node alone. What
        // it used to claim was that *Node* drops a `HEAD` body, which is a claim
        // about a host; what it claims now is that the runner writes what it
        // pulled, which is the same code on all three. Every property the pump
        // leans on was measured identical across Node 26.8.1, Bun 1.4.2 and Deno
        // 2.8.3 — see the table in `./todo/streaming-http-bodies.md`.
        writesEveryChunk: async () => {
            const pulls = counter()
            const releases = counter()
            const answer = await withServer(
                () => pureOk({
                    status: 200,
                    headers: { 'content-length': `${3 * oneVec}` },
                    body: lazyBody(vecChunk, 3, pulls),
                    release: counting(releases),
                }),
                port => within('a three-chunk body', 10000, answered(port, 'GET')))
            assertEq(answer.status, 200)
            assertEq(answer.length, `${3 * oneVec}`)
            assertEq(answer.ending, 'end')
            assertEq(answer.body.length, 3 * oneVec)
            assertEq(answer.body.findIndex(b => b !== 7), -1)
            // Four pulls: three cells and the end.
            assertEq(pulls.n, 4)
            assertEq(releases.n, 1)
        },
        // **A request body larger than one `Vec` arrives whole and in order**,
        // which is the half of
        // [#1819](https://github.com/functionalscript/functionalscript/issues/1819)
        // the *request* direction owns. The same request used to be answered
        // `413` without the listener seeing it, because `IncomingMessage.body`
        // was one `Vec` and 132,096 bytes could not be one; `200` here is that
        // refusal gone.
        //
        // More than two chunks, checked, because a proof that never crosses a
        // chunk boundary proves nothing about the cap it claims to lift. The
        // fixture steps modulo a prime for the reason `unalignedBytes` gives:
        // a pattern repeating every 256 bytes survives a reordered chunk list.
        readsARequestBodyPastOneVec: async () => {
            if (!isNode()) { return }
            const sent = unalignedBytes(Number(maxLengthBytes) * 2 + 1024)
            await withServer(echoBody, async port => {
                const agent = new http.Agent({ keepAlive: false })
                const answer = await overAnAgent(port, 'POST', sent, agent)
                assertEq(answer.status, 200)
                assert(Number(answer.chunks) > 2, answer.chunks)
                assertSameBytes([...answer.body], [...sent])
                agent.destroy()
            })
        },
        // **A body the listener did not read closes the connection**, and the
        // client is told rather than cut off: the whole answer arrives, carrying
        // `connection: close`, and the next request over the same keep-alive
        // agent takes a fresh socket. Draining the remainder is the alternative
        // Node itself takes — its `resOnFinish` dumps an unconsumed body — and
        // it reads bytes this server has already decided not to use, which is
        // the argument `respondWith` makes for the runner's own refusals.
        //
        // The body is past the socket's high-water mark on purpose: that is what
        // leaves Node's parser paused with bytes still to come, so `req.complete`
        // is `false` for a reason the timing cannot take away.
        anUnreadBodyClosesTheConnection: async () => {
            if (!isNode()) { return }
            await withServer(ignoresBody, async port => {
                const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
                const first = await overAnAgent(port, 'POST', unalignedBytes(300000), agent)
                assertEq(first.status, 200)
                assertEq(first.connection, 'close')
                const second = await overAnAgent(port, 'GET', null, agent)
                assertEq(second.status, 200)
                assertEq(second.reused, false)
                agent.destroy()
            })
        },
        // **And a request with nothing left to read keeps its connection**,
        // which is the half that makes the close above a policy rather than a
        // regression. `fjs/web` answers `GET`s that carry no body at all, and a
        // server that closed after every one of them would cost a page one
        // connection per module it imports — the very case
        // [#1819](https://github.com/functionalscript/functionalscript/issues/1819)
        // was reported from.
        //
        // `req.complete` is `false` at the listener's first statement even for a
        // bodiless `GET` — message-complete has not been reached yet — so this is
        // also the proof that the runner reads that flag late enough. A body the
        // listener drains keeps the connection for the same reason: there is
        // nothing left on the wire.
        aReadBodyKeepsTheConnection: async () => {
            if (!isNode()) { return }
            await withServer(echoBody, async port => {
                const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
                const first = await overAnAgent(port, 'GET', null, agent)
                assertEq(first.status, 200)
                assertEq(first.connection, 'keep-alive')
                const second = await overAnAgent(port, 'GET', null, agent)
                assertEq(second.reused, true)
                const drained = await overAnAgent(port, 'POST', unalignedBytes(300000), agent)
                assertEq(drained.status, 200)
                assertEq(drained.connection, 'keep-alive')
                assertEq(drained.reused, true)
                agent.destroy()
            })
        },
        // **A listener asking to keep the connection does not get to keep it
        // over an unread body.** This is neither of the two above: the request
        // arrives with bytes still to come, as in the close, and the answer
        // names `connection: keep-alive`, as in the keep — the listener
        // contradicting the runner's own policy about a body only the runner can
        // see. The runner's close wins, and the client is told `close` on a
        // response the listener labelled `keep-alive`.
        //
        // It used to lose. The listener's headers were handed to
        // `writeHead(status, outHeaders)`, which applies them one `setHeader` at
        // a time over whatever is pending, so the listener's `keep-alive`
        // arrived last and replaced the close — a `200` carrying `keep-alive` on
        // a socket the server then held for the rest of a body it would never
        // read. A client declaring 300,000 bytes and sending 1,000 kept one that
        // way until the request timeout.
        //
        // **`x-chunks` is here to pin what the override does *not* touch.** Only
        // `connection` is replaced; every other header the listener asked for
        // goes out as it asked for it, and a runner that dropped them to win the
        // argument would be worse than the defect.
        aKeepAliveListenerStillCloses: async () => {
            if (!isNode()) { return }
            await withServer(keepsAliveIgnoringBody, async port => {
                const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
                const first = await overAnAgent(port, 'POST', unalignedBytes(300000), agent)
                assertEq(first.status, 200)
                assertEq(first.connection, 'close')
                assertEq(first.chunks, 'kept')
                const second = await overAnAgent(port, 'GET', null, agent)
                assertEq(second.status, 200)
                assertEq(second.reused, false)
                agent.destroy()
            })
        },
        // **A cell pulled twice is refused over a real socket too**, with the
        // message the virtual runner refuses it with. The bytes behind a
        // socket's position are gone, so the only thing a second pull of the same
        // cell could be answered with is whatever comes next — a body no client
        // sent, arriving in order and under a correct length. The two runners
        // share the message so a program that meets this refusal in a proof
        // meets the same words here.
        refusesARePull: async () => {
            if (!isNode()) { return }
            /** @type {Erl<ReadRequestBytes>} */
            const rePull = ({ body }) => resultMapStep(
                step(body, () => step(body, () => pureOk(undefined))),
                r => {
                    const message = r[0] === 'ok' ? 'no refusal' : errorMessage(r[1])
                    const bytes = new TextEncoder().encode(message)
                    return ok({
                        status: 500,
                        headers: { 'content-length': `${bytes.length}` },
                        body: ofChunks([toVec(bytes)]),
                        release: holdsNothing,
                    })
                })
            await withServer(rePull, async port => {
                const agent = new http.Agent({ keepAlive: false })
                const answer = await overAnAgent(port, 'POST', unalignedBytes(64), agent)
                assertEq(answer.status, 500)
                assertEq(new TextDecoder().decode(answer.body), requestBodyOffsetMessage(0, 64))
                agent.destroy()
            })
        },
        // **Two pulls of one cell *at the same time* are refused too**, and this
        // is the case `all` reaches that a sequential re-pull does not. The Node
        // runner's `all` is `Promise.all`: it starts every effect before it
        // awaits any, so both pulls used to read the cursor before either
        // advanced it, pass, and come back with successive chunks — two `ok`s
        // from one immutable cell, carrying different bytes, and nothing
        // downstream able to tell which half of the body it had. The virtual
        // runner threads its state through `all` and always refused this, so the
        // host was the odd one out.
        //
        // The body is past the socket's high-water mark so that the loser is
        // refused *bytes* rather than an end-of-stream: a body small enough to
        // arrive in one chunk would let a second pull answer `end` and prove
        // nothing about the splice.
        //
        // The refusal is read off the winner's own length rather than written
        // down here, because Node's first chunk carries the headers with it and
        // its size is not a constant. The third pull is the winner's tail, and it
        // has to succeed: what the loser met is its own refusal, not the body's.
        refusesAConcurrentPull: async () => {
            if (!isNode()) { return }
            await withServer(concurrentPulls, async port => {
                const agent = new http.Agent({ keepAlive: false })
                const answer = await overAnAgent(port, 'POST', unalignedBytes(300000), agent)
                assertEq(answer.status, 500)
                const [one = '', two = '', tail = ''] = new TextDecoder().decode(answer.body).split(' | ')
                const won = one.startsWith('ok ') ? one : two
                const lost = one.startsWith('ok ') ? two : one
                assert(won.startsWith('ok '), won)
                const taken = Number(won.slice(3))
                assert(taken > 0, taken)
                assertEq(lost, `error ${requestBodyOffsetMessage(0, taken)}`)
                assert(tail.startsWith('ok '), tail)
                agent.destroy()
            })
        },
        // **A client that vanished mid-body goes on being a failure**, rather
        // than becoming the end of the body on the next pull.
        //
        // A client that declares 300,000 bytes, sends 1,000 and cuts the
        // connection rejects the pull that was waiting for the rest — that much
        // was already right. What was wrong is the pull *after* it. A listener
        // may catch an `IoChannel` failure and pull the same cell again, because
        // a `List`'s tail is a value and nothing makes a consumer stop; Node's
        // iterator answers `done` to every call after the one that threw, and
        // `done` is how this stream says *end*. So the retry read the body as
        // complete at 1,000 bytes: a truncated prefix, in order, under a
        // `Content-Length` a thousandth of what arrived, with nothing left
        // anywhere to say the client never finished sending. That is DESIGN
        // §10's plausible wrong value, and the fix is that a failure of the
        // stream belongs to the body rather than to the pull, so the retry meets
        // it again, word for word.
        //
        // **The words are the host's own and are not written down here.** What
        // the retry gets is the very failure the first pull got, so the proof
        // compares the two rather than naming either — an abort reads
        // `ECONNRESET`/`aborted` on Darwin with Node 23.11.0, and a proof that
        // spelled that out would be about the version and not about the rule.
        //
        // The offset refusal is deliberately *not* sticky like this; it belongs
        // to the pull that named the wrong offset, and
        // {@link proof.createServer.refusesAConcurrentPull}'s third pull is what
        // holds that apart.
        refusesARetryAfterAnAbort: async () => {
            if (!isNode()) { return }
            /** @type {() => void} */
            let reading = () => { }
            /** @type {Promise<void>} */
            const started = new Promise(resolve => { reading = () => resolve(undefined) })
            /** @type {(text: string) => void} */
            let saw = () => { }
            /** @type {Promise<string>} */
            const seen = new Promise(resolve => { saw = resolve })
            const listener = retriesAFailedPull(reading, saw)
            await withServer(listener, async port => {
                const request = http.request({
                    host: loopback,
                    port,
                    method: 'POST',
                    path: '/',
                    headers: { 'content-length': '300000' },
                })
                // The socket dies under the listener, so the answer never
                // reaches the client and the client's own write fails. Both are
                // the point rather than a problem: what the listener saw comes
                // back through `seen`.
                request.on('error', () => undefined)
                request.write(bytes(1000))
                await started
                request.destroy()
                const [failed = '', retry = ''] = (await seen).split(' | ')
                assert(failed.startsWith('error '), failed)
                assertEq(retry, failed)
            })
        },
        // **Gate 2: the body is never pulled.** `res.write` on a `HEAD`, a `204`,
        // a `304` or a `1xx` response does not merely discard the bytes — it
        // answers `true`, measured on all three runtimes — so the socket stops
        // being a brake in exactly the cases where there is nothing to brake, and
        // a method-agnostic pump would read a multi-gigabyte file at the speed of
        // the disk to send nothing. The runner declines before Node is offered a
        // byte, and the declared length still arrives, which is the one thing a
        // `HEAD` is asked for.
        suppressesABodyNodeWillNotCarry: async () => {
            const pulls = counter()
            const releases = counter()
            const answer = await withServer(
                () => pureOk({
                    status: 200,
                    headers: { 'content-length': `${oneVec}` },
                    body: lazyBody(vecChunk, 1, pulls),
                    release: counting(releases),
                }),
                port => within('a HEAD response', 10000, answered(port, 'HEAD')))
            assertEq(answer.status, 200)
            assertEq(answer.length, `${oneVec}`)
            assertEq(answer.body.length, 0)
            assertEq(answer.ending, 'end')
            // The producer was never asked, so a multi-gigabyte body costs
            // nothing here — which the old, method-agnostic runner could not say.
            assertEq(pulls.n, 0)
            assertEq(releases.n, 1)
        },
        // **The memory bound, proved rather than asserted.** The client asks and
        // then reads nothing, so the socket is the only thing that can slow the
        // writes: `res.write` answers `false` on the first 128 KiB — the default
        // high-water mark being 16 KiB, measured `false` on all three runtimes —
        // and a pump that pulled anyway would be throttled by the disk rather than
        // by the client, which is fast enough to be no throttle at all.
        //
        // **What makes this a bound is the second body, not the first.** How many
        // chunks a parked pump has taken is the platform's socket buffers, and a
        // proof naming a figure would be pinning those. So the same parked client
        // is offered a body ten times longer, and the claim is that the count does
        // not follow: the pull count is what the process holds, one `Vec` a pull,
        // so a count that is the same for 25 MiB and 250 MiB is a footprint that
        // does not grow with the file. An eager runner answers two hundred and two
        // thousand.
        //
        // And the client's departure is what ends the pump, since `drain` never
        // comes for a socket that has gone — so `release` runs there too.
        pullsAtTheSocketsPace: async () => {
            /** @type {(chunks: number) => Promise<readonly[number, number]>} */
            const parked = async chunks => {
                const pulls = counter()
                const releases = counter()
                const held = await withServer(
                    () => pureOk({
                        status: 200,
                        headers: { 'content-length': `${chunks * oneVec}` },
                        body: lazyBody(vecChunk, chunks, pulls),
                        release: counting(releases),
                    }),
                    port => within('a parked pump', 20000, new Promise(resolve => {
                        const socket = net.connect(port, loopback, () => {
                            socket.write('GET / HTTP/1.1\r\nHost: x\r\n\r\n')
                        })
                        socket.pause()
                        socket.on('error', () => { })
                        // Long enough for a pump that ignored `false` to be well
                        // into a body it should not have touched, and short enough
                        // that two runs of this fit inside the five seconds Bun's
                        // test runner gives one proof.
                        setTimeout(async () => {
                            const taken = pulls.n
                            socket.destroy()
                            // Give the recorded `close` its chance to end the
                            // parked pull, which is the other half of this proof.
                            await reaches(releases, 1)
                            resolve([taken, releases.n])
                        }, 500)
                    })))
                return held
            }
            const [small, smallReleases] = await parked(200)
            const [large, largeReleases] = await parked(2000)
            // Parked, not finished: an eager pump answers the cell count itself.
            assert(small > 0 && small < 200, small)
            // And ten times the body is not ten times the memory. Four chunks of
            // slack for a machine that drained a little more in the same 900 ms.
            assert(large <= small + 4, [small, large])
            // `release` ran on the client's departure, once, on both.
            assertEq(smallReleases, 1)
            assertEq(largeReleases, 1)
        },
        // **A `close` that fired before the pump existed.** The listener holds
        // something before it has a status to return — `fjs/web` opens a handle
        // and `fstat`s it — so a cancelled download arriving a few milliseconds
        // earlier closes the response while nothing is watching. `drain` does not
        // come for a socket that has gone and `close` does not come twice, so a
        // pump that listened for the edge would park for the life of the process,
        // holding its reads open and never running `release`.
        //
        // Recording the closure is what makes this the same case as a client that
        // leaves mid-body rather than a second policy beside it: the response is
        // not answered at all, and `release` runs at the moment the listener
        // returns.
        releasesAfterACloseThatBeatThePump: async () => {
            const pulls = counter()
            const releases = counter()
            await withServer(
                // `resultStep`, not `step`: a `RequestListener`'s channel is
                // `never`, and the wait below can answer `notImplemented` on a
                // runner without it — which is a response frame like any other.
                () => resultStep(
                    // The listener takes its time, as one that opens a file and
                    // stats it does. `await` is the only operation here that can
                    // wait for a clock.
                    awaitIfPromise(new Promise(resolve => setTimeout(resolve, 400))),
                    () => pureOk({
                        status: 200,
                        headers: { 'content-length': `${oneVec}` },
                        body: lazyBody(vecChunk, 1, pulls),
                        release: counting(releases),
                    })),
                port => within('a request the client abandoned', 10000, new Promise(resolve => {
                    const socket = net.connect(port, loopback, () => {
                        socket.write('GET / HTTP/1.1\r\nHost: x\r\n\r\n')
                    })
                    socket.on('error', () => { })
                    // Well before the listener returns.
                    setTimeout(() => { socket.destroy() }, 60)
                    reaches(releases, 1).then(() => resolve(undefined))
                })))
            // Nothing was written and nothing was read: a status written to a
            // client that has gone silently sets `headersSent`, which is the flag
            // `failSafe` reads to decide a status is no longer available.
            assertEq(pulls.n, 0)
            assertEq(releases.n, 1)
        },
        // **The count, in the direction the host does catch — eventually, and by
        // then it has lost two responses.** Measured without the count: a response
        // declaring 131,072 bytes and writing 1,000 more put all 132,072 on the
        // wire, `res.write` answered `false` for the surplus exactly as it had for
        // the chunk before it, and the keep-alive client failed
        // `HPE_INVALID_CONSTANT` on the **in-flight** response — the surplus parsed
        // as the following status line, so the request being answered was lost
        // along with the one after it.
        //
        // With the count, a chunk that would carry the body past the declared
        // length is a failed cell: none of it is written, whole or in part. Writing
        // its first `bound − written` bytes and ending cleanly is the other choice
        // and the wrong one, because a body exactly as long as it promised is a
        // body every client reads as whole.
        //
        // Two cases, and they differ in where the bound falls. A length the chunks
        // reach **exactly** is a complete answer, and the surplus simply never
        // goes out. A length that falls **inside** a chunk leaves the body short,
        // over a socket no client can read a whole body from — `ECONNRESET`, so the
        // client is told rather than misled.
        overrunDestroys: async () => {
            /** @type {(declared: number) => Promise<{ readonly body: Uint8Array, readonly ending: string, readonly pulls: number, readonly releases: number }>} */
            const offering = async declared => {
                const releases = counter()
                const pulls = counter()
                const answer = await withServer(
                    () => pureOk({
                        status: 200,
                        headers: { 'content-length': `${declared}` },
                        body: lazyBody(vecChunk, 2, pulls),
                        release: counting(releases),
                    }),
                    port => within('an overrunning body', 10000, answered(port, 'GET')))
                return { body: answer.body, ending: answer.ending, pulls: pulls.n, releases: releases.n }
            }
            // The declared length is one chunk, and the producer has two. The
            // first fills it, the second is refused, and nothing beyond the
            // promised count reaches the wire.
            const exact = await offering(oneVec)
            assertEq(exact.body.length, oneVec)
            assertEq(exact.ending, 'end')
            // The second cell was pulled and refused, not left unasked.
            assertEq(exact.pulls, 2)
            assertEq(exact.releases, 1)
            // And a length that falls inside the second chunk: 65,536 of it would
            // fit, and none of it is written.
            const inside = await offering(oneVec + oneVec / 2)
            assertEq(inside.body.length, oneVec)
            assertEq(inside.ending, 'ECONNRESET')
            assertEq(inside.releases, 1)
        },
        // **And in the direction it does not.** A body that simply stops leaves
        // nothing for the server side to notice: measured on Darwin against Node
        // 26.8.1, Bun 1.4.2 and Deno 2.8.3 alike, `res.end()` short of a declared
        // length raises nothing, `writableFinished` never becomes `true`, and the
        // client is told nothing for as long as it waits.
        //
        // **The timing is the assertion, not the code.** A client eventually gets
        // an `ECONNRESET` either way — the server's idle timeout delivers one about
        // six seconds in, measured here by removing the check — so a proof that
        // only watched *what* the client saw would pass on a runner that did
        // nothing at all. What destroying buys is that the client is told **at
        // once**, while it can still act on it, so that is what is measured.
        underrunDestroys: async () => {
            const releases = counter()
            const pulls = counter()
            const answer = await withServer(
                () => pureOk({
                    status: 200,
                    headers: { 'content-length': `${2 * oneVec}` },
                    body: lazyBody(vecChunk, 1, pulls),
                    release: counting(releases),
                }),
                port => within('a body that ended early', 10000, answered(port, 'GET')))
            assertEq(answer.ending, 'ECONNRESET')
            assertEq(answer.body.length, oneVec)
            // Immediately, not at the idle timeout. Two seconds is a third of the
            // measured timeout and many times the millisecond a destroy takes, so
            // the margin is the machine's rather than the claim's.
            assert(answer.ms < 2000, answer.ms)
            assertEq(releases.n, 1)
        },
        // A cell that **fails** after the headers are written destroys too, for
        // the reason the table in `./todo/streaming-http-bodies.md` gives: under
        // chunked framing `res.end()` writes the terminating chunk, so a
        // truncated body arrives as a clean, complete one and no client can tell.
        failedCellDestroys: async () => {
            const releases = counter()
            const answer = await withServer(
                () => pureOk({
                    status: 200,
                    headers: {},
                    body: nonEmpty(vecChunk, pureError(ioError({ code: 'EIO', message: 'disk' }))),
                    release: counting(releases),
                }),
                port => within('a failing body', 10000, answered(port, 'GET')))
            assertEq(answer.ending, 'ECONNRESET')
            assertEq(answer.body.length, oneVec)
            assertEq(releases.n, 1)
        },
        // A continuation that **throws** is the same lie reached by the other
        // door: it never reaches the pump's policy, it reaches `failSafe`, whose
        // `headersSent` branch used to answer `res.end()`. So that branch destroys
        // too — and `release` has already run by then, because the `finally` that
        // runs it is inside the `catch` that leads there.
        throwingCellDestroys: async () => {
            const releases = counter()
            const answer = await withServer(
                () => pureOk({
                    status: 200,
                    headers: {},
                    body: nonEmpty(vecChunk, () => { throw new Error('thrown from a cell') }),
                    release: counting(releases),
                }),
                port => within('a throwing body', 10000, answered(port, 'GET')))
            assertEq(answer.ending, 'ECONNRESET')
            assertEq(answer.body.length, oneVec)
            assertEq(releases.n, 1)
        },
        // **Gate 1**, on the host: a listener that writes a `Transfer-Encoding` is
        // refused before the headers, with the frame both runners share. Node
        // takes such a header over its own default and reads it with a regular
        // expression — `x-chunked` and `chunked, gzip` both make it chunk a body
        // no client de-chunks — so restating the rule would be wrong in the cases
        // it was written for.
        refusesAListenersFraming: async () => {
            const pulls = counter()
            const releases = counter()
            const answer = await withServer(
                () => pureOk({
                    status: 200,
                    headers: { 'transfer-encoding': 'chunked', 'content-length': `${oneVec}` },
                    body: lazyBody(vecChunk, 1, pulls),
                    release: counting(releases),
                }),
                port => within('a refused framing header', 10000, answered(port, 'GET')))
            assertEq(answer.status, 500)
            assertEq(`${Buffer.from(answer.body)}`, `${framingHeaderMessage}\n`)
            assertEq(pulls.n, 0)
            assertEq(releases.n, 1)
        },
        // **Gate 4**, on the host, and the client's side of it. A listener that
        // spells one header two ways has the later value go out and the earlier one
        // vanish: `setHeader` keeps Node's pending headers under lower-cased names,
        // so the last one applied is the one on the wire, while a runner reading the
        // first would count the body against the other.
        //
        // Measured on Darwin with Node 23.11.0 against this very listener with the
        // gate taken out: `content-length: 2` on the wire, **one** byte after it,
        // and then the client waiting — six seconds of nothing, ended by
        // `ECONNRESET` when the server's idle timeout cut a socket it had put back
        // in the keep-alive pool. `ending` is asserted for that reason: it is the
        // client's side of the defect, where the status alone is only the runner's.
        // A pipelined client fares worse still, since the missing byte is the next
        // response's status line.
        refusesADoubledLength: async () => {
            const pulls = counter()
            const releases = counter()
            /** @type {Erl<NodeOp>} */
            const doubling = () => pureOk({
                status: 200,
                headers: { 'Content-Length': '1', 'content-length': '2' },
                body: lazyBody(toVec(new TextEncoder().encode('a')), 1, pulls),
                release: counting(releases),
            })
            const answer = await withServer(
                doubling,
                port => within('a refused doubled length', 10000, answered(port, 'GET')))
            assertEq(answer.status, 500)
            assertEq(`${Buffer.from(answer.body)}`, `${doubledLengthMessage}\n`)
            // The refusal's own length, not either of the listener's: a response the
            // gates turn down goes out as the runner's frame.
            assertEq(answer.length, `${doubledLengthMessage.length + 1}`)
            // **And the client reads it to the end**, which is what the defect took
            // away: as many bytes as the frame promised, ended rather than reset.
            assertEq(answer.ending, 'end')
            // The listener's body was never pulled, and it was given back anyway.
            assertEq(pulls.n, 0)
            assertEq(releases.n, 1)
            // **And the connection goes with the refusal**, which is what keeps a
            // keep-alive client off a socket this response has just been refused on:
            // the next request takes a fresh one instead of reading a frame nobody
            // vouched for.
            if (!isNode()) { return }
            await withServer(doubling, async port => {
                const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
                const first = await within(
                    'a refused doubled length over an agent', 10000, overAnAgent(port, 'GET', null, agent))
                assertEq(first.status, 500)
                assertEq(first.connection, 'close')
                const second = await within(
                    'a second request after a refused doubled length', 10000, overAnAgent(port, 'GET', null, agent))
                assertEq(second.status, 500)
                assertEq(second.reused, false)
                agent.destroy()
            })
        },
        // **Gate 3, and the gate order, over a raw HTTP/1.0 request** — raw
        // because Node's own client speaks 1.1 only, and 1.0 is the request whose
        // `useChunkedEncodingByDefault` is `false` on all three runtimes.
        //
        // A body with no `Content-Length` on such a request is delimited by the
        // connection closing, so a producer that failed mid-body would hand the
        // client a truncated body byte for byte identical to a whole one. It is
        // refused rather than answered.
        //
        // And a `HEAD` asking for the same thing is **not** refused: gate 2 comes
        // first, because that refusal exists to stop a truncated body from passing
        // for a whole one and a body Node drops is never on the wire to be
        // truncated. The other order answers `500` to a request this server can
        // satisfy exactly.
        gateOrderOverAnOldRequest: async () => {
            const pulls = counter()
            const releases = counter()
            /** @type {(method: string) => Promise<string>} */
            const raw = method => withServer(
                () => pureOk({
                    status: 200,
                    headers: {},
                    body: lazyBody(vecChunk, 1, pulls),
                    release: counting(releases),
                }),
                port => within(`a raw ${method} over HTTP/1.0`, 10000, new Promise(resolve => {
                    /** @type {Uint8Array[]} */
                    const parts = []
                    const socket = net.connect(port, loopback, () => {
                        socket.write(`${method} / HTTP/1.0\r\nHost: x\r\n\r\n`)
                    })
                    socket.on('data', part => { parts.push(Buffer.from(part)) })
                    socket.on('error', () => { })
                    socket.on('close', () => { resolve(`${Buffer.concat(parts)}`) })
                })))
            const refused = await raw('GET')
            assert(refused.startsWith('HTTP/1.1 500 '), refused)
            assert(refused.endsWith(`${unframedBodyMessage}\n`), refused)
            // The listener's own body was never pulled.
            assertEq(pulls.n, 0)
            assertEq(releases.n, 1)
            const suppressed = await raw('HEAD')
            assert(suppressed.startsWith('HTTP/1.1 200 '), suppressed)
            // No body, and nothing was read to produce one.
            assertEq(pulls.n, 0)
            assertEq(releases.n, 2)
        },
        // `chunkedResponse` is the host's own answer, and this is what it answers:
        // `true` for the HTTP/1.1 request a browser sends, `false` for a raw 1.0
        // one. Measured identical on Node 26.8.1, Bun 1.4.2 and Deno 2.8.3, which
        // is what makes gate 3 one field read in both runners rather than two
        // restatements of Node's rule.
        chunkedResponseIsTheHostsAnswer: async () => {
            /** @type {boolean[]} */
            const seen = []
            await withServer(
                ({ chunkedResponse }) => {
                    seen.push(chunkedResponse)
                    return pureOk({
                        status: 204,
                        headers: {},
                        body: listEnd(),
                        release: pureOk(null),
                    })
                },
                async port => {
                    await within('an HTTP/1.1 request', 10000, answered(port, 'GET'))
                    await within('a raw HTTP/1.0 request', 10000, new Promise(resolve => {
                        const socket = net.connect(port, loopback, () => {
                            socket.write('GET / HTTP/1.0\r\nHost: x\r\n\r\n')
                        })
                        socket.on('data', () => { })
                        socket.on('error', () => { })
                        socket.on('close', () => resolve(undefined))
                    }))
                })
            assertStructurallySame(seen, [true, false])
        },
    },
}
