/**
 * Node.js effect operations: filesystem (`mkdir`, `readFile`, `readdir`,
 * `writeFile`, `rm`, `access`, plus the `readUtf8File`/`writeUtf8File` text
 * helpers), networking (`fetch`, `createServer`, `listen`),
 * subprocess `exec`, `log`/`error` (wrappers over `write`), `import_`, `now`,
 * `sandbox`, `forever`, and `all`/`both` parallelism; defines the
 * `NodeOp`/`NodeProgram` types used by the Node runner.
 *
 * @module
 */
import { utf8, utf8ToString } from '../../text/module.f.ts'
import { toCodePointList } from '../../text/utf8/module.f.ts'
import { codePointListToString } from '../../text/utf16/module.f.ts'
import { reverse, type List as EffectList } from '../../types/list/module.f.ts'
import { length, type Vec } from '../../types/bit_vec/module.f.ts'
import type { MemOp } from '../memory/module.f.ts'
import type { Nominal } from '../../types/nominal/module.f.ts'
import { ok, error as resultError, type Result } from '../../types/result/module.f.ts'
import type { StringMap } from '../../types/object/module.f.ts'
import {
    type Effect, type Func, type Operation, type ToAsyncOperationMap,
    do_, pure
} from '../module.f.ts'
import type { List } from '../list/module.f.ts'

export type IoResult<T> = Result<T, unknown>

/**
 * True if `e` is a "file or directory does not exist" (`ENOENT`) error.
 *
 * Node's filesystem rejections are `Error`s carrying `code: 'ENOENT'`; the
 * virtual interpreter mirrors that shape for absent paths. Lets callers swallow
 * only the missing-path case (e.g. a fresh store) while propagating genuine
 * failures (permissions, corruption) rather than masking them.
 */
export const isNotFound = (e: unknown): boolean =>
    typeof e === 'object' && e !== null && (e as { readonly code?: unknown }).code === 'ENOENT'

// all

export type All = ['all', <T>(...effects: Effect<never, T>[]) => readonly T[]]

/**
 * To run the operation `O` should be known by the runner/engine.
 * This is the reason why we merge `O` with `All` in the resulted `Effect`.
 *
 * @param a
 * @returns
 */
export const all =
    do_('all') as <O extends Operation, T>(...a: readonly Effect<O, T>[]) => Effect<O | All, readonly T[]>

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

/**
 * Reads a file as a bit vector. File size is limited to 131,072 bytes (128 KiB)
 * to respect Bun's `bigint` size constraint (1,048,575 bits), which is the
 * minimal limit across all runtime environments supported by FunctionalScript.
 * Files exceeding this limit will fail with a validation error.
 */
export type ReadFile = readonly['readFile', (path: string) => IoResult<Vec>]

export const readFile: Func<ReadFile> =
    do_('readFile')

/**
 * Reads a file as UTF-8 text.
 *
 * Preserves the `IoResult` instead of unwrapping so callers can pattern-match
 * on errors (e.g. convert them into domain-specific errors) or `unwrap` at the
 * call site.
 */
export const readUtf8File = (path: string): Effect<ReadFile, IoResult<string>> =>
    readFile(path).step(r =>
        pure(r[0] === 'ok' ? ok(utf8ToString(r[1])) : r))

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

/** Writes a string to `path` as UTF-8 bytes. */
export const writeUtf8File = (path: string, content: string): Effect<WriteFile, IoResult<void>> =>
    writeFile(path, utf8(content))

// rm

export type Rm = readonly['rm', (path: string) => IoResult<void>]

export const rm: Func<Rm> =
    do_('rm')

// rename

export type Rename = readonly['rename', (src: string, dst: string) => IoResult<void>]

export const rename: Func<Rename> =
    do_('rename')

// realpath

/**
 * Resolves `path` to its canonical absolute form — following symlinks and
 * collapsing `.`/`..` — the way `fs.realpath` does. Unlike a string-only
 * prefix check, the result reflects where the filesystem actually points,
 * so a symlink planted inside an otherwise-approved directory cannot be used
 * to read a file outside it: validate containment against this result,
 * not the caller-supplied path.
 */
export type Realpath = readonly['realpath', (path: string) => IoResult<string>]

export const realpath: Func<Realpath> =
    do_('realpath')

// readBytes

export type ReadBytes = readonly['readBytes', (path: string, offset: number, size: number) => IoResult<Vec>]

export const readBytes: Func<ReadBytes> =
    do_('readBytes')

// readBytesNoFollow

/**
 * Like {@link readBytes}, but opens `path` with `O_NOFOLLOW`: fails instead of
 * following a symlink at the final path component. For a path whose
 * containment was validated against its {@link realpath}'d form (e.g. an
 * untrusted upload path), that validation is only as good as the file the
 * read actually opens — a plain {@link readBytes} re-resolves the path fresh
 * on every call, so a symlink swapped in after validation (and the store is
 * writable by the caller) would be followed silently. `O_NOFOLLOW` closes
 * that window: every chunk's open rejects a symlink rather than following
 * it, not just the first.
 */
export type ReadBytesNoFollow = readonly['readBytesNoFollow', (path: string, offset: number, size: number) => IoResult<Vec>]

export const readBytesNoFollow: Func<ReadBytesNoFollow> =
    do_('readBytesNoFollow')

// randomInt

export type RandomInt = readonly['randomInt', () => number]

export const randomInt: Func<RandomInt> =
    do_('randomInt')

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

// createExclusive

/**
 * Creates `path` as an empty file with `O_CREAT|O_EXCL` — fails if it already
 * exists. This is the exclusive create that claims a staging name in the
 * lock-free upload ([staging-lease.md](../../../issues/cas/staging-lease.md));
 * with 256 random bits in the name `EEXIST` never happens in practice, so it
 * is just a sanity guard.
 */
export type CreateExclusive = readonly['createExclusive', (path: string) => IoResult<void>]

export const createExclusive: Func<CreateExclusive> =
    do_('createExclusive')

// writeBytes

/**
 * Writes the **entire** `data` vector to an **existing** `path` at byte `offset`
 * (positional write). The mirror of {@link readBytes}: it never creates the file
 * (a missing path is `ENOENT`), and it writes every byte or returns an error —
 * the runner loops over short writes — so a later size check can never pass over
 * a hole. Bounded to ≤128 KiB per call, like `readBytes`.
 */
export type WriteBytes = readonly['writeBytes', (path: string, offset: number, data: Vec) => IoResult<void>]

export const writeBytes: Func<WriteBytes> =
    do_('writeBytes')

const writeLoop = (path: string) => {
    const f = <O extends Operation>(offset: number, e: List<O, IoResult<Vec>>) =>
        e.step(r => {
            if (r === undefined) {
                return pure(ok(undefined))
            }
            const { first: [t, v], tail } = r
            if (t === 'error') {
                return pure(resultError(v))
            }
            const lenV = length(v)
            if ((lenV & 0b111n) !== 0n) {
                return pure(resultError('invalid buffer size'))
            }
            return writeBytes(path, offset, v)
            .step((r): Effect<O | WriteBytes, IoResult<void>> => {
                if (r[0] === 'error') {
                    return pure(r)
                }
                return f(offset + Number(lenV >> 3n), tail)
            })
        })
    return f
}

export const writeFromStream =
    <O extends Operation>(path: string, e: List<O, IoResult<Vec>>): Effect<O | WriteBytes | CreateExclusive, IoResult<void>> =>
    createExclusive(path)
    .step(([r, v]): Effect<O | WriteBytes, IoResult<void>> => {
        if (r === 'error') {
            return pure(resultError(v))
        }
        return writeLoop(path)(0, e)
    })

// stat

/** File metadata returned by {@link stat}. Only `size` (in bytes) for now. */
export type FileStat = { readonly size: number }

export type Stat = readonly['stat', (path: string) => IoResult<FileStat>]

export const stat: Func<Stat> =
    do_('stat')

// Fs

export type Fs = Mkdir | ReadFile | ReadBytes | ReadBytesNoFollow | Readdir | WriteFile | Rm | Rename | Realpath | Exec | Access | CreateExclusive | WriteBytes | Stat

// Server

export type Server =
    Nominal<'server', `160855c4f69310fece3273c1853ac32de43dee1eb41bf59d821917f8eebe9272`, unknown>

// createServer

export type Headers = StringMap<string, string>

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

export type Module = StringMap<string, unknown>

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

// read

/** Named input streams accepted by the `Read` effect. */
export type ReadConsoles = 'stdin'

/**
 * Reads a single byte from a named input stream — the byte-granular dual of
 * {@link write}. Resolves to the byte value (`0`–`255`) or `null` at end of
 * input (EOF). One byte at a time: the effect carries no buffering or line
 * policy, so higher-level framing (see {@link readLine}) lives in pure code
 * rather than the interpreter. Back-pressure is naturally sequential — the next
 * `read` is only issued once the previous byte is consumed.
 */
export type Read = readonly['read', (stream: ReadConsoles) => number | null]

/** Emits a `Read` effect, yielding the next input byte or `null` at EOF. */
export const read: Func<Read> = do_('read')

/** Decodes accumulated UTF-8 bytes (MSB-first, already in order) into a string. */
const utf8ListToString = (bytes: EffectList<number>): string =>
    codePointListToString(toCodePointList(bytes))

/** The line-feed byte (`\n`) that terminates a line. */
const lf = 0x0a

/**
 * Reads one line from `stream` as a pure combinator over the byte-level
 * {@link read}: accumulates bytes until a `\n` terminator or EOF, then
 * UTF-8-decodes them. The terminator is consumed but excluded from the result.
 *
 * Reading a single byte per step means a line never over-reads past its
 * terminator, so no leftover-byte buffer has to survive between calls — each
 * `readLine` is self-contained. Yields `null` only at EOF with nothing
 * buffered; a final line lacking a trailing newline is returned in full.
 *
 * Bytes accumulate into a cons-list by prepending (O(1) per byte) and are
 * reversed and decoded once at the terminator, so a large line costs O(n)
 * rather than the O(n²) of copying a growing array on every byte.
 */
export const readLine = (stream: ReadConsoles): Effect<Read, string | null> => {
    const loop = (acc: EffectList<number>): Effect<Read, string | null> =>
        read(stream).step(b =>
            b === null
                ? pure(acc === null ? null : utf8ListToString(reverse(acc)))
                : b === lf
                    ? pure(utf8ListToString(reverse(acc)))
                    : loop({ first: b, tail: acc }))
    return loop(null)
}

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
 * Resolves the return value of a test function inside the effect runner.
 * If `p` is a real `Promise`, it is awaited and rejections propagate as
 * throws. If `p` is any other value it is returned as-is. Plain thenables
 * (objects with a `.then` method that are not `instanceof Promise`) are
 * treated as ordinary values — not awaited. See `fs/dev/tf/README.md`.
 */
export type Await = readonly['await', (p: unknown) => readonly[unknown]]

const awaitPromise: Func<Await> = do_('await')

export const awaitIfPromise = (p: unknown) => awaitPromise(p).step(([x]) => pure(x))

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

/**
 * Writes an error line to `stderr` and yields exit code `1`. The canonical
 * "fail with a message" program for a `NodeProgram`. For non-`1` exit codes,
 * compose `error(s).step(() => pure(n))` directly.
 */
export const errorExit = (s: string): Effect<Write, number> =>
    error(s).step(() => pure(1))

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
    readonly home: string
    readonly std: { readonly [k in WriteConsoles]: { readonly isTTY: boolean } }
    readonly testContext: TestContext
    readonly bunTestContext: TestContext
    readonly playwrightTestContext: TestContext
    readonly engine: Engine
}

export type Program<O extends Operation> = (options: NodeProgramOptions) => Effect<O, number>

export type NodeProgram = Program<NodeOp>
