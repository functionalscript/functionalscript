/**
 * Host proofs of the Node runner: the operations whose whole contract is
 * what the host does with them, driven against the real host. Each is a
 * `NodeProgram` run through `runEffect`, answering `0` where the host did
 * what the operation promises and a code naming what it did instead.
 *
 * Proofs that need a filesystem own a temporary tree and remove it in
 * `finally`, through {@link withTemporary}. They exercise the sibling host
 * runner; compiler traversal and diagnostics are proved synchronously in
 * `fsc/transpiler/proof.f.mjs`.
 *
 * @import { NodeProgram, NodeOp } from './types.ts'
 * @import { Effect, IoChannel } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import http from 'node:http'
import zlib from 'node:zlib'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { pureOk, resultMapStep, step } from '../module.f.mjs'
import { byteLength, maxLengthBytes, u8ListMsb, u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { asBase } from '../../types/nominal/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { toVec } from '../../types/uint8array/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { tagLoose, tagPayload } from '../../git/testlib.f.mjs'
import { createServer, inflate, inflateTrailingCode, listen, readWhole, resolveFileModule, rmdir, writeExclusive } from './module.f.mjs'
import { runEffect } from './module.mjs'

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
 * What a `method` request to a server the runner built came back with: the
 * status, the headers, and the bytes that reached the socket.
 *
 * **The server is closed by this function and not by the program**, because
 * there is no operation that closes one: a `NodeProgram` answers an exit code,
 * so the handle is taken out of it here and unwrapped to the `http.Server`
 * underneath. That reach-through is why this proof lives in the impure shell
 * beside the runner rather than in a `.f.mjs`.
 *
 * Port `0` asks the host for a free one — a fixed port makes a proof fail when
 * something else on the machine happens to hold it. `fjs web` refusing `0` is
 * its own command-line policy and not this operation's.
 *
 * @type {(chunks: readonly Vec[], method: string) => Promise<{ readonly status: number, readonly length: string, readonly body: Uint8Array }>}
 */
const answeredOverASocket = async (chunks, method) => {
    /** @type {(server: import('node:http').Server) => void} */
    let created = () => { }
    /** @type {Promise<import('node:http').Server>} */
    const held = new Promise(resolve => { created = resolve })
    /** @type {NodeProgram} */
    const program = () => resultMapStep(
        step(
            createServer(() => pureOk({
                status: 200,
                headers: { 'content-length': `${chunkLength(chunks)}` },
                body: chunks,
            })),
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
        return await new Promise((resolve, reject) => {
            const request = http.request(
                { host: loopback, port: address.port, method, path: '/' },
                response => {
                    let parts = /** @type {readonly Uint8Array[]} */ ([])
                    response.on('data', part => { parts = [...parts, part] })
                    response.on('end', () => resolve({
                        status: response.statusCode ?? 0,
                        length: `${response.headers['content-length']}`,
                        body: Buffer.concat(parts),
                    }))
                })
            request.on('error', reject)
            request.end()
        })
    } finally {
        await new Promise(resolve => { server.close(() => resolve(undefined)) })
    }
}

/**
 * Whether this run is the one whose host behaviour the HTTP proofs below are
 * about. They bind a real socket and read what Node does with a body it was
 * given; Bun and Deno answer the same operations through their own `node:http`,
 * which is a separate claim and not this runner's.
 *
 * @type {() => boolean}
 */
const isNode = () => !('Bun' in globalThis) && !('Deno' in globalThis)

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
            if (!('Bun' in globalThis) && !('Deno' in globalThis)) {
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
            if (!('Bun' in globalThis) && !('Deno' in globalThis)) {
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
    createServer: {
        // The runner writes a chunk list a chunk at a time, so a body of more
        // than one `Vec` reaches the client whole — the half of
        // [#1819](https://github.com/functionalscript/functionalscript/issues/1819)
        // that is the runner's rather than `fjs/web`'s.
        writesEveryChunk: async () => {
            if (!isNode()) { return }
            const chunks = [toVec(payload(1)), toVec(payload(2)), toVec(payload(3))]
            const answer = await answeredOverASocket(chunks, 'GET')
            assertEq(answer.status, 200)
            assertEq(answer.length, `${chunkLength(chunks)}`)
            assertSameBytes([...answer.body], chunkBytes(chunks))
        },
        // **Node is the party that drops a `HEAD` body**, and it goes on being
        // that party across as many writes as the body has: the runner offers
        // every chunk and the client receives none of them, while the
        // `Content-Length` the listener declared still arrives — which is the
        // one thing a `HEAD` is asked for. `fjs/web` answers a `HEAD` exactly
        // like a `GET` because of this.
        headCarriesNoBody: async () => {
            if (!isNode()) { return }
            const chunks = [toVec(payload(4)), toVec(payload(5)), toVec(payload(6))]
            const answer = await answeredOverASocket(chunks, 'HEAD')
            assertEq(answer.status, 200)
            assertEq(answer.length, `${chunkLength(chunks)}`)
            assertEq(answer.body.length, 0)
        },
    },
}
