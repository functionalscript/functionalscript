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
import type { Effect, Operation, ToAsyncOperationMap } from '../types.ts'
import type { List } from '../list/types.ts'

export type IoResult<T> = Result<T, unknown>

// all

export type All = ['all', <T>(...effects: Effect<never, T>[]) => readonly T[]]

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

export type RandomInt = readonly['randomInt', () => number]

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
export type _WriteLoop = <O extends Operation>(offset: number, e: List<O, IoResult<Vec>>) => Effect<O | WriteBytes, IoResult<void>>

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

export type RequestListener<O extends Operation> = (_: IncomingMessage) => Effect<O, ServerResponse>

export type CreateServer = ['createServer', (listener: RequestListener<Operation>) => Server]

// listen

export type Listen = ['listen', (server: Server, port: number) => void]

// HTTP

export type Http = CreateServer | Listen

// Wait forever

export type Forever = ['forever', () => never]

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
export type Write = readonly['write', (stream: WriteConsoles, data: Vec) => void]

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
export type Read = readonly['read', (stream: ReadConsoles) => number | null]

/** @internal */
export type _UtfList = EffectList<number>

// now

export type Now = readonly['now', () => number]

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

export type Sandbox = readonly['sandbox', <T>(f: () => T) => SandboxResult<T>]

/**
 * Resolves the return value of a test function inside the effect runner.
 * If `p` is a real `Promise`, it is awaited and rejections propagate as
 * throws. If `p` is any other value it is returned as-is. Plain thenables
 * (objects with a `.then` method that are not `instanceof Promise`) are
 * treated as ordinary values — not awaited. See `fjs/dev/tf/README.md`.
 */
export type Await = readonly['await', (p: unknown) => readonly[unknown]]

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

/** Effect operation that registers a named test with the active `TestContext`. */
export type Test =
    readonly['test', (ctx: TestContext, name: string, expectFailure: boolean, test: (t: TestContext) => Effect<Test | All | Await, void>) => void]

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

export type NodeEffect<T> = Effect<NodeOp, T>

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

export type Program<O extends Operation> = (options: NodeProgramOptions) => Effect<O, number>

export type NodeProgram = Program<NodeOp>
