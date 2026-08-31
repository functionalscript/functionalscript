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
 * there keeps apart and counts out: `Sandbox` and `Catch` have a second
 * implementer, and the rest are there because nothing about them is Node's —
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
 */
export type ReadFile = readonly['readFile', (path: string) => IoResult<Vec>]

// readdir

/**
 * Represents a directory entry (file or directory) in the filesystem
 * @see https://nodejs.org/api/fs.html#class-fsdirent
 */
export type Dirent = {
    readonly name: string
    readonly parentPath: string
    readonly isFile: boolean
}

export type ReaddirOptions = {
    readonly recursive?: true
}

export type Readdir = readonly['readdir', (path: string, options: ReaddirOptions) => IoResult<readonly Dirent[]>]

// writeFile

export type WriteFile = readonly['writeFile', (path: string, data: Vec) => IoResult<void>]

// rm

export type Rm = readonly['rm', (path: string) => IoResult<void>]

// rename

export type Rename = readonly['rename', (src: string, dst: string) => IoResult<void>]

// readBytes

export type ReadBytes = readonly['readBytes', (path: string, offset: number, size: number) => IoResult<Vec>]

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

// Fs

export type Fs = Mkdir | ReadFile | ReadBytes | Readdir | WriteFile | Rm | Rename | Exec | Access | CreateExclusive | WriteBytes | Stat

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
}

export type ServerResponse = {
    readonly status: number
    readonly headers: Headers
    readonly body: Vec
}

/**
 * An HTTP request handler. The channel is `never` because the response frame
 * *is* where a failure goes — a listener that cannot answer still has a status
 * code to answer with, so absorbing is the contract rather than an omission.
 */
export type RequestListener<O extends Operation> = (_: IncomingMessage) => Effect<O, ServerResponse, never>

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
 */
export type Listen = ['listen', (server: Server, port: number, host: string) => IoResult<void>]

// HTTP

export type Http = CreateServer | Listen

// Wait forever

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
