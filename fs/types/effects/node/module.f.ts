/**
 * Node.js effect operations: filesystem (`mkdir`, `readFile`, `readdir`,
 * `writeFile`, `rm`, `access`), networking (`fetch`, `createServer`, `listen`),
 * subprocess `exec`, `log`/`error` (wrappers over `write`), `import_`, `now`,
 * `sandbox`, `forever`, and `all`/`both` parallelism; defines the
 * `NodeOp`/`NodeProgram` types used by the Node runner.
 *
 * @module
 */
import { utf8 } from '../../../text/module.f.ts'
import type { Vec } from '../../bit_vec/module.f.ts'
import type { Nominal } from '../../nominal/module.f.ts'
import type { Result } from '../../result/module.f.ts'
import {
    type Effect, type Func, type Operation, type ToAsyncOperationMap, do_
} from '../module.f.ts'

export type IoResult<T> = Result<T, unknown>

// all

export type All = ['all', <T>(...effects: Effect<never, T>[]) => readonly T[]]

const doAll: Func<All> = do_('all')

/**
 * To run the operation `O` should be known by the runner/engine.
 * This is the reason why we merge `O` with `All` in the resulted `Effect`.
 *
 * @param a
 * @returns
 */
export const all =
    <O extends Operation, T>(...a: readonly Effect<O, T>[]): Effect<O | All, readonly T[]> =>
    doAll(...a as readonly Effect<never, T>[]) as Effect<O | All, readonly T[]>

export const both =
    <O0 extends Operation, T0>(a: Effect<O0, T0>) =>
    <O1 extends Operation, T1>(b: Effect<O1, T1>):
    Effect<O0 | O1 |All, readonly[T0, T1]> =>
    all<O0 | O1, T0 | T1>(a, b) as Effect<O0 | O1 | All, readonly[T0, T1]>

// fetch

export type Fetch = ['fetch', (url: string) => IoResult<Vec>]

export const fetch: Func<Fetch> = do_('fetch')

// mkdir

export type MakeDirectoryOptions = { readonly recursive: true }

export type Mkdir = readonly['mkdir', (path: string, options?: MakeDirectoryOptions) => IoResult<void>]

export const mkdir: Func<Mkdir> =
    do_('mkdir')

// readFile

export type ReadFile = readonly['readFile', (path: string) => IoResult<Vec>]

export const readFile: Func<ReadFile> =
    do_('readFile')

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

export const readdir: Func<Readdir> =
    do_('readdir')

// writeFile

export type WriteFile = readonly['writeFile', (path: string, data: Vec) => IoResult<void>]

export const writeFile: Func<WriteFile> =
    do_('writeFile')

// rm

export type Rm = readonly['rm', (path: string) => IoResult<void>]

export const rm: Func<Rm> =
    do_('rm')

// exec

export type ExecResult = {
    readonly stdout: string
    readonly stderr: string
}

export type Exec = readonly['exec', (command: string, stdin?: string) => IoResult<ExecResult>]

export const exec: Func<Exec> =
    do_('exec')

// access

export type Access = readonly['access', (path: string) => IoResult<void>]

export const access: Func<Access> =
    do_('access')

// Fs

export type Fs = Mkdir | ReadFile | Readdir | WriteFile | Rm | Exec | Access

// Server

export type Server =
    Nominal<'server', `160855c4f69310fece3273c1853ac32de43dee1eb41bf59d821917f8eebe9272`, unknown>

// createServer

export type Headers = {
    readonly [k in string]: string
}

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

export const createServer
    : <O extends Operation>(listener: RequestListener<O>) => Effect<O | CreateServer, Server> =
    do_<CreateServer>('createServer')

// listen

export type Listen = ['listen', (server: Server, port: number) => void]

export const listen: Func<Listen> =
    do_('listen')

// HTTP

export type Http = CreateServer | Listen

// Wait forever

export type Forever = ['forever', () => never]

export const forever: Func<Forever> =
    do_('forever')

// import

export type Module = {
    readonly [k in string]: unknown
}

export type Import = ['import', (path: string) => IoResult<Module>]

export const import_: Func<Import> = do_('import')

// write

/** Named output streams accepted by the `Write` effect. */
export type WriteConsoles = 'stdout' | 'stderr'

/**
 * Raw byte write to a named output stream. Encoding-agnostic — callers supply
 * a `Vec`. The Node runner maps each stream name to the appropriate fd and
 * delegates to the OS via `stream.write()` with backpressure handling.
 */
export type Write = readonly['write', (stream: WriteConsoles, data: Vec) => void]

/** Emits a `Write` effect to the given named stream. */
export const write: Func<Write> = do_('write')

/**
 * Encodes `s + '\n'` as UTF-8 and emits a `Write` effect to `stream`.
 * Shared implementation for `log` and `error`.
 */
const writeString = (stream: WriteConsoles) => (s: string): Effect<Write, void> =>
    write(stream, utf8(s + '\n'))

export type Console = (s: string) => Effect<Write, void>

/** Writes a line to `stdout`. Replaces the retired `Log` effect. */
export const log: Console = writeString('stdout')

/** Writes a line to `stderr`. Replaces the retired `Error` effect. */
export const error: Console = writeString('stderr')

// now

export type Now = readonly['now', () => number]

export const now: Func<Now> = do_('now')

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
 * Runs a plain synchronous function in an isolated, measured environment.
 *
 * Combines try/catch and high-resolution timing into a single atomic operation.
 * Only plain synchronous functions are accepted — no effects, no promises.
 *
 * Using a single operation rather than separate `TryCatch` + `Perf` effects is
 * necessary for correctness: effects execute as async tasks, so the scheduler
 * can insert arbitrary work between two separate timing calls, making the
 * measured delta inaccurate. Here the clock reads happen synchronously around
 * the function call with nothing in between.
 *
 * Future parameters (time limit, memory limit) can be added to the payload
 * without breaking the API. Worker-based implementations can enforce hard
 * limits via worker termination.
 *
 * @see {@link SandboxResult}
 */
export const sandbox: Func<Sandbox> = do_('sandbox')

/**
 * Awaits a `Promise` inside the effect runner. If the Promise rejects, the
 * error propagates as a throw, which the framework catches via `expectFailure`.
 * Required to support async test functions whose returned Promise is not
 * otherwise observed.
 */
export type Await = readonly['await', (p: Promise<unknown>) => unknown]

export const awaitPromise: Func<Await> = do_('await')

// Test registration

/**
 * Signature of a framework test-registration function (e.g. `nodeTest.test`,
 * `bunTest.test`, `pwTest`). Returns `Promise<void>` so async sub-tests can
 * be awaited.
 */
export type TestFn = (
    name: string,
    options: { readonly expectFailure: boolean },
    fn: (t: TestContext) => Promise<void>
) => Promise<void>

/**
 * A thin wrapper around a framework's `test` function. Passed through
 * `registerModule` so nested test registration uses the appropriate context
 * (e.g. `inlineContext` on Bun and Playwright, which do not support nested
 * `test()` calls inside a callback).
 */
export type TestContext = {
    readonly test: TestFn
}

/** Effect operation that registers a named test with the active `TestContext`. */
export type Test =
    readonly['test', (ctx: TestContext, name: string, expectFailure: boolean, test: (t: TestContext) => Effect<Test | All | Await, void>) => void]

export const test: Func<Test> = do_('test')

// Node

export type NodeOp =
    | All
    | Await
    | Fetch
    | Fs
    | Http
    | Forever
    | Import
    | Now
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
export type Engine = 'node' | 'bun' | 'playwright'

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
 * - `playwrightTestContext`: Playwright context using the same inline strategy.
 * - `engine`: runtime detected at startup; controls which context `register` selects.
 */
export type NodeProgramOptions = {
    readonly args: readonly string[]
    readonly env: Env
    readonly std: { readonly [k in WriteConsoles]: { readonly isTTY: boolean } }
    readonly testContext: TestContext
    readonly bunTestContext: TestContext
    readonly playwrightTestContext: TestContext
    readonly engine: Engine
}

export type Program<O extends Operation> = (options: NodeProgramOptions) => Effect<O, number>

export type NodeProgram = Program<NodeOp>
