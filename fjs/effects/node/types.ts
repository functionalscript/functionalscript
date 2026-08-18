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
import type { Effect, NotImplemented, Operation, ToAsyncOperationMap } from '../types.ts'
import type { List } from '../list/types.ts'

/**
 * A host failure, normalized: whatever the runtime threw reduced to a
 * serializable record. `code` is the OS error code when the host supplied one
 * (`'ENOENT'`, `'EEXIST'`), absent otherwise.
 *
 * It is a tagged tuple for the same reason {@link NotImplemented} is — the two
 * share an error channel, and the tag is what tells them apart. That
 * distinction is the whole reason this type exists: with a bare `unknown`
 * error, `NotImplemented | unknown` collapses to `unknown` and a program can no
 * longer tell "this runner cannot do it" from "the host tried and failed".
 *
 * Normalizing also keeps the channel serializable. A thrown `Error` carries a
 * stack, a `cause`, and arbitrary own properties; none of it survives a wire
 * hop, and a runner in another process could not reproduce it.
 */
export type IoError = readonly['ioError', IoErrorInfo]

export type IoErrorInfo = {
    readonly code?: string
    readonly message: string
}

/**
 * The result of an operation with no failures of its own: it either produces
 * its value or reports that the runner does not implement it.
 *
 * Every operation's return type is a `Result`, including the ones that cannot
 * fail on their own terms — an operation left on a raw contract would be a hole
 * in the error channel, and a runner may omit a handler for any of them.
 */
export type OpResult<T> = Result<T, NotImplemented>

/**
 * The error channel of anything that performs host IO: a normalized host
 * failure, or the report that the runner does not implement the operation.
 *
 * It is one name rather than a union spelled at each site, and that is a
 * migration property rather than brevity. An effect that does no IO *yet* is
 * one added `readFile` away from doing some, and if each signature names its
 * own errors, that one change walks up every enclosing signature — the failure
 * mode that sank `throws` clauses elsewhere, where engineers eventually
 * declared everything throwing rather than maintain the cascade. Declaring the
 * standard channel once is that concession made deliberately: an IO-touching
 * effect says it fails *the way node IO fails*, and gaining a new way to do so
 * changes nothing above it.
 *
 * It is not a licence to widen. An operation with failures of its own extends
 * the channel (`IoChannel | ParseError`), and a computation whose errors are
 * genuinely narrower should say so — this is the default for IO, not a ceiling.
 */
export type IoChannel = NotImplemented | IoError

/**
 * The result of an operation that performs host IO: its value, a normalized
 * host failure, or the missing-handler report.
 */
export type IoResult<T> = Result<T, IoChannel>

// all

/**
 * Runs its effects concurrently and answers each one's whole `Result`.
 *
 * The nesting is deliberate and belongs to the runner: this envelope says
 * whether `all` itself could be dispatched, and each inner `Result` is what
 * that effect answered. `allOk` (`./module.f.mjs`) is the collapse a fallible
 * chain wants.
 */
export type All = ['all', <T, E>(...effects: Effect<never, T, E>[]) => OpResult<readonly Result<T, E>[]>]

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

/** File metadata returned by `stat`. Only `size` (in bytes) for now. */
export type FileStat = { readonly size: number }

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

export type Listen = ['listen', (server: Server, port: number) => OpResult<void>]

// HTTP

export type Http = CreateServer | Listen

// Wait forever

export type Forever = ['forever', () => OpResult<never>]

// import

export type Module = StringMap<unknown>

export type Import = ['import', (path: string) => IoResult<Module>]

// write

/** Named output streams accepted by the `Write` effect. */
export type WriteConsoles = 'stdout' | 'stderr'

/**
 * Raw byte write to a named output stream. Encoding-agnostic — callers supply
 * a `Vec`. The Node runner maps each stream name to the appropriate fd and
 * delegates to the OS via `stream.write()` with backpressure handling.
 */
export type Write = readonly['write', (stream: WriteConsoles, data: Vec) => OpResult<void>]

export type Console = (s: string) => Effect<Write, void>

// read

/** Named input streams accepted by the `Read` effect. */
export type ReadConsoles = 'stdin'

/**
 * Reads a single byte from a named input stream — the byte-granular dual of
 * `write`. Resolves to the byte value (`0`–`255`) or `null` at end of
 * input (EOF). One byte at a time: the effect carries no buffering or line
 * policy, so higher-level framing (see `readLine`) lives in pure code
 * rather than the interpreter. Back-pressure is naturally sequential — the next
 * `read` is only issued once the previous byte is consumed.
 */
export type Read = readonly['read', (stream: ReadConsoles) => OpResult<number | null>]

/** @internal */
export type _UtfList = EffectList<number>

// now

export type Now = readonly['now', () => OpResult<number>]

// sandbox

/**
 * The outcome of a `Sandbox` operation.
 *
 * `result` carries either `['ok', value]` or `['error', thrown]`. `duration`
 * is a floating-point millisecond count with up to microsecond precision,
 * matching `performance.now()` directly. Additional fields (allocated memory,
 * max stack depth, coverage) may be added in future without breaking consumers.
 */
export type SandboxResult<T> = {
    readonly result: Result<T, unknown>
    /**
     * Elapsed time in milliseconds (microsecond precision via `performance.now()`).
     * The virtual runner returns `0` for deterministic tests.
     */
    readonly duration: number
}

export type Sandbox = readonly['sandbox', <T>(f: () => T) => OpResult<SandboxResult<T>>]

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
    readonly std: { readonly [k in WriteConsoles]: { readonly isTTY: boolean } }
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
