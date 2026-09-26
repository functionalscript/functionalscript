/**
 * Types for Node.js effect operations.
 *
 * @module
 */

import type { List as EffectList } from '../../types/list/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { MemOp } from '../memory/types.ts'
import type { Nominal } from '../../types/nominal/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { StringMap } from '../../types/object/types.ts'
import type {
    Effect, IoChannel, IoError, IoErrorInfo, IoResult, NotImplemented, OpResult,
    Operation, ToAsyncOperationMap,
} from '../types.ts'
import type { Nullable } from '../../types/nullable/types.ts';
import type { List } from '../list/types.ts'
import type {
    All, Catch, Console, Import, Module, Read, ReadConsoles, Sandbox, SandboxResult, Std, Write,
    WriteConsoles, _UtfList,
} from '../common/types.ts'

/**
 * The vocabulary every operation is declared in — how a runner reports that it
 * cannot dispatch, and how a host reports that it tried and failed — now lives
 * in [`../types.ts`](../types.ts), beside {@link NotImplemented}, because none
 * of it is node's. It is re-exported here so that the several dozen modules
 * naming these through the node module keep doing so, and so a signature can go
 * on reading as one vocabulary rather than two.
 */
export type { IoChannel, IoError, IoErrorInfo, IoResult, OpResult }

/**
 * The console family joins `Sandbox`, `Catch`, `Import` and `All` in
 * [`../common`](../common/types.ts), for two different reasons that the module
 * there keeps apart and counts out: `Sandbox`, `Catch` and `Import` have a
 * second implementer, and the rest — `All` among them — are there because
 * nothing about them is Node's —
 * fan-out belongs to whichever interpreter has concurrency, a path is resolved
 * against whatever a host resolves paths against, and a byte stream named by a
 * string is not a filesystem fact.
 *
 * They are re-exported here because `NodeOp` unions them and dozens of
 * signatures name them through this module; that makes this a live coupling
 * rather than a shim.
 */
export type {
    All, Catch, Console, Import, Module, Read, ReadConsoles, Sandbox, SandboxResult, Std, Write,
    WriteConsoles, _UtfList,
}

// all

// `All` is `../common`'s, re-exported above: fan-out is an interpreter's job
// whoever the host is.

// fetch

/**
 * The tuple itself is a documented exception to the repo-wide `readonly`
 * rule (`fjs/AGENTS.md` §3.2) — see "Six operation tuples are not
 * `readonly`" in `fjs/effects/todo/node-module-layering.md`.
 */
export type Fetch = ['fetch', (url: string) => IoResult<Vec>]

// mkdir

export type MakeDirectoryOptions = { readonly recursive: true }

export type Mkdir = readonly['mkdir', (path: string, options?: MakeDirectoryOptions) => IoResult<void>]

// readFile

/**
 * Reads a file as a bit vector. File size is limited to 131,072 bytes (128 KiB)
 * to respect Bun's `bigint` size constraint (1,048,575 bits), which is the
 * minimal limit across all runtime environments supported by FunctionalScript.
 * Files exceeding this limit will fail with a validation error.
 *
 * **The failure names the file.** A caller that stops on it — `website`'s
 * manifest scan is the one that does — can only report a build broken by no
 * file in particular otherwise. The path goes in `message`, which is where a
 * host already puts the path it could not read, and is why `errorSummary`
 * rather than `errorMessage` is what a protocol client is answered with.
 */
export type ReadFile = readonly['readFile', (path: string) => IoResult<Vec>]

/** A host-resolved file module: identity is independent of its loading path. */
export type FileModule = {
    readonly id: string
    readonly path: string
}

/**
 * Resolve a literal entry path (parent null), or an admitted file import
 * against its parent identity. The Node host uses WHATWG file URLs and realpath,
 * with default Node ESM symlink semantics, independent of preserve-symlinks flags.
 * Callers admit supported import classes; URL parsing and filesystem identity
 * belong to the host. Imports use the portable URL-path grammar; entry names
 * remain literal filesystem paths. The virtual host uses normalized lexical
 * paths as identities (no cwd or symlinks).
 */
export type ResolveFileModule = readonly['resolveFileModule', (name: string, parent: string | null) => IoResult<FileModule>]

// readdir

/**
 * Represents a directory entry (file or directory) in the filesystem
 * @see https://nodejs.org/api/fs.html#class-fsdirent
 *
 * `isDirectory` is not `!isFile`, for the reason {@link FileStat} spells out
 * about the same pair: a symbolic link, a FIFO, a device and a socket are all
 * `isFile: false` without being directories. A walk that read `!isFile` as
 * "descend into it" would call `readdir` on a symlink and fail with `ENOTDIR`,
 * so the question it actually has to ask is asked directly.
 */
export type Dirent = {
    readonly name: string
    readonly parentPath: string
    readonly isFile: boolean
    readonly isDirectory: boolean
}

export type ReaddirOptions = {
    readonly recursive?: true
}

export type Readdir = readonly['readdir', (path: string, options: ReaddirOptions) => IoResult<readonly Dirent[]>]

// writeFile

export type WriteFile = readonly['writeFile', (path: string, data: Vec) => IoResult<void>]

// rm

export type Rm = readonly['rm', (path: string) => IoResult<void>]

// rmdir

/**
 * Removes the directory at `path`, which must be empty — `ENOTEMPTY` otherwise,
 * so it cannot take anything with it. Nothing is followed: a symbolic link, to a
 * directory or not, is `ENOTDIR`, as is a file. An absent name is `ENOENT`.
 *
 * `ENOTDIR` for a link holds on every host, and on Windows the runner has to make
 * it hold: there a junction or a directory symlink is removed by the host's own
 * `rmdir` whatever its target holds, so the node runner refuses a link before it
 * asks.
 *
 * **A custom runner must implement it**: `NodeOperationMap` and
 * `CommandSet<NodeOp>` are both checked for *completeness*, so annotating
 * either without a handler does not compile, and an exhaustive `switch` over
 * `NodeOp` needs an arm.
 */
export type Rmdir = readonly['rmdir', (path: string) => IoResult<void>]

// rename

export type Rename = readonly['rename', (src: string, dst: string) => IoResult<void>]

// readBytes

export type ReadBytes = readonly['readBytes', (path: string, offset: number, size: number) => IoResult<Vec>]

// inflate

/**
 * Inflates one zlib stream (RFC 1950) to the bytes it holds — one, and the
 * whole input: bytes after the end of the stream are refused, since a
 * file that holds them is not the object its stream spells. The result is
 * bounded as `readFile`'s is, 128 KiB, and a stream that inflates to more
 * is refused with an error rather than cut short: the host decompresses,
 * and only a bound it can name keeps that from being a way to fill memory.
 * A loose Git object is one such stream, and its decoder is pure over the
 * inflated bytes; this is the one host effect between the two until a
 * FunctionalScript inflater exists.
 */
export type Inflate = readonly['inflate', (data: Vec) => IoResult<Vec>]

// randomInt

export type RandomInt = readonly['randomInt', () => OpResult<number>]

// exec

export type ExecResult = {
    readonly stdout: string
    readonly stderr: string
}

export type Exec = readonly['exec', (command: string, stdin?: string) => IoResult<ExecResult>]

// access

export type Access = readonly['access', (path: string) => IoResult<void>]

// createExclusive

/**
 * Creates `path` as an empty file with `O_CREAT|O_EXCL` — fails if it already
 * exists. This is the exclusive create that claims a staging name in the
 * lock-free upload ([staging-lease.md](../../cas/plan/staging-lease.md));
 * with 256 random bits in the name `EEXIST` never happens in practice, so it
 * is just a sanity guard.
 */
export type CreateExclusive = readonly['createExclusive', (path: string) => IoResult<void>]

// writeExclusive

/**
 * Creates `path` with `O_CREAT|O_EXCL` **and writes `data` through that same
 * open** — the chunks in order, since a `Vec` holds at most `maxLengthBytes` and
 * a file has no such bound.
 *
 * Three things hold, and a caller may rely on each:
 *
 * - **Either the file exists holding `data`, or it does not exist.** A write
 *   that fails after the open takes the file with it, so a failure never leaves
 *   a partial one. No caller could do this for itself: `O_EXCL` succeeding is
 *   the only evidence the file is this call's, and it is on the runner's side of
 *   the boundary — an error code is not evidence of it, whatever the code.
 * - **A name already taken fails with `EEXIST` where the open reaches the
 *   pathname**, by whatever holds it — a file, a directory, or a symlink, which
 *   `O_EXCL` refuses without following, leaving its target untouched, dangling or
 *   not. It is not the other way round: a failure *before* the pathname is
 *   reached carries the host's own code, so `EEXIST` means the name is taken
 *   while another code does not mean it is free. The same rule as the first
 *   point — an error code is not evidence about the name.
 * - **Nothing can reach the pathname between the create and the write**, which
 *   is why this is not `createExclusive` followed by `writeFile`: that pair
 *   reopens the name with the flags `w` gives — `O_TRUNC`, and symlinks
 *   followed — so a symlink planted in the window is written *through*.
 *
 * `createExclusive` remains for a name claimed now and written later, which is
 * the lock-free upload's staging file. This one is what a file must be when its
 * contents are published by renaming it: [`fjs/git/refstore/write`](../../git/refstore/write/module.f.mjs)'s
 * `tryWrite` fills a ref's lock with it, and `tryDelete` the rewritten
 * `packed-refs`, which is what needs more than one chunk.
 *
 * **A custom runner must implement it**: `NodeOperationMap` and
 * `CommandSet<NodeOp>` are both checked for *completeness*, so annotating
 * either without a handler does not compile, and an exhaustive `switch` over
 * `NodeOp` needs an arm.
 */
export type WriteExclusive = readonly['writeExclusive', (path: string, data: readonly Vec[]) => IoResult<void>]

// writeBytes

/**
 * Writes the **entire** `data` vector to an **existing** `path` at byte `offset`
 * (positional write). The mirror of `readBytes`: it never creates the file
 * (a missing path is `ENOENT`), and it writes every byte or returns an error —
 * the runner loops over short writes — so a later size check can never pass over
 * a hole. Bounded to ≤128 KiB per call, like `readBytes`.
 */
export type WriteBytes = readonly['writeBytes', (path: string, offset: number, data: Vec) => IoResult<void>]

/** @internal */
export type _WriteLoop = <O extends Operation>(offset: number, e: List<O, Vec, IoChannel>) => Effect<O | WriteBytes, void, IoChannel>

/**
 * A chunk source: the bytes at `offset`, at most `size` of them.
 *
 * It is a *function* rather than a path because the two callers of
 * {@link _ReadChunks} cannot share one. `fjs/cas` reads by name and is safe
 * doing so — a name in the store is its content's hash, published by `rename`
 * and only ever republishable with the same bytes, so whichever inode a
 * per-chunk open lands on holds what the last one held. A served tree carries
 * no such guarantee, so `fjs/web` must read through something bound to one
 * inode. Parameterizing the source lets the two differ instead of forcing one
 * to wait for the other.
 */
export type _ChunkSource<O extends Operation> = (offset: number, size: number) => Effect<O, Vec, IoChannel>

/**
 * A byte stream from a {@link _ChunkSource}, in chunks of at most one `Vec`.
 *
 * **The bound decides what the loop advances by, and it is not `chunkBytes`.**
 * Unbounded, the fold ends at the first empty read, and stepping by a fixed
 * `chunkBytes` is sound only because on a local regular file a short read *is*
 * the last one. A bounded fold does not end there: a short chunk stops being
 * the last chunk, and a fixed step would step over what the read did not
 * return — a hole in a response whose length is already declared. `readBytes`
 * fills the window it is given, but a source is any function of that shape and
 * need not. So this asks for `min(chunkBytes, bound - offset)` and advances by
 * the length it got.
 *
 * A chunk that is not whole bytes is refused: the return type permits one, and
 * rounding its bit length down would report a short chunk as end-of-stream.
 *
 * With a `bound`, an empty read *short of* it fails the cell rather than ending
 * the stream: a file that shrank mid-read is a truncated body under a declared
 * length, which is a plausible wrong value rather than a shorter right one.
 */
export type _ReadChunks = <O extends Operation>(source: _ChunkSource<O>, bound: Nullable<number>) => List<O, Vec, IoChannel>

// stat

/**
 * File metadata returned by `stat`: the size in bytes, and which of the two
 * entry kinds a caller can act on it is.
 *
 * `isFile` is not a convenience. Reading a FIFO, a device or a socket is not
 * reading a file: `open` on a FIFO with no writer blocks until one appears, so a
 * `readFile` that reaches one never returns and holds a thread-pool slot for as
 * long as it waits. Size cannot stand in for the check — a FIFO stats as zero
 * bytes and passes every bound. It is the same question `Dirent` answers for a
 * directory listing, asked about one path.
 *
 * `isDirectory` is not its negation, which is the whole reason it is a second
 * flag rather than a derived one: a FIFO, a device, a socket and the virtual
 * runner's `JsModule` are all `isFile: false` without being directories, so a
 * caller that needs "a name it can descend through" — `fjs/web` validating its
 * served root — cannot ask `!isFile` for it. Both flags are false for such an
 * entry, and that is the answer, not a gap.
 */
export type FileStat = {
    readonly size: number
    readonly isFile: boolean
    readonly isDirectory: boolean
}

export type Stat = readonly['stat', (path: string) => IoResult<FileStat>]

// readWhole

/**
 * A whole file's bytes, as the chunks one open answered.
 *
 * **One open, so the bytes are one file.** {@link ReadBytes} opens the path per
 * call, so a caller reading a file in windows can straddle two of them: a
 * `packed-refs` replaced atomically between two windows — which `git pack-refs`
 * does on every run — yields an old prefix joined to a new suffix, and where the
 * replacement is the same length, every window is exactly as long as it should
 * be and nothing downstream can tell. The result parses, and names a set of refs
 * no version of that file ever held.
 *
 * A caller cannot close that gap with the operations beside it: `stat` carries
 * no identity to compare, and re-reading races the same way. So the snapshot is
 * the host's to give, which it does by reading to the end under the descriptor
 * it opened — the same thing `readFile` does, without its `Vec` ceiling.
 *
 * Chunks rather than one value for that ceiling's sake: each is a `Vec` and so
 * at most 128 KiB, and the file is however many of them it takes. The reader in
 * `fjs/effects/node/module.f.mjs` joins them into a byte list, which has no
 * bound at all.
 *
 * A path that is no regular file — a FIFO, a device — is refused rather than
 * opened: a FIFO is a stream and not a file, and opening one with no writer
 * blocks for as long as none appears. A regular file whose size is a lie is
 * read, not refused: a procfs file `stat`s as nought bytes and yields thousands,
 * and this reads to the end rather than to the size.
 */
export type ReadWhole = readonly['readWhole', (path: string) => IoResult<readonly Vec[]>]

// open, fstat, pread, close

/**
 * An open file, as a value a program holds.
 *
 * **It names an inode, which no path does.** Every other read in `Fs` takes a
 * path, and a path is resolved again on every call: what the second call opens
 * need not be what the first one described. A reader that asks a question about
 * a name and then reads that name answers for something that may be gone —
 * `readWhole`'s own `stat`-before-`open` is the narrowest form of it, and a
 * chunk loop over {@link ReadBytes} is the widest, since it resolves the name
 * once per chunk and can join two files into one correctly-sized body. A handle
 * cannot: measured on Darwin with Node 26.8.1, a file renamed over the name a
 * handle was opened on is still read as the bytes the handle opened, and
 * {@link Fstat} through it still answers the original size.
 *
 * The four operations on one are POSIX's four, and they carry POSIX's names:
 * {@link Open}, {@link Fstat}, {@link Pread}, {@link Close}. A nominal over
 * `unknown`, as {@link Server} is, because what a runner keeps inside one is the
 * runner's business — a `FileHandle` for the Node one, an identifier into its
 * state for the virtual one.
 *
 * **Whoever opens one owes a {@link Close}.** Unlike `readFile`, `readBytes` and
 * `readWhole`, which open and close inside the one operation, this one hands the
 * descriptor out and a program that drops it leaks it — a leak per request is
 * descriptor exhaustion. Where the reads are a response body, the owner is the
 * runner, through `ServerResponse.release`.
 */
export type Handle =
    Nominal<'handle', `431863ca93dc26fa3d9a1dc3e7d3db2183f5d4f3051f0a29b6ac98d4fd065fc4`, unknown>

/**
 * Opens `path` for reading, answering the {@link Handle} the reads go through.
 *
 * **It does not wait for a writer, and that is what makes the kind checkable at
 * all.** A plain read-only open of a FIFO with no writer blocks until one
 * appears, so a guard that asked the descriptor what it holds could never be
 * reached — which is why every operation beside this one asks a *name* first and
 * accepts the window that leaves. A runner therefore opens without blocking
 * (`O_NONBLOCK` on a host), so a FIFO substituted under the name is opened,
 * reported by {@link Fstat} as no regular file, and closed. Measured on Darwin
 * with Node 26.8.1: the non-blocking open of a writerless FIFO answered at once
 * and `fstat` said `isFile: false`, where the plain open never returned at all
 * and held its thread-pool slot for the life of the process.
 *
 * A **directory** opens successfully, as it does on POSIX, and {@link Fstat}
 * reports it; {@link Pread} on it fails `EISDIR`. A name that is absent is
 * `ENOENT` and a path descending through a file is `ENOTDIR`, both measured the
 * same way — the codes a caller already maps for `stat`.
 */
export type Open = readonly['open', (path: string) => IoResult<Handle>]

/**
 * What the open file is: the size in bytes, and which of the two entry kinds a
 * caller can act on it is — {@link FileStat}, asked of a descriptor rather than
 * of a name.
 *
 * **The size it answers is the bound a reader may declare.** A `stat` size is a
 * promise about a file a later read has not reached yet; this one is the size of
 * the file the reads will come from, because they come from this handle.
 *
 * It is still only what the host says. A procfs file is a regular file of nought
 * bytes that yields thousands when read, so a reader that bounds itself by this
 * size reads nothing of one — which {@link ReadWhole} avoids by reading to the end
 * instead, and pays for with the whole file in memory. Neither answer is wrong;
 * they are the two ends of the same trade.
 *
 * A handle that has been closed is `EBADF`, measured on Darwin with Node 26.8.1.
 */
export type Fstat = readonly['fstat', (handle: Handle) => IoResult<FileStat>]

/**
 * The bytes at `offset`, at most `size` of them, read through `handle` — POSIX's
 * `pread`, and {@link ReadBytes} with the name replaced by the handle.
 *
 * It answers fewer bytes than asked for at the end of the file, and nought bytes
 * past it. A closed handle is `EBADF`. Bounded to ≤128 KiB per call, like
 * `readBytes`, because the answer is a `Vec`.
 */
export type Pread = readonly['pread', (handle: Handle, offset: number, size: number) => IoResult<Vec>]

/**
 * Gives the open file back.
 *
 * **Closing twice is not an error**, which is the host's own answer rather than a
 * convenience: measured on Darwin with Node 26.8.1, a second
 * `FileHandle.close()` resolved. So a caller that cannot tell whether it has
 * already released a handle may release it again, and a runner that answered
 * otherwise would give that caller a branch it cannot reach on the host it ships
 * against. What is not forgiving is *reading* after a close — that is `EBADF`.
 */
export type Close = readonly['close', (handle: Handle) => IoResult<void>]

// Fs

export type Fs = Mkdir | ResolveFileModule | ReadFile | ReadBytes | ReadWhole | Readdir | WriteFile | Rm | Rmdir | Rename | Exec | Access | CreateExclusive | WriteExclusive | WriteBytes | Stat | Open | Fstat | Pread | Close

// Server

export type Server =
    Nominal<'server', `160855c4f69310fece3273c1853ac32de43dee1eb41bf59d821917f8eebe9272`, unknown>

// createServer

export type Headers = StringMap<string>

export type IncomingMessage = {
    readonly method: string
    readonly url: string
    readonly headers: Headers
    readonly body: Vec
    /**
     * Whether a body with no `Content-Length` is framed
     * `Transfer-Encoding: chunked` for this request — the host's own answer, on
     * the request because only the host computes it.
     *
     * **It is on the request rather than derived from one**, and the alternative
     * is a version. Node's `ServerResponse` constructor takes the flag from the
     * request's version *and* its `TE` header, through a regular expression over
     * that header's value — which a `.f.mjs` may not write at all
     * ([`fjs/AGENTS.md`](../../AGENTS.md)) and which answers `true` for
     * `x-chunked`, a value no reading of the protocol makes chunked. A runner
     * restating that scan would have to reproduce it on purpose to keep the two
     * runners agreeing about a request neither has any trouble with.
     *
     * Its name says which direction it frames: a *request* body may be chunked
     * too, and this is not that. A listener may read it and learns only what the
     * runner has already decided; what it may not do is act on it, which is
     * gate 1 of `./todo/streaming-http-bodies.md`.
     */
    readonly chunkedResponse: boolean
}

/**
 * What a listener answers with: a status, headers, a **lazy** body, and whatever
 * that body holds, given back.
 *
 * **The body is a `List`, so a response costs one chunk rather than a file.**
 * It was `readonly Vec[]`, which lifted the 131,072-byte cap one `Vec` had been
 * ([#1819](https://github.com/functionalscript/functionalscript/issues/1819))
 * and replaced it with an appetite: every chunk was in hand before the status
 * went out, so peak memory was the whole file per request in flight. A list is
 * pulled one cell at a time, and the runner's pump pulls at the socket's pace —
 * `res.write` answering `false` parks the pull until `drain`.
 *
 * **`O` is the listener's own operations**, because a lazy body *is* an effect.
 * `fjs/web`'s is a bounded read from one {@link Open} — not {@link ReadBytes},
 * which takes a path and so resolves the name again on every chunk.
 *
 * **`release` is required rather than optional**, and a listener holding nothing
 * writes the pure end. A lazy body may *hold* something — `fjs/web` holds a
 * {@link Handle} — and the runner is the only party present at every way a
 * response ends: a refusal before the headers, a suppression, a client that hung
 * up mid-body, a failed cell, a destroy. None of those reaches the far end of the
 * body, which is the only place a `close` cell could sit, and no `List`
 * combinator can be written that tells a producer the consumer has stopped
 * ([`../list/types.ts`](../list/types.ts)). A field that must be written is one
 * that cannot be forgotten; an optional one would record no obligation.
 *
 * Its channel is `never` in the sense [`../types.ts`](../types.ts) gives that
 * word — the failure is absorbed here — because a `close` that fails at this
 * point has nobody left to tell: the response is either complete or already
 * destroyed.
 */
export type ServerResponse<O extends Operation> = {
    readonly status: number
    readonly headers: Headers
    readonly body: List<O, Vec, IoChannel>
    /** Whatever the body held, given back — see above. */
    readonly release: Effect<O, null, never>
}

/**
 * An HTTP request handler. The channel is `never` because the response frame
 * *is* where a failure goes — a listener that cannot answer still has a status
 * code to answer with, so absorbing is the contract rather than an omission.
 * A body that fails *after* the status has gone out has none, which is why the
 * body's own channel is {@link IoChannel} and this one is not.
 */
export type RequestListener<O extends Operation> = (_: IncomingMessage) => Effect<O, ServerResponse<O>, never>

/**
 * What a runner does with a response instead of pulling its body, or
 * {@link _Pump} with the length the pull is counted against.
 *
 * **Three gates stand before the pump, and the order they are asked in is part
 * of the design**, because they overlap: a `HEAD` on a request Node will not
 * chunk, answered with a body whose size the listener does not know, satisfies
 * two of them at once. A runner asks them in the order `responseGate`
 * ([`./module.f.mjs`](./module.f.mjs)) answers in and acts on the first that
 * fires. Both runners read that one function, or they disagree about a request
 * neither of them has any trouble with.
 *
 * @internal
 */
export type _Gate = _FramingHeader | _NoBody | _Unframed | _Pump

/**
 * Gate 1 — the listener wrote a `Transfer-Encoding`. `500`, before the headers:
 * the response is one the listener had no business framing, whatever body this
 * particular request would have carried. Framing is between the runner and the
 * socket, and what a listener writes is a description of its body.
 *
 * @internal
 */
export type _FramingHeader = readonly['framingHeader']

/**
 * Gate 2 — Node will carry no body for this response: a `HEAD`, a `204`, a `304`
 * or a `1xx`. The producer is never pulled, and the status and headers go out as
 * they stand. The set is the host's own and not the RFC's: `205` forbids a body
 * too and Node sends one anyway, so a guard written from the specification would
 * suppress a body the host was about to send.
 *
 * @internal
 */
export type _NoBody = readonly['noBody']

/**
 * Gate 3 — the body that would go out cannot be framed: no `Content-Length` this
 * runner can read, on a request whose `chunkedResponse` is `false`. `500`, before
 * the headers. Such a response is delimited by the connection closing, so a
 * producer that fails mid-body hands the client a truncated body it reads as
 * whole — there is no terminator to withhold.
 *
 * @internal
 */
export type _Unframed = readonly['unframed']

/**
 * No gate fires: pull the body, counting the bytes against the declared length —
 * or against nothing, where the request will be framed chunked and the listener
 * declared no length.
 *
 * @internal
 */
export type _Pump = readonly['pump', Nullable<number>]

/**
 * The tuple itself is a documented exception to the repo-wide `readonly`
 * rule (`fjs/AGENTS.md` §3.2) — see the note on `Fetch` above.
 */
export type CreateServer = ['createServer', (listener: RequestListener<Operation>) => OpResult<Server>]

// listen

/**
 * Starts accepting connections on `port` of `host`.
 *
 * The host is **required**, and that is the whole point of it: Node's own
 * `listen(port)` binds the unspecified address, so omitting it publishes the
 * server to every interface — a default nobody chose, and one a program serving
 * local files must not get by writing less. Pass `'127.0.0.1'` for loopback
 * only, `'0.0.0.0'` (or `'::'`) to accept from anywhere.
 *
 * It answers an {@link IoResult} because binding is where a server most often
 * fails — the port is taken, the address is not the host's — and that failure
 * arrives asynchronously, as the server's `error` event. An operation that
 * answered the moment `listen` was *called* would report a server that never
 * started, and leave the host to kill the process a moment later.
 *
 * The tuple itself is a documented exception to the repo-wide `readonly`
 * rule (`fjs/AGENTS.md` §3.2) — see the note on `Fetch` above.
 */
export type Listen = ['listen', (server: Server, port: number, host: string) => IoResult<void>]

// HTTP

export type Http = CreateServer | Listen

// Wait forever

/**
 * The tuple itself is a documented exception to the repo-wide `readonly`
 * rule (`fjs/AGENTS.md` §3.2) — see the note on `Fetch` above.
 */
export type Forever = ['forever', () => OpResult<never>]

// import — `Import` and `Module` are `../common`'s, re-exported above: a
// browser page loads modules too.

// now

export type Now = readonly['now', () => OpResult<number>]

// sandbox

/**
 * Resolves the return value of a test function inside the effect runner.
 * If `p` is a real `Promise`, it is awaited and rejections propagate as
 * throws. If `p` is any other value it is returned as-is. Plain thenables
 * (objects with a `.then` method that are not `instanceof Promise`) are
 * treated as ordinary values — not awaited. See `fjs/dev/tf/README.md`.
 */
export type Await = readonly['await', (p: unknown) => OpResult<readonly[unknown]>]

// Test registration

/**
 * Signature of a framework test-registration function (e.g. `nodeTest.test`,
 * `bunTest.test`). Returns `Promise<void>` so async sub-tests can be awaited.
 */
export type TestFn = (
    name: string,
    options: { readonly expectFailure: boolean },
    fn: (t: TestContext) => Promise<void>
) => Promise<void>

/**
 * A thin wrapper around a framework's `test` function. Passed through
 * `registerModule` so nested test registration uses the appropriate context
 * (e.g. `inlineContext` on Bun, which does not support nested `test()` calls
 * inside a callback).
 */
export type TestContext = {
    readonly test: TestFn
}

/**
 * Operation that registers a named test with the active `TestContext`.
 *
 * The callback's `never` is the honest reading of what an external framework
 * accepts. Node `--test`, Bun and Deno take a body that either returns or
 * throws; there is no channel to answer a failure through, so the body absorbs
 * its own — which `emergent_testing` does, by panicking, since a throw is the
 * one failure signal those frameworks understand.
 */
export type Test =
    readonly['test', (ctx: TestContext, name: string, expectFailure: boolean, test: (t: TestContext) => Effect<Test | All | Await, void, never>) => OpResult<void>]

// Node

export type NodeOp =
    | Access
    | All
    | Await
    | Catch
    | Fetch
    | Fs
    | Http
    | Forever
    | Import
    | Inflate
    | MemOp
    | Now
    | RandomInt
    | Read
    | Sandbox
    | Write
    | Test

export type NodeEffect<T, E = IoChannel> = Effect<NodeOp, T, E>

export type NodeOperationMap = ToAsyncOperationMap<NodeOp>

/**
 * The environment variables.
 */
export type Env = {
    readonly [k: string]: string|undefined
}

/** Identifies the JavaScript runtime detected at startup. */
export type Engine = 'node' | 'bun' | 'deno'

/**
 * Runtime options passed to every `NodeProgram`.
 *
 * - `args`: command-line arguments (equivalent to `process.argv.slice(2)`).
 * - `env`: process environment variables.
 * - `std`: TTY flags for `stdout` and `stderr`, known at startup and used by
 *   `csiWrite` to decide whether to strip ANSI SGR sequences.
 * - `testContext`: Node `--test` context; used by `register` on Node.
 * - `bunTestContext`: Bun-compatible context that flattens nested tests inline,
 *   working around Bun's lack of nested `test()` support.
 * - `engine`: runtime detected at startup; controls which context `register` selects.
 * - `nodeVersion`: detected Node version; absent for other and virtual runtimes.
 * - `inlineTestContext`: whether the selected context flattens nested tests.
 */
export type NodeProgramOptions = {
    readonly args: readonly string[]
    readonly env: Env
    readonly home: string
    readonly std: Std
    readonly testContext: TestContext
    readonly bunTestContext: TestContext
    readonly engine: Engine
    readonly nodeVersion?: string
    readonly inlineTestContext: boolean
}

/**
 * A program: run it, and it answers an exit code.
 *
 * The code lives in a `Result` rather than in a bare `number`, and the two
 * branches say which kind of code it is — `ok(0)` for success, `error(n)` for
 * failure. A bare `number` could not: nothing could short-circuit on it, so a
 * chain that ran one program and then another had to re-test the code by hand,
 * and `step(…, () => pure(0))` was a way to report a failed program as a clean
 * exit that the type system had no opinion about.
 *
 * **`T` is the literal `0`**, so a success carries no information beyond
 * having succeeded, and `r[1]` is the exit code in *either* branch. A runner
 * reads the code without asking which branch it came from; a caller that cares
 * whether the program failed asks `r[0]`.
 */
export type Program<O extends Operation> = (options: NodeProgramOptions) => Effect<O, 0, number>

export type NodeProgram = Program<NodeOp>
