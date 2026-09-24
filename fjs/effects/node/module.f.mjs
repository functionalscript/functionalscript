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
 * @import { List } from '../list/types.ts'
 * @import { List as List_ } from '../../types/list/types.ts'
 * @import { Access, Await, Catch, Console, CreateExclusive, CreateServer, Dirent, Engine, Env, Exec, ExecResult, Fetch, FileStat, Forever, Fs, Headers, Http, IncomingMessage, Inflate, IoChannel, IoError, IoErrorInfo, Listen, MakeDirectoryOptions, Mkdir, Now, NodeOp, NodeProgramOptions, RandomInt, Read, ReadBytes, ReadConsoles, ReadFile, ResolveFileModule, ReadWhole, Readdir, ReaddirOptions, RequestListener, Rename, Rm, Sandbox, SandboxResult, Server, ServerResponse, Stat, Test, TestContext, TestFn, Write, WriteBytes, WriteConsoles, WriteExclusive, WriteFile, _ChunkSource, _ReadChunks, _UtfList, _WriteLoop } from './types.ts'
 */

import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { toCodePointList } from '../../text/utf8/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { concat } from '../../types/list/module.f.mjs'
import { byteLength, bytesIn, isWholeBytes, isWholeBytesIn, length, maxLengthBytes, msb, u8List } from '../../types/bit_vec/module.f.mjs'
import { nonEmpty, empty as elEmpty } from '../list/module.f.mjs'
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
    access: null, all: null, await: null, catch: null, createExclusive: null,
    createServer: null, exec: null, fetch: null, forever: null,
    import: null, inflate: null, listen: null, memCreate: null, memRead: null,
    memWrite: null, mkdir: null, now: null, randomInt: null,
    read: null, readBytes: null, readFile: null, readWhole: null, readdir: null,
    rename: null, resolveFileModule: null, rm: null, sandbox: null, stat: null,
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

// writeFile

/** @type {Func<WriteFile>} */
export const writeFile = do_('writeFile')

/**
 * Writes a string to `path` as UTF-8 bytes.
 *
 * @type {(path: string, content: string) => Effect<WriteFile, void, IoChannel>}
 */
export const writeUtf8File = (path, content) =>
    writeFile(path, utf8(content))

// rm

/** @type {Func<Rm>} */
export const rm = do_('rm')

// rename

/** @type {Func<Rename>} */
export const rename = do_('rename')

// readBytes

/** @type {Func<ReadBytes>} */
export const readBytes = do_('readBytes')

// inflate

const inflateOp = /** @type {Func<Inflate>} */ (do_('inflate'))

/**
 * The refusal of a `Vec` that is not whole bytes, where bytes are what a host
 * is handed: {@link inflate}, {@link writeExclusive} and {@link writeFromStream}
 * each refuse one with it.
 */
const invalidBufferSize = pureError(ioError({ message: 'invalid buffer size' }))

/**
 * Inflates a zlib stream. The stream is bytes, so a `Vec` that is not
 * whole bytes is refused here as `invalid buffer size`, before any host
 * sees it, as {@link writeFromStream} refuses one: a host's conversion
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

// access

/** @type {Func<Access>} */
export const access = do_('access')

// createExclusive

/** @type {Func<CreateExclusive>} */
export const createExclusive = do_('createExclusive')

// writeExclusive

const writeExclusiveOp = /** @type {Func<WriteExclusive>} */ (do_('writeExclusive'))

/**
 * Creates `path` and writes `data` through that one open. A file holds bytes, so
 * a `Vec` that is not whole bytes is refused here as `invalid buffer size`,
 * before any host sees it, as {@link inflate} refuses one: a host's conversion
 * would pad the last byte, and the file would not hold `data`.
 *
 * @type {Func<WriteExclusive>}
 */
export const writeExclusive = (path, data) =>
    isWholeBytes(data) ? writeExclusiveOp(path, data) : invalidBufferSize

/**
 * Creates `path` and writes `content` to it as UTF-8 bytes, through one open,
 * failing with `EEXIST` where the name is taken. The text form of
 * {@link writeExclusive}, as {@link writeUtf8File} is of {@link writeFile}.
 *
 * @type {(path: string, content: string) => Effect<WriteExclusive, void, IoChannel>}
 */
export const writeExclusiveUtf8File = (path, content) =>
    writeExclusive(path, utf8(content))

// writeBytes

/** @type {Func<WriteBytes>} */
export const writeBytes = do_('writeBytes')

/** @type {(path: string) => _WriteLoop} */
const writeLoop = path => {
    /** @type {_WriteLoop} */
    const f = (offset, e) =>
        ioStep(e, node => {
            if (node === undefined) {
                return pureOk(undefined)
            }
            const { first: v, tail } = node
            if (!isWholeBytes(v)) {
                return invalidBufferSize
            }
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
 * @param {List<O, Vec, IoChannel>} e
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
     * @type {(chunk: Vec, offset: number) => List<any, Vec, IoChannel>}
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
    /** @type {(offset: number) => List<any, Vec, IoChannel>} */
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
 * @type {(path: string) => Effect<ReadWhole, List_<number>, IoChannel>}
 */
export const readWholeBytes = path => ioMapStep(
    readWhole(path),
    chunks => chunks.reduce(
        (bytes, v) => concat(bytes)(u8List(msb)(v)),
        /** @type {List_<number>} */ (null)))

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

/** @type {(version: string) => readonly number[]} */
const versionParts = version =>
    version.replace(/^v/, '').split('.').map(Number)

/**
 * Compares semantic versions numerically by major, minor, then patch.
 *
 * @type {(version: string, minimum: string) => boolean}
 */
export const versionLessThan = (version, minimum) => {
    const [major = 0, minor = 0, patch = 0] = versionParts(version)
    const [minMajor = 0, minMinor = 0, minPatch = 0] = versionParts(minimum)
    return major < minMajor || major === minMajor && (
        minor < minMinor || minor === minMinor && patch < minPatch
    )
}

/**
 * Reports whether an external runner needs FunctionalScript's flattened test
 * registration strategy. Node uses the native `expectFailure` option only
 * from the Node 26 baseline; Deno is deliberately exempt from this Node-only
 * version check.
 *
 * @type {(engine: Engine, nodeVersion?: string) => boolean}
 */
export const usesInlineTestContext = (engine, nodeVersion) => {
    if (engine === 'bun') { return true }
    if (engine !== 'node' || nodeVersion === undefined) { return false }
    return versionLessThan(nodeVersion, '26.0.0')
}
