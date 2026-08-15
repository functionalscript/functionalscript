/**
 * Node.js effect operations: filesystem (`mkdir`, `readFile`, `readdir`,
 * `writeFile`, `rm`, `access`, plus the `readUtf8File`/`writeUtf8File` text
 * helpers), networking (`fetch`, `createServer`, `listen`),
 * subprocess `exec`, `log`/`error` (wrappers over `write`), `import_`, `now`,
 * `sandbox`, `forever`, and `all`/`both` parallelism; defines the
 * `NodeOp`/`NodeProgram` types used by the Node runner.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Effect, Func, Operation } from '../types.ts'
 * @import { List } from '../list/types.ts'
 * @import { All, Access, Await, Console, CreateExclusive, CreateServer, Dirent, Engine, Env, Exec, ExecResult, Fetch, FileStat, Forever, Fs, Headers, Http, IncomingMessage, Import, IoResult, Listen, MakeDirectoryOptions, Mkdir, Module, Now, NodeOp, NodeProgramOptions, RandomInt, Read, ReadBytes, ReadConsoles, ReadFile, Readdir, ReaddirOptions, RequestListener, Rename, Rm, Sandbox, SandboxResult, Server, ServerResponse, Stat, Test, TestContext, TestFn, Write, WriteBytes, WriteConsoles, WriteFile, _UtfList, _WriteLoop, } from './types.ts'
 */

import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { toCodePointList } from '../../text/utf8/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { reverse } from '../../types/list/module.f.mjs'
import { length } from '../../types/bit_vec/module.f.mjs'
import { ok, error as resultError, mapOk } from '../../types/result/module.f.mjs'
import { do_, mapStep, okStep, pure, step } from '../module.f.mjs'

/**
 * True if `e` is a "file or directory does not exist" (`ENOENT`) error.
 *
 * Node's filesystem rejections are `Error`s carrying `code: 'ENOENT'`; the
 * virtual interpreter mirrors that shape for absent paths. Lets callers swallow
 * only the missing-path case (e.g. a fresh store) while propagating genuine
 * failures (permissions, corruption) rather than masking them.
 *
 * @type {(e: unknown) => boolean}
 */
export const isNotFound = e =>
    typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT'

// all

/**
 * To run the operation `O` should be known by the runner/engine.
 * This is the reason why we merge `O` with `All` in the resulted `Effect`.
 */
export const all =
    /** @type {<O extends Operation, T>(...a: readonly Effect<O, T>[]) => Effect<O | All, readonly T[]>} */
    (do_('all'))

/**
 * @template {Operation} O0
 * @template T0
 * @param {Effect<O0, T0>} a
 * @returns {<O1 extends Operation, T1>(b: Effect<O1, T1>) => Effect<O0 | O1 | All, readonly[T0, T1]>}
 */
export const both = a => b =>
    /** @type {any} */ (all)(a, b)

// fetch

/** @type {Func<Fetch>} */
export const fetch = do_('fetch')

// mkdir

/** @type {Func<Mkdir>} */
export const mkdir = do_('mkdir')

// readFile

/** @type {Func<ReadFile>} */
export const readFile = do_('readFile')

/**
 * Reads a file as UTF-8 text.
 *
 * Preserves the `IoResult` instead of unwrapping so callers can pattern-match
 * on errors (e.g. convert them into domain-specific errors) or `unwrap` at the
 * call site.
 *
 * @type {(path: string) => Effect<ReadFile, IoResult<string>>}
 */
export const readUtf8File = path =>
    mapStep(readFile(path), mapOk(utf8ToString))

// readdir

/** @type {Func<Readdir>} */
export const readdir = do_('readdir')

// writeFile

/** @type {Func<WriteFile>} */
export const writeFile = do_('writeFile')

/**
 * Writes a string to `path` as UTF-8 bytes.
 *
 * @type {(path: string, content: string) => Effect<WriteFile, IoResult<void>>}
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

// writeBytes

/** @type {Func<WriteBytes>} */
export const writeBytes = do_('writeBytes')

/** @type {(path: string) => _WriteLoop} */
const writeLoop = path => {
    /** @type {_WriteLoop} */
    const f = (offset, e) =>
        step(e, r => {
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
            return step(
                writeBytes(path, offset, v),
                okStep(() => f(offset + Number(lenV >> 3n), tail)))
        })
    return f
}

/**
 * @template {Operation} O
 * @param {string} path
 * @param {List<O, IoResult<Vec>>} e
 * @returns {Effect<O | WriteBytes | CreateExclusive, IoResult<void>>}
 */
export const writeFromStream = (path, e) =>
    step(
        createExclusive(path),
        okStep(() => writeLoop(path)(0, e)))

// stat

/** @type {Func<Stat>} */
export const stat = do_('stat')

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

// import

/** @type {Func<Import>} */
export const import_ = do_('import')

// write

/** Emits a `Write` effect to the given named stream. */
/** @type {Func<Write>} */
export const write = do_('write')

/**
 * Encodes `s + '\n'` as UTF-8 and emits a `Write` effect to `stream`.
 * Shared implementation for `log` and `error`.
 *
 * @type {(stream: WriteConsoles) => (s: string) => Effect<Write, void>}
 */
const writeString = stream => s =>
    write(stream, utf8(s + '\n'))

/** Writes a line to `stdout`. Replaces the retired `Log` effect. */
/** @type {Console} */
export const log = writeString('stdout')

/** Writes a line to `stderr`. Replaces the retired `Error` effect. */
/** @type {Console} */
export const error = writeString('stderr')

// read

/** Emits a `Read` effect, yielding the next input byte or `null` at EOF. */
/** @type {Func<Read>} */
export const read = do_('read')

/** @type {(bytes: _UtfList) => string} */
const utf8ListToString = bytes =>
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
 *
 * @type {(stream: ReadConsoles) => Effect<Read, string | null>}
 */
export const readLine = stream => {
    /** @type {(acc: _UtfList) => Effect<Read, string | null>} */
    const loop = acc =>
        step(
            read(stream),
            b => b === null
                ? pure(acc === null ? null : utf8ListToString(reverse(acc)))
                : b === lf
                    ? pure(utf8ListToString(reverse(acc)))
                    : loop({ first: b, tail: acc })
        )
    return loop(null)
}

// now

/** @type {Func<Now>} */
export const now = do_('now')

// sandbox

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
 *
 * @type {Func<Sandbox>}
 */
export const sandbox = do_('sandbox')

/** @type {Func<Await>} */
const awaitPromise = do_('await')

/** @type {(p: unknown) => Effect<Await, unknown>} */
export const awaitIfPromise = p =>
    mapStep(awaitPromise(p), ([x]) => x)

// Test registration

/** @type {Func<Test>} */
export const test = do_('test')

// Node

/**
 * Writes an error line to `stderr` and yields exit code `1`. The canonical
 * "fail with a message" program for a `NodeProgram`. For non-`1` exit codes,
 * compose `mapStep(error(s), () => n)` directly.
 *
 * @type {(s: string) => Effect<Write, number>}
 */
export const errorExit = s =>
    mapStep(error(s), () => 1)

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
