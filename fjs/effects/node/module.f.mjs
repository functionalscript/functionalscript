/**
 * Node.js effect operations: filesystem (`mkdir`, `readFile`, `readdir`,
 * `writeFile`, `rm`, `access`, plus the `readUtf8File`/`writeUtf8File` text
 * helpers), networking (`fetch`, `createServer`, `listen`),
 * subprocess `exec`, `inflate`, `now` and `forever`; defines the `NodeOp`/`NodeProgram`
 * types used by the Node runner.
 *
 * The console family — `write`, `log`, `error`, `errorExit`, `read`,
 * `readLine` — together with `sandbox`, `catch_`, `import_` and the
 * `all`/`allOk`/`both` fan-out are re-exported from
 * [`../common`](../common/module.f.mjs) rather than declared here: an operation
 * belongs to the layer of whoever implements it, and none of these is Node's by
 * nature. A browser page dispatches `sandbox`, `catch` and `import`.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Commands, CommandSet, Effect, Func, NotImplemented, Operation } from '../types.ts'
 * @import { EffectList } from '../list/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Access, Await, Catch, ChildWait, Close, Console, CreateExclusive, CreateServer, Dirent, Engine, Env, Exec, ExecResult, Fetch, FileStat, Forever, Fstat, Fs, Handle, Headers, Http, IncomingMessage, Inflate, IoChannel, IoError, IoErrorInfo, Listen, MakeDirectoryOptions, Mkdir, Now, NodeOp, NodeProgramOptions, Open, Pread, RandomInt, Read, ReadBytes, ReadConsoles, ReadFile, ReadRequestBytes, RequestBody, ResolveFileModule, ReadWhole, Readdir, ReaddirOptions, RequestListener, Rename, Rm, Rmdir, Sandbox, SandboxResult, Server, ServerResponse, Spawn, Stat, Test, TestContext, TestFn, Write, WriteBytes, WriteConsoles, WriteExclusive, WriteFile, _ChunkSource, _DoubledLength, _FramingHeader, _Gate, _NoBody, _ReadChunks, _Unframed, _UtfList, _WriteLoop } from './types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { tryUtf8, utf8, utf8ToString } from '../../text/module.f.mjs'
import { concat } from '../../types/list/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { byteLength, bytesIn, isWholeBytes, isWholeBytesIn, length, maxLengthBytes, u8ListMsb } from '../../types/bit_vec/module.f.mjs'
import { nonEmpty, empty as elEmpty } from '../list/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { cmp as versionCmp } from '../../types/version/module.f.mjs'
import { do_, errorMessage, ioError, toIoError } from '../module.f.mjs'
import {
    all, allOk, both, catch_, error, errorExit, import_, log, read, readLine, sandbox, write,
} from '../common/module.f.mjs'
import {
    catchStep, mapStep as ioMapStep, pureError, pureOk, resultMapStep, resultStep, step as ioStep,
} from '../module.f.mjs'

/**
 * `errorMessage`, `ioError` and `toIoError` are declared in
 * [`../module.f.mjs`](../module.f.mjs) beside the effect representation,
 * because neither is node's: normalizing a thrown value into serializable
 * effect data is what any host's interpreter does at its `catch`. They are
 * re-exported here so the modules that reach for them through the node module
 * keep working, and so an operation's declaration and its failure constructor
 * still read as one vocabulary.
 *
 * {@link isNotFound} stayed, and the difference is the test for where any of
 * this belongs: it reads `ENOENT`, a POSIX filesystem code that no browser
 * ever reports. Being about a *host failure* does not make a thing
 * host-agnostic — being about no host in particular does.
 */
export { errorMessage, ioError, toIoError }

// `../common`'s, kept visible here because `NodeOp` unions them and dozens of
// call sites name them through this module — a live coupling, not a shim. An
// operation belongs to the layer of whoever implements it: a browser page
// dispatches `sandbox`, `catch` and `import`, and the rest are there because
// nothing about them is Node's. `../common/types.ts` keeps the count,
// and says how it counts.
export { all, allOk, both, catch_, error, errorExit, import_, log, read, readLine, sandbox, write }

/**
 * The host a {@link Listen} refuses.
 *
 * Node treats `''` exactly as it treats an omitted argument and binds the
 * unspecified address — measured on Linux with Node 22.22.2, where
 * `listen(0, '')` reports `0.0.0.0`, and on Darwin with Node 23.11.0, where it
 * reports `::`. **Which** unspecified address is the platform's business; that
 * it is one of them is universal. `Listen` takes the host precisely so that
 * an address is stated rather than inherited, and a missing configuration value
 * arriving as `''` inherits the widest one there is. Every runner refuses it, so
 * a program proven against the virtual one binds where the Node one binds.
 *
 * @type {string}
 */
export const emptyHost = ''

/**
 * Node's own code for an argument it rejects, reported here for a value Node
 * itself accepts: a caller reading `IoError.code` should not have to learn a
 * second vocabulary for a refusal that is the runner's own.
 *
 * @type {string}
 */
export const emptyHostCode = 'ERR_INVALID_ARG_VALUE'

/** Node's message shape for {@link emptyHostCode} — `The argument '<name>'
 * <reason>. Received <value>`.
 *
 * @type {string}
 */
export const emptyHostMessage = `The argument 'host' must not be empty. Received ''`

/**
 * The failure a runner reports for {@link emptyHost}.
 *
 * The virtual runner answers with this value and the Node runner throws an
 * `Error` carrying the same two literals, which is what keeps the two from
 * drifting apart on a refusal neither inherits from Node.
 *
 * @type {IoError}
 */
export const emptyHostError = ioError({
    code: emptyHostCode,
    message: emptyHostMessage,
})

/**
 * The largest port a number names: ports are 16 bits wide.
 *
 * @type {number}
 */
export const maxPort = 0xffff

/**
 * Whether `port` is one a host would accept: an integer in `0`–{@link maxPort},
 * where `0` asks for an ephemeral one. Node throws {@link badPortCode} for
 * anything else, and a runner that accepted `-1` or `NaN` would let a program
 * be proven that cannot run.
 *
 * Not `fjs/types/number`'s `isUintUpTo(maxPort)`, which refuses `-0`: this
 * states the host's contract, and Node's `Server.listen` takes `-0` as port
 * `0`. The native runner forwards a port to `listen` unchecked and only the
 * virtual runner gates on this, so refusing `-0` here would make the two
 * runners disagree.
 *
 * @type {(port: number) => boolean}
 */
export const isPort = port => Number.isInteger(port) && port >= 0 && port <= maxPort

/**
 * Node's code for a port {@link isPort} refuses.
 *
 * Unlike {@link emptyHostCode}, this refusal is Node's own: the Node runner
 * forwards the port and Node throws it, so only a runner without a socket
 * has to restate it.
 *
 * @type {string}
 */
export const badPortCode = 'ERR_SOCKET_BAD_PORT'

/**
 * Node's message for {@link badPortCode}, byte-for-byte, type included: a runner
 * that claims to report failures in the shape the host reports them makes a
 * claim that is not true with a message that is nearly right.
 *
 * @type {(port: number) => string}
 */
export const badPortMessage = port =>
    `options.port should be >= 0 and < 65536. Received type number (${port}).`

/**
 * True if `e` is a "file or directory does not exist" (`ENOENT`) error.
 *
 * Node's filesystem rejections are `Error`s carrying `code: 'ENOENT'`, which
 * {@link toIoError} keeps; the virtual interpreter reports the same code for
 * absent paths. Lets callers swallow only the missing-path case (e.g. a fresh
 * store) while propagating genuine failures (permissions, corruption) rather
 * than masking them.
 *
 * A {@link NotImplemented} is never "not found": a runner that cannot perform
 * the operation has not looked for the path at all, so the two must not
 * collapse into one benign branch — which is exactly what a bare `unknown`
 * error channel used to allow.
 *
 * **It belongs to this layer, unlike the constructors above.** `ENOENT` is a
 * POSIX filesystem code; a host without a filesystem never reports one, so a
 * shared `isNotFound` would be a node predicate wearing a host-agnostic name.
 *
 * @type {(e: IoChannel) => boolean}
 */
export const isNotFound = ([tag, payload]) =>
    tag === 'ioError' && payload.code === 'ENOENT'

/**
 * Whether a failure means the path leads nowhere rather than that the host is in
 * trouble: nothing at the other end of a link, or a link that leads to itself.
 *
 * The pair a caller wants after a `stat` of a *directory entry*, where the entry
 * exists — a listing named it — and following it is what failed. Node answers
 * `ENOENT` for a dangling link and `ELOOP` for a cycle, and both are entries
 * Git's own listings pass over: measured on Git 2.43.0 with
 * `refs/heads/dangling` linked to a name that is not there and
 * `refs/heads/loop` linked to itself, `git show-ref` and `git for-each-ref`
 * list neither and both exit 0.
 *
 * Those two and no others, which is the point of having it rather than catching
 * every failure: an entry a listing named and the host then cannot describe for
 * any other reason is a file the caller would be dropping in silence.
 *
 * Beside {@link isNotFound} and node's for the same reason — both read POSIX
 * codes no browser reports.
 *
 * @type {(e: IoChannel) => boolean}
 */
export const leadsNowhere = e => isNotFound(e) || (e[0] === 'ioError' && e[1].code === 'ELOOP')

/**
 * Whether a failure means **nothing is at this path**: the three POSIX codes a
 * path built from names can fail with before any file is reached.
 *
 * - `ENOENT` — no such name.
 * - `ENOTDIR` — a component of the path is not a directory, so no name below it
 *   can exist.
 * - `ELOOP` — the links cycle, so the path resolves to nothing.
 *
 * Wider than {@link leadsNowhere}, which answers about an entry a listing named
 * and is deliberately the two codes a `stat` of one can give. This answers about
 * a path a caller *spelled*, where a component may be a regular file the caller
 * never listed — `readFile('<a regular file>/ab/cdef')` is `ENOTDIR`, measured.
 *
 * **What it is for is telling absence from refusal.** A reader that builds a
 * path and finds one of these has learned the file is not there, which is a
 * different answer from `EACCES` or `EIO` — those mean the file may well be
 * there and the host will not say. Treating the first three as failures makes a
 * reader refuse where it should report nothing found.
 *
 * Beside {@link isNotFound} for the same reason: POSIX codes no browser reports.
 *
 * @type {(e: IoChannel) => boolean}
 */
export const namesNothing = e =>
    leadsNowhere(e) || (e[0] === 'ioError' && e[1].code === 'ENOTDIR')

/**
 * Whether a failure is a read of a *directory*.
 *
 * Node answers `EISDIR` for a `readFile` of one, and a caller that asked for a
 * file's contents by name often wants that to mean "no file here" rather than a
 * failure — `fjs/git/refstore` does, because a ref name can be both a packed
 * line and the directory the loose refs below it live in.
 *
 * Beside {@link isNotFound} for the same reason: a POSIX code no browser reports.
 *
 * @type {(e: IoChannel) => boolean}
 */
export const isDirectory = ([tag, payload]) =>
    tag === 'ioError' && payload.code === 'EISDIR'

/**
 * `NodeOp`'s commands as data, so a runner that implements only part of them
 * can still tell an operation it lacks from a `Do` node whose `command` was
 * never a `NodeOp` at all — see `CommandSet` in `../types.ts` for why the
 * distinction needs the set at runtime.
 *
 * Declared as a record because `CommandSet<NodeOp>` is checked for
 * *completeness*: adding a command to `NodeOp` and forgetting it here is a
 * compile error, where an array literal would only have its members checked and
 * would drift silently.
 *
 * @type {CommandSet<NodeOp>}
 */
const nodeCommandSet = {
    access: null, all: null, await: null, catch: null, childWait: null, close: null,
    createExclusive: null,
    createServer: null, exec: null, fetch: null, forever: null, fstat: null,
    import: null, inflate: null, listen: null, memCreate: null, memRead: null,
    memWrite: null, mkdir: null, now: null, open: null, pread: null,
    randomInt: null,
    read: null, readBytes: null, readFile: null, readRequestBytes: null,
    readWhole: null, readdir: null, rename: null, resolveFileModule: null,
    rm: null, rmdir: null, sandbox: null, spawn: null, stat: null,
    test: null, write: null, writeBytes: null, writeExclusive: null,
    writeFile: null,
}

/**
 * The commands of {@link nodeCommandSet}, in the form a partial runner tests
 * membership against. The cast is the one `Object.keys` always needs: it
 * answers `string[]` for a record whose keys the type system knows exactly.
 *
 * @type {Commands<NodeOp>}
 */
export const nodeCommands = /** @type {Commands<NodeOp>} */ (Object.keys(nodeCommandSet))

// `all`, `allOk` and `both` are `../common`'s, re-exported above: fan-out is an
// interpreter's job whoever the host is, which is the whole of why they are
// there — no browser implements them.

// fetch

/** @type {Func<Fetch>} */
export const fetch = do_('fetch')

// mkdir

/** @type {Func<Mkdir>} */
export const mkdir = do_('mkdir')

/** @type {Func<ResolveFileModule>} */
export const resolveFileModule = do_('resolveFileModule')

// readFile

/** @type {Func<ReadFile>} */
export const readFile = do_('readFile')

/**
 * Reads a file as UTF-8 text.
 *
 * Preserves the error channel instead of unwrapping so callers can
 * pattern-match on it (e.g. convert a failure into a domain-specific error) or
 * `unwrap` at the call site.
 *
 * @type {(path: string) => Effect<ReadFile, string, IoChannel>}
 */
export const readUtf8File = path =>
    ioMapStep(readFile(path), utf8ToString)

// readdir

/** @type {Func<Readdir>} */
export const readdir = do_('readdir')

/**
 * The refusal of a `Vec` that is not whole bytes, where bytes are what a host
 * is handed: {@link writeFile}, {@link inflate}, {@link writeExclusive} and
 * {@link writeBytes} each refuse one with it, ahead of the host, whose
 * conversion would pad the last byte and act on bytes that were never given.
 */
const invalidBufferSize = pureError(ioError({ message: 'invalid buffer size' }))

// writeFile

const writeFileOp = /** @type {Func<WriteFile>} */ (do_('writeFile'))

/**
 * Writes `data` to `path`, replacing what it held. A file holds bytes, so a
 * `Vec` that is not whole bytes is refused here as `invalid buffer size`,
 * before any host sees it, as {@link writeExclusive} refuses one.
 *
 * @type {Func<WriteFile>}
 */
export const writeFile = (path, data) =>
    isWholeBytes(data) ? writeFileOp(path, data) : invalidBufferSize

// rm

/** @type {Func<Rm>} */
export const rm = do_('rm')

// rmdir

/** @type {Func<Rmdir>} */
export const rmdir = do_('rmdir')

// rename

/** @type {Func<Rename>} */
export const rename = do_('rename')

// readBytes

/** @type {Func<ReadBytes>} */
export const readBytes = do_('readBytes')

// inflate

const inflateOp = /** @type {Func<Inflate>} */ (do_('inflate'))

/**
 * Inflates a zlib stream. The stream is bytes, so a `Vec` that is not
 * whole bytes is refused here as `invalid buffer size`, before any host
 * sees it, as {@link writeFile} refuses one: a host's conversion
 * would pad the last byte and read a stream that was never given.
 *
 * @type {Func<Inflate>}
 */
export const inflate = data =>
    isWholeBytes(data) ? inflateOp(data) : invalidBufferSize

/**
 * The code an {@link Inflate} refuses bytes after the end of the stream
 * with. zlib's own codes name a stream that is wrong; this names one that
 * is right and not alone, which zlib itself would read without a word,
 * and which is corruption to the one caller that hands it a file.
 *
 * @type {string}
 */
export const inflateTrailingCode = 'ERR_TRAILING_BYTES'

/**
 * The message beside {@link inflateTrailingCode}: how many bytes followed
 * the stream.
 *
 * @type {(count: number) => string}
 */
export const inflateTrailingMessage = count => `${count} bytes after the end of the zlib stream`

// randomInt

/** @type {Func<RandomInt>} */
export const randomInt = do_('randomInt')

// exec

/** @type {Func<Exec>} */
export const exec = do_('exec')

// spawn

/** @type {Func<Spawn>} */
export const spawn = do_('spawn')

/** @type {Func<ChildWait>} */
export const childWait = do_('childWait')

// access

/** @type {Func<Access>} */
export const access = do_('access')

// createExclusive

/** @type {Func<CreateExclusive>} */
export const createExclusive = do_('createExclusive')

// writeExclusive

const writeExclusiveOp = /** @type {Func<WriteExclusive>} */ (do_('writeExclusive'))

/**
 * Creates `path` and writes the chunks of `data` through that one open. A file
 * holds bytes, so a chunk that is not whole bytes is refused here as
 * `invalid buffer size`, before any host sees it, as {@link inflate} refuses
 * one: a host's conversion would pad its last byte, and the file would not hold
 * `data`.
 *
 * @type {Func<WriteExclusive>}
 */
export const writeExclusive = (path, data) =>
    data.every(isWholeBytes) ? writeExclusiveOp(path, data) : invalidBufferSize

/**
 * Creates `path` and writes `content` to it as UTF-8 bytes, through one open,
 * failing with `EEXIST` where the name is taken. The text form of
 * {@link writeExclusive}, as {@link writeUtf8File} is of {@link writeFile}.
 *
 * @type {(path: string, content: string) => Effect<WriteExclusive, void, IoChannel>}
 */
export const writeExclusiveUtf8File = (path, content) =>
    writeExclusive(path, [utf8(content)])

// writeBytes

const writeBytesOp = /** @type {Func<WriteBytes>} */ (do_('writeBytes'))

/**
 * Writes `data` into the existing `path` at byte `offset`. A `Vec` that is not
 * whole bytes is refused here as `invalid buffer size`, before any host sees
 * it, as {@link writeFile} refuses one.
 *
 * @type {Func<WriteBytes>}
 */
export const writeBytes = (path, offset, data) =>
    isWholeBytes(data) ? writeBytesOp(path, offset, data) : invalidBufferSize

/** @type {(path: string) => _WriteLoop} */
const writeLoop = path => {
    /** @type {_WriteLoop} */
    const f = (offset, e) =>
        ioStep(e, node => {
            if (node === undefined) {
                return pureOk(undefined)
            }
            const { first: v, tail } = node
            return ioStep(
                writeBytes(path, offset, v),
                () => f(offset + Number(byteLength(v)), tail))
        })
    return f
}

/**
 * Creates `path` and writes the byte stream `e` to it, chunk by chunk.
 *
 * **It fails closed.** Once `path` exists, any failure — of the stream itself,
 * of a chunk that is not whole bytes, of a `writeBytes` — removes it before
 * the error is returned, so a failed write leaves no partial file behind for
 * a later reader to mistake for the whole. The removal's own outcome is
 * discarded, as `fjs/cas`'s staging cleanup discards it: the write's error is
 * what the caller needs to hear, and a failed `rm` has no better answer.
 *
 * The removal names `path`, as every `writeBytes` before it does, so a file
 * put there by someone else mid-write is written into and then removed —
 * [write-from-stream-private-name.md](./todo/write-from-stream-private-name.md).
 *
 * @template {Operation} O
 * @param {string} path
 * @param {EffectList<O, Vec, IoChannel>} e
 * @returns {Effect<O | WriteBytes | CreateExclusive | Rm, void, IoChannel>}
 */
export const writeFromStream = (path, e) => {
    // Only what runs after `createExclusive` is cleaned up after: an `EEXIST`
    // is someone else's file, and removing it would be the failure's doing.
    const written = catchStep(
        writeLoop(path)(0, e),
        err => resultStep(rm(path), () => pureError(err)))
    return ioStep(createExclusive(path), () => written)
}

/** One chunk's worth of bytes: the `Vec` cap, which is what a chunk may not exceed. */
const chunkBytes = Number(maxLengthBytes)

/**
 * The most UTF-16 code units a piece has, less one, so that a piece of
 * `chunkUnits + 1` units always encodes to at most one `Vec`: a unit takes at
 * most three bytes, a surrogate pair four for its two. The extra unit is the
 * one a cut may take back, below.
 */
const chunkUnits = Math.floor(chunkBytes / 3) - 1

/** @type {(c: number) => boolean} */
const isHighSurrogate = c => c >= 0xd800 && c <= 0xdbff

/** @type {(c: number) => boolean} */
const isLowSurrogate = c => c >= 0xdc00 && c <= 0xdfff

/**
 * The pieces of `s`, each of at most `units + 1` code units: the cut after
 * `k * units` units, moved back one unit where it would fall between the two
 * halves of a surrogate pair, so that every piece is the text of whole code
 * points and encodes as UTF-8 on its own. Each cut depends on `s` alone, so the
 * pieces are built by index and not by recursion, and a text of any length has
 * as many as it needs. An empty text is one empty piece.
 *
 * @type {(units: number) => (s: string) => readonly string[]}
 */
export const _pieces = units => s => {
    /** @type {(k: number) => number} */
    const cutAt = k => {
        const at = k * units
        return at >= s.length ? s.length
            : isHighSurrogate(s.charCodeAt(at - 1)) && isLowSurrogate(s.charCodeAt(at)) ? at - 1 : at
    }
    return Array.from(
        { length: Math.max(1, Math.ceil(s.length / units)) },
        (_, k) => s.slice(cutAt(k), cutAt(k + 1)))
}

/**
 * The `Vec`s as a list of effects, one cell made when the writer asks for it, so
 * a list of any length is walked in constant stack.
 *
 * @type {(vs: readonly Vec[], i: number) => EffectList<WriteBytes, Vec, IoChannel>}
 */
export const _vecList = (vs, i) => () => ok(i < vs.length ? { first: vs[i], tail: _vecList(vs, i + 1) } : undefined)

/**
 * Writes a string to `path` as UTF-8 bytes, replacing what it held.
 *
 * A text whose UTF-8 fits one `Vec` is a single {@link writeFile}, however close
 * to the limit it comes. A larger one is encoded in pieces of at most one `Vec`
 * each, which is why its size is not bounded by a `Vec`'s: {@link writeFile}
 * takes the first piece and {@link writeBytes} each next at the offset where the
 * last ended. **A larger text fails closed**, as {@link writeFromStream} does:
 * once the first piece is written, a failure removes `path` before the error
 * is returned, so no truncated file is left behind for a reader to mistake for
 * the whole. The removal's own outcome is discarded.
 *
 * @type {(path: string, content: string) => Effect<WriteFile | WriteBytes | Rm, void, IoChannel>}
 */
export const writeUtf8File = (path, content) => {
    const whole = tryUtf8(content)
    if (whole !== null) { return writeFile(path, whole) }
    const [first, ...rest] = _pieces(chunkUnits)(content).map(utf8)
    const written = catchStep(
        writeLoop(path)(Number(byteLength(first)), _vecList(rest, 0)),
        err => resultStep(rm(path), () => pureError(err)))
    return ioStep(writeFile(path, first), () => written)
}

/**
 * The read mirror of {@link writeFromStream}: a byte stream from a chunk
 * source, each cell at most one `Vec` and the list itself uncapped.
 *
 * **It takes a source rather than a path.** `fjs/cas` reads by name safely —
 * a name in the store is its content's hash — while a served tree carries no
 * such guarantee and must read through something bound to one inode. A
 * parameter lets the two callers differ; a path would force one to wait for
 * the other.
 *
 * **Bounded, it advances by the length it got.** Both `fjs/cas` loops stepped
 * `offset + chunkBytes` whatever the read returned, which is sound only
 * because an unbounded fold ends at the first empty read — on a local regular
 * file a short read is the last one. Under a declared length a short chunk is
 * not the last, and a fixed step would leave a hole in a body whose size the
 * client has already been told.
 *
 * @type {_ReadChunks}
 */
export const readChunks = (source, bound) => {
    /**
     * What one answered chunk becomes: a refusal, the end, or a cell whose
     * tail continues from where this chunk actually reached.
     * @type {(chunk: Vec, offset: number) => EffectList<any, Vec, IoChannel>}
     */
    const cell = (chunk, offset) => {
        const bits = length(chunk)
        // A chunk that is not whole bytes is refused rather than rounded down.
        // `_ChunkSource`'s type permits one, and `bytesIn` would report a 1-bit
        // chunk as nought — an EOF the source never signalled, with the bits
        // thrown away. That is DESIGN §10's plausible wrong value.
        if (!isWholeBytesIn(bits)) {
            return pureError(ioError({ message: `chunk at ${offset} is ${bits} bits, not whole bytes` }))
        }
        const got = Number(bytesIn(bits))
        // An empty read ends an unbounded stream. Under a bound it is a file
        // that shrank mid-read: a truncated body under a declared length, so
        // it fails the cell instead of ending the stream short.
        if (got === 0) {
            return bound === null
                ? elEmpty()
                : pureError(ioError({ message: `read ended at ${offset} of ${bound} bytes` }))
        }
        return nonEmpty(chunk, loop(offset + got))
    }
    /** @type {(offset: number) => EffectList<any, Vec, IoChannel>} */
    const loop = offset => {
        const remaining = bound === null ? chunkBytes : bound - offset
        if (remaining <= 0) { return elEmpty() }
        // A source that performs a command suspends here, so the list is built
        // one cell per pull. A source that answers purely does not: `nonEmpty`
        // takes its tail as an ordinary argument (`../list/module.f.mjs`), so
        // the whole chain is constructed up front and a large bound overflows
        // the stack. That is the list representation's property, not this
        // loop's — every chunk source with a real host behind it is a command.
        return ioStep(source(offset, Math.min(chunkBytes, remaining)), chunk => cell(chunk, offset))
    }
    return loop(0)
}

// open, fstat, pread, close

/** @type {Func<Open>} */
export const open = do_('open')

/** @type {Func<Fstat>} */
export const fstat = do_('fstat')

/** @type {Func<Pread>} */
export const pread = do_('pread')

/** @type {Func<Close>} */
export const close = do_('close')

// The window a positional read names, read by both runners

/**
 * The largest byte a positional read may name. **Node's own limit, not a
 * choice**: measured on Darwin with Node 23.11.0, `FileHandle.read` at this
 * position answers nought bytes for a short file, and at one more it fails
 * `ERR_OUT_OF_RANGE` — `must be >= -1 && <= 9007199254740991`. A runner that
 * answered the plausible empty read for the second would hand a caller an
 * end-of-file branch the host never takes.
 *
 * @type {number}
 */
export const maxOffset = Number.MAX_SAFE_INTEGER

/**
 * The refusal a positional read's `offset` and `size` deserve, or `null` for a
 * window a host will read.
 *
 * **It is here so that the two runners refuse the same numbers in the same
 * words**, as {@link refusalMessage} is for the gates: `readBytes` and `pread`
 * each have two implementations, the node runner's and the virtual one's, and a
 * bound checked in one of the four is a window a proof passes and production
 * refuses — or the reverse. Every caller asks this before it touches a byte.
 *
 * **Each bound is one the host draws, and two of them the host draws silently.**
 * Node's `Buffer.alloc` takes a fractional size and *truncates* it: measured on
 * Node 23.11.0, `Buffer.alloc(1.5)` is one byte long and `Buffer.alloc(0.5)` is
 * none, so a size of `1.5` read one byte and said nothing about the half it
 * dropped. A fractional *position* it does refuse, `ERR_OUT_OF_RANGE`, and an
 * `offset` past {@link maxOffset} likewise. Refusing all of them here, before the
 * allocation and before the read, is what makes the refusal a program meets its
 * own rather than whichever of the two runners it happened to run under.
 *
 * @type {(offset: number, size: number) => Nullable<string>}
 */
export const windowRefusal = (offset, size) => {
    if (!Number.isInteger(offset)) { return `Offset ${offset} is not an integer` }
    if (!Number.isInteger(size)) { return `Chunk size ${size} is not an integer` }
    if (offset < 0) { return `Offset ${offset} is negative` }
    if (size < 0) { return `Chunk size ${size} is negative` }
    if (!Number.isSafeInteger(offset)) { return `Offset ${offset} exceeds maximum allowed offset of ${maxOffset}` }
    if (BigInt(size) > maxLengthBytes) { return `Chunk size ${size} exceeds maximum allowed size of ${maxLengthBytes} bytes` }
    return null
}

/**
 * The refusal `readFile` gives a file of `size` bytes at `path`, or `null` for a
 * file small enough to read whole.
 *
 * **It is here for the reason {@link windowRefusal} is**: both runners implement
 * `readFile`, and a limit or a message spelled in each is one they come to
 * disagree about. Each asks it with the bytes the file occupies before it reads
 * one, and the message names the size and the path the caller asked for
 * — `ReadFile` in [`./types.ts`](./types.ts) states that the failure names the
 * file.
 *
 * @type {(path: string, size: number) => Nullable<string>}
 */
export const fileSizeRefusal = (path, size) =>
    BigInt(size) > maxLengthBytes
        ? `File size ${size} exceeds maximum allowed size of ${maxLengthBytes} bytes: '${path}'`
        : null

/**
 * A {@link _ChunkSource} that reads through one open file, which is what makes a
 * body both lazy and one inode's.
 *
 * `readBytes` is the other source of that shape and it takes a *path*, so a fold
 * over it resolves the name once per chunk: a served entry replaced mid-response
 * yields an old prefix joined to a new suffix, under a length that is correct and
 * an end that is clean, and nothing downstream can tell. `readWhole` binds the
 * chunks too and spends the laziness to do it. This binds them and keeps it.
 *
 * @type {(handle: Handle) => _ChunkSource<Pread>}
 */
export const handleSource = handle => (offset, size) => pread(handle, offset, size)

/**
 * Gives `handle` back, as the `release` a `ServerResponse` carries: the outcome
 * is discarded because there is nobody left to tell — by the time a runner runs
 * this the response is either complete or already destroyed, which is the sense
 * `release`'s `never` channel is declared in.
 *
 * @type {(handle: Handle) => Effect<Close, null, never>}
 */
export const releaseHandle = handle => resultMapStep(close(handle), () => ok(null))

// Response framing, read by both runners

/**
 * The value `headers` holds for `name`, or `null` for none — matched the way Node
 * matches a header name, **case-insensitively**.
 *
 * `Headers` is a `StringMap<string>`, so a listener may spell `Content-Length`
 * any of a dozen ways and Node reads all of them. A runner that compared the key
 * exactly would find no length on a response that declares one, and then refuse
 * or mis-frame it.
 *
 * **It reads the entries the host reads**, which is what `definedEntries` is doing
 * here: an index signature admits `undefined`, `writeListenerHead`
 * ([`./module.mjs`](./module.mjs)) skips such an entry rather than calling
 * `setHeader` for it, and so a header present with no value is a header no client
 * ever sees. Scanning `Object.entries` instead stopped at the first key that
 * *spelled* the name and answered `null` for its missing value, so
 * `{ 'Content-Length': undefined, 'content-length': '2' }` read as declaring no
 * length at all. Measured on Darwin with Node 23.11.0, that response went out
 * under `content-length: 2` with the pump counting against nothing: an
 * eight-byte body on the wire beneath a two-byte promise.
 *
 * Where two entries are *both* defined this answers the first, and no count is
 * ever taken against it — {@link responseGate}'s fourth gate refuses such a
 * response before a bound is read.
 *
 * `name` is given already lower-cased; every caller here is a literal.
 *
 * @type {(headers: Headers, name: string) => Nullable<string>}
 */
export const headerValue = (headers, name) => {
    for (const [k, v] of definedEntries(headers)) {
        if (k.toLowerCase() === name) { return v }
    }
    return null
}

/**
 * How many of `headers`'s defined entries spell `name`, which is how a runner asks
 * whether the listener declared one thing twice.
 *
 * @type {(headers: Headers, name: string) => number}
 */
const headerCount = (headers, name) =>
    definedEntries(headers).filter(([k]) => k.toLowerCase() === name).length

/**
 * The length `headers` declares, or `null` for a response that declares none this
 * runner can read.
 *
 * **A header it cannot read is no declaration**, for either the gate or the
 * count. A `Content-Length` that is not a non-negative decimal integer describes
 * nothing a client can check a body against, so treating it as a number would put
 * the runner's count against a value it invented. Nothing in the tree produces
 * one: `fjs/web` writes the `fstat` size.
 *
 * **Absent and unreadable are the same answer here and different ones at the
 * gate**, which is why {@link responseGate} asks {@link headerValue} as well as
 * this. What Node does with such a header is not "whatever it likes": the header
 * goes out as written and its mere presence turns Node's own chunked framing off.
 * Measured on Node 23.11.0, a listener answering `content-length: '1 '` and a
 * two-byte body put
 *
 * ```
 * HTTP/1.1 200 OK
 * content-length: 1
 * Connection: keep-alive
 * ```
 *
 * on the wire — the padded value verbatim, no `Transfer-Encoding`, and the socket
 * back in the pool. So the surplus byte is the next response's status line, which
 * is the one outcome gate 3 exists to prevent.
 *
 * @type {(headers: Headers) => Nullable<number>}
 */
export const declaredLength = headers => {
    const v = headerValue(headers, 'content-length')
    if (v === null || !isDigits(v)) { return null }
    const n = Number(v)
    return Number.isSafeInteger(n) ? n : null
}

/** Whether `s` is a non-empty run of decimal digits — no sign, no space, no
 * exponent, which is the whole of what a `Content-Length` may be.
 *
 * @type {(s: string) => boolean}
 */
const isDigits = s => s !== '' && [...s].every(c => c >= '0' && c <= '9')

/**
 * Whether Node will carry no body for this response, so the producer is never
 * pulled at all.
 *
 * **The set is the host's, not the RFC's.** Node drops the body of a `HEAD`
 * response and of a `204`, `304` or `1xx`, and `res.write` on one of those does
 * not merely discard the bytes — it answers `true`, so the socket stops being a
 * brake in exactly the cases where there is nothing to brake. A method-agnostic
 * pump therefore reads a multi-gigabyte file at the speed of the disk to send
 * nothing. `205` forbids a body too (RFC 9110 §15.3.6) and Node sends one anyway,
 * so a guard written from the specification would suppress a body the host was
 * about to send — the same plausible wrong answer, produced by the check meant to
 * prevent one.
 *
 * It is the runner that asks, not the listener: `fjs/web` answers a `HEAD`
 * exactly like a `GET` and takes its `Content-Length` from the `fstat`, so a
 * `HEAD` is the common case here and not a corner of one.
 *
 * @type {(method: string, status: number) => boolean}
 */
export const carriesNoBody = (method, status) =>
    method === 'HEAD' || status === 204 || status === 304 || (status >= 100 && status <= 199)

/**
 * What a runner does with a response before it pulls a byte of the body — see
 * {@link _Gate} for the four gates and why their order is the design's rather
 * than each runner's.
 *
 * @type {(method: string, chunkedResponse: boolean, status: number, headers: Headers) => _Gate}
 */
export const responseGate = (method, chunkedResponse, status, headers) => {
    // The framing header first, because it is the response being malformed
    // rather than this body being undeliverable.
    if (headerValue(headers, 'transfer-encoding') !== null) { return framingHeader }
    // Suppression before the length refusal: that refusal exists to stop a
    // truncated body from passing for a whole one, and a body Node drops is never
    // on the wire to be truncated. A `HEAD` or a `304` is a complete answer
    // whatever framing the body it does not carry would have had, so the other
    // order answers `500` to a request this server can satisfy exactly.
    if (carriesNoBody(method, status)) { return noBody }
    const declared = declaredLength(headers)
    // `chunkedResponse` is an escape only where the response declares no length at
    // all. A `Content-Length` that is *present* and unreadable takes Node's
    // chunked framing away — see {@link declaredLength} for what the host put on
    // the wire — so there is nothing left to frame the body by and gate 3 refuses
    // it, on an HTTP/1.1 request exactly as on a 1.0 one.
    if (declared === null && (headerValue(headers, 'content-length') !== null || !chunkedResponse)) {
        return unframed
    }
    // Last, because a length declared twice is a length: the two gates above
    // overlap it and both answer it correctly, and gate 3 catches the response
    // that is doubled *and* unreadable with a blunter but true message.
    if (headerCount(headers, 'content-length') > 1) { return doubledLength }
    return ['pump', declared]
}

/** @type {_FramingHeader} */
const framingHeader = ['framingHeader']

/** @type {_NoBody} */
const noBody = ['noBody']

/** @type {_Unframed} */
const unframed = ['unframed']

/** @type {_DoubledLength} */
const doubledLength = ['doubledLength']

/**
 * The status a runner refuses a response it cannot frame with, and the three
 * messages it explains the refusal by. Declared here so that the two runners say
 * the same thing, as {@link emptyHostError} is, and so a proof asserting one
 * asserts both.
 *
 * `500` rather than `505` for the unframed case: RFC 9110 §15.6.6 names the
 * request's *major* version, which 1.0 shares with 1.1, and this server answers
 * HTTP/1.0 perfectly well for a body whose size it knows. It is the pre-headers
 * case `failSafe` already answers `500` in, reached before rather than after the
 * fact.
 *
 * @type {number}
 */
export const refusedStatus = 500

/** @type {string} */
export const framingHeaderMessage = 'a response may not declare its own transfer encoding'

/** @type {string} */
export const unframedBodyMessage = 'a body with no content-length cannot be framed for this request'

/** @type {string} */
export const doubledLengthMessage = 'a response may not declare its content-length twice'

/**
 * What a runner answers a {@link _Gate} refusal with.
 *
 * @type {(gate: _FramingHeader | _Unframed | _DoubledLength) => string}
 */
export const refusalMessage = ([tag]) =>
    tag === 'framingHeader'
        ? framingHeaderMessage
        : tag === 'unframed' ? unframedBodyMessage : doubledLengthMessage

/**
 * The runner's own answer, as a response frame — for the cases a listener never
 * gets to give one, or gave one the runner may not put on a socket.
 *
 * **It closes the connection**, which is the difference between refusing a request
 * and surviving the refusal. The cases that reach it have not read the request to
 * its end, and on a keep-alive connection Node then waits for the rest of a body
 * that is never coming: the socket is stuck and the next request on it is never
 * answered.
 *
 * Declared here rather than in a runner because both build it — the Node one puts
 * it on the socket, the virtual one records it — and a refusal the two spell
 * differently is a refusal a program cannot be proven against.
 *
 * @type {(status: number, message: string) => { readonly status: number, readonly headers: Headers, readonly body: readonly Vec[] }}
 */
export const runnerResponse = (status, message) => {
    const body = utf8(`${message}\n`)
    return {
        status,
        headers: {
            'content-type': 'text/plain; charset=utf-8',
            'content-length': `${byteLength(body)}`,
            connection: 'close',
        },
        body: [body],
    }
}

// stat

/** @type {Func<Stat>} */
export const stat = do_('stat')

/** @type {Func<ReadWhole>} */
export const readWhole = do_('readWhole')

/**
 * The code {@link readWhole} refuses with when the path is no regular file.
 *
 * **The kind and the size are two questions, and this is the kind.** A FIFO and
 * a device are not files with contents to read to the end of: a FIFO is a
 * stream with a writer at the other end, and one with no writer cannot even be
 * opened to find out — the open waits for a writer. So the kind is asked before
 * the open, and a path that is not a regular file is refused here rather than
 * read.
 *
 * The *size* is a separate matter, and it is why this reads to the end rather
 * than to `stat`'s answer: a procfs file is a regular file — `/proc/self/maps`
 * `stat`s as `S_IFREG`, `isFile()` true — of nought bytes that yields thousands
 * when read, 10,598 through this operation in one run. Going by the size would
 * answer an empty file. So the refusal does not cover it and does not need to:
 * the read takes what the descriptor gives until it gives nothing.
 */
export const notAFileCode = /** @type {const} */ ('ERR_NOT_A_FILE')

/**
 * The message beside {@link notAFileCode}: the path that is no regular file.
 *
 * Declared here rather than in a runner, so the two that raise it — the node
 * one's `readWhole` and the virtual one's, for a `JsModule` — say the same
 * thing, and a caller matching on either gets the same answer. This is the pair
 * {@link inflateTrailingCode} and {@link inflateTrailingMessage} already are.
 *
 * @type {(path: string) => string}
 */
export const notAFileMessage = path => `${path} is not a regular file`

/**
 * A whole file as a byte *list*.
 *
 * **{@link readFile} cannot read a large file, and that bound is the `Vec`'s
 * rather than the format's.** It answers one, 128 KiB at most, and the node
 * runner refuses a larger file before reading it — so any format whose files
 * outgrow that is unreadable through it. {@link readWhole} answers the chunks one
 * open took instead, each a `Vec` and so each within the cap, and `concat` joins
 * them into a list, which has no cap at all.
 *
 * **The chunks are one open's, which is why this is not a fold over
 * {@link readBytes}.** That operation resolves the path per call, so reading a
 * file in windows can straddle two files — `git pack-refs` replaces
 * `packed-refs` by rename on every run, and where the replacement is the same
 * length every window is exactly as long as it should be, so the join is an old
 * prefix on a new suffix that parses and names refs no version of the file held.
 * Nothing a caller can ask closes that: `FileStat` carries no identity to compare
 * and re-reading races the same way. The snapshot has to come from the host, and
 * `readWhole` is the operation that gives one.
 *
 * The bound that remains is memory and the host's own: the whole file is held
 * while it is parsed.
 *
 * @type {(path: string) => Effect<ReadWhole, List<number>, IoChannel>}
 */
export const readWholeBytes = path => ioMapStep(
    readWhole(path),
    chunks => chunks.reduce(
        (bytes, v) => concat(bytes)(u8ListMsb(v)),
        /** @type {List<number>} */ (null)))

// readRequestBytes

/** @type {Func<ReadRequestBytes>} */
export const readRequestBytes = do_('readRequestBytes')

/**
 * What {@link readRequestBytes} refuses a misplaced offset with: the one asked
 * for and the one the body is at.
 *
 * Declared here rather than in a runner, so that the two that raise it say the
 * same thing and a program that meets the refusal in the virtual runner meets
 * the same words on a host. This is the pair {@link notAFileCode} and
 * {@link notAFileMessage} already are.
 *
 * @type {(offset: number, position: number) => string}
 */
export const requestBodyOffsetMessage = (offset, position) =>
    `request body is at ${position}, not ${offset}`

/**
 * A request body as a byte stream: the chunks the client sent, in order.
 *
 * **A runner calls this, not a listener.** It is how each runner turns the
 * handle it holds into the `body` of the {@link IncomingMessage} it hands over,
 * so the stream's shape is written once and the two runners cannot disagree
 * about it. A listener receives the list and never sees the handle.
 *
 * It is {@link readChunks} unbounded, which is what a request body is: nobody
 * declared how long it would be, so it ends where the client stopped sending
 * and an empty read is that end. The bound the other caller passes belongs to a
 * body whose length was declared ahead of it, and a request has no such
 * promise to keep — a `Content-Length` a client sent is the client's claim, and
 * a server that trusted it in place of reading would frame its own reads from
 * something it has no reason to believe.
 *
 * What {@link readChunks} contributes beyond the loop is the offset, and the
 * offset is what makes a re-pull of an already-read cell a refusal rather than
 * a spliced body — see {@link ReadRequestBytes}.
 *
 * @type {(body: RequestBody) => EffectList<ReadRequestBytes, Vec, IoChannel>}
 */
export const requestBody = body =>
    readChunks((offset, size) => readRequestBytes(body, offset, size), null)

// createServer

export const createServer =
    /** @type {<O extends Operation>(listener: RequestListener<O>) => Effect<O | CreateServer, Server>} */
    (do_('createServer'))

// listen

/** @type {Func<Listen>} */
export const listen = do_('listen')

// Wait forever

/** @type {Func<Forever>} */
export const forever = do_('forever')

// import — `import_` is `../common`'s, re-exported above: Node resolves a path
// against the filesystem and a page resolves it against its document, which is
// each interpreter's business rather than the operation's.

// now

/** @type {Func<Now>} */
export const now = do_('now')

// sandbox and catch are declared in `../common`, which is where an operation
// with a second implementer belongs; they are re-exported below so a node-side
// caller keeps one import.

/** @type {Func<Await>} */
const awaitPromise = do_('await')

/** @type {(p: unknown) => Effect<Await, unknown, NotImplemented>} */
export const awaitIfPromise = p =>
    ioMapStep(awaitPromise(p), ([x]) => x)

// Test registration

/** @type {Func<Test>} */
export const test = do_('test')

// Node


/**
 * The exit code a {@link Program} answered, from whichever branch it came.
 *
 * `Result<0, number>` puts a number at `[1]` on both sides — `ok(0)` for
 * success, `error(n)` for failure — so reading the code never asks which
 * branch produced it, while a caller that cares *whether* it failed still asks
 * `[0]`. That is why the success type is the literal `0` rather than `void`.
 *
 * A non-zero code belongs in the `error` branch and `0` in the `ok` branch; the
 * type cannot say so, since there is no "non-zero number", and nothing depends
 * on it — this reads `[1]` either way.
 *
 * @type {(r: Result<0, number>) => number}
 */
export const exitCode = ([, code]) => code

/**
 * Renders a channel error for a **remote** caller: the command name for a
 * {@link NotImplemented}, the OS error code for an `IoError`, and nothing else.
 *
 * {@link errorMessage} is for the operator of the program, who is entitled to
 * the host's own words — including the path that failed. A protocol client is
 * not, and the difference is not stylistic: `payload.message` is where the
 * host puts the absolute path it could not read, so answering an MCP tool call
 * with it publishes the server's filesystem layout to whoever is on the other
 * end. The code (`ENOENT`, `EACCES`) says *what* went wrong without saying
 * *where*, which is the part a client can act on anyway.
 *
 * A host that attached no code leaves nothing safe to forward, so the answer is
 * the bare kind. That is deliberate: guessing which part of a free-text message
 * is path-free is exactly the mistake this exists to prevent.
 *
 * @type {(e: IoChannel) => string}
 */
export const errorSummary = ([tag, payload]) =>
    tag === 'notImplemented'
        ? `operation not implemented: ${payload}`
        : payload.code === undefined ? 'io error' : `io error: ${payload.code}`

/**
 * Ends a program with an exit code that reflects `e`: `ok` yields `0`, and a
 * failure is reported on `stderr` and yields `1` ({@link errorExit}).
 *
 * This is the exit-code policy a `NodeProgram` needs at the end of its chain,
 * and the reason a program does not have to invent one per command. It is the
 * counterpart of {@link isNotFound} at the other end of the channel: where that
 * one asks which failure this is, this one stops asking and reports.
 *
 * @type {<O extends Operation, T>(e: Effect<O, T, IoChannel>) => Effect<O | Write, 0, number>}
 */
export const exitStep = e =>
    resultStep(e, r => {
        // Bound rather than returned inline: the two branches are
        // `Effect<Write, never, number>` and `Effect<never, 0, never>`, both
        // assignable to this, but `step` infers its continuation's type from
        // the union and picks neither.
        /** @type {Effect<Write, 0, number>} */
        const code = r[0] === 'error' ? errorExit(errorMessage(r[1])) : pureOk(0)
        return code
    })

/**
 * A Node version as `process.version` prints it — `v`, then a SemVer version
 * that a nightly or release-candidate build suffixes with a pre-release
 * (`-nightly20260930abc`, `-rc.1`) and may suffix with build metadata
 * (`+…`) — as its numeric core and whether it is a pre-release.
 *
 * Build metadata goes first: its identifiers may hold a `-`, and a
 * pre-release's may too, but the core never does, so the first `-` left
 * begins the pre-release.
 *
 * @type {(nodeVersion: string) => readonly [string, boolean]}
 */
const nodeRelease = nodeVersion => {
    const version = nodeVersion.startsWith('v') ? nodeVersion.slice(1) : nodeVersion
    const plus = version.indexOf('+')
    const release = plus === -1 ? version : version.slice(0, plus)
    const dash = release.indexOf('-')
    return dash === -1 ? [release, false] : [release.slice(0, dash), true]
}

/**
 * Reports whether an external runner needs FunctionalScript's flattened test
 * registration strategy. Node uses the native `expectFailure` option only
 * from the Node 26 baseline; Deno is deliberately exempt from this Node-only
 * version check.
 *
 * A pre-release of 26.0.0 precedes it, as SemVer orders them, so it takes the
 * flattened strategy, which works on every Node.
 *
 * @throws If `engine` is `'node'` and `nodeVersion`, with its `v`, pre-release
 * and build metadata removed, is not a version
 * [`types/version`](../../types/version/module.f.mjs)'s `tryParse` accepts —
 * `''`, `'v'` or `'nightly'`, say. `process.version` always is one.
 *
 * @type {(engine: Engine, nodeVersion?: string) => boolean}
 */
export const usesInlineTestContext = (engine, nodeVersion) => {
    if (engine === 'bun') { return true }
    if (engine !== 'node' || nodeVersion === undefined) { return false }
    const [core, preRelease] = nodeRelease(nodeVersion)
    const sign = versionCmp(core)('26.0.0')
    return sign < 0 || sign === 0 && preRelease
}
