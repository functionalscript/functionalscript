/**
 * Node.js effect operations: filesystem (`mkdir`, `readFile`, `readdir`,
 * `writeFile`, `rm`, `access`, plus the `readUtf8File`/`writeUtf8File` text
 * helpers), HTTP (`createServer`, `listen`), subprocess `exec`, `log`/`error`
 * (wrappers over `write`), `read`/`readLine`, `randomInt` and `forever`; defines
 * the `NodeOp`/`NodeProgram` types used by the Node runner.
 *
 * The operations no host owns — `all`/`allOk`/`both`, `await`, `fetch`,
 * `import_`, `now`, `sandbox`, and the `IoError` helpers — moved to
 * [`../common/module.f.mjs`](../common/module.f.mjs) so the browser runner can
 * link them, and are re-exported here unchanged.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Commands, CommandSet, Effect, Func, NotImplemented, Operation } from '../types.ts'
 * @import { List } from '../list/types.ts'
 * @import { IoError } from '../common/types.ts'
 * @import { All, Access, Console, CreateExclusive, CreateServer, Dirent, Engine, Env, Exec, ExecResult, FileStat, Forever, Fs, Headers, Http, IncomingMessage, IoChannel, Listen, MakeDirectoryOptions, Mkdir, NodeOp, NodeProgramOptions, RandomInt, Read, ReadBytes, ReadConsoles, ReadFile, Readdir, ReaddirOptions, RequestListener, Rename, Rm, SandboxResult, Server, ServerResponse, Stat, Test, TestContext, TestFn, Write, WriteBytes, WriteConsoles, WriteFile, _UtfList, _WriteLoop } from './types.ts'
 */

import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { toCodePointList } from '../../text/utf8/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { reverse } from '../../types/list/module.f.mjs'
import { length } from '../../types/bit_vec/module.f.mjs'
import { error as resultError } from '../../types/result/module.f.mjs'
import { do_ } from '../module.f.mjs'
import {
    mapStep as ioMapStep, pureError, pureOk, resultMapStep, resultStep, step as ioStep,
} from '../module.f.mjs'
import { errorMessage, ioError } from '../common/module.f.mjs'

/**
 * The host-independent operations, re-exported so a caller that already names
 * this module for `readFile` keeps naming it for `sandbox` and `all` too. They
 * are defined in [`../common/module.f.mjs`](../common/module.f.mjs), which the
 * browser runner links without reaching a Node type.
 */
export {
    all, allOk, awaitIfPromise, both, errorMessage, errorSummary, fetch, import_,
    ioError, isNotFound, now, sandbox, toIoError,
} from '../common/module.f.mjs'

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
    access: null, all: null, await: null, createExclusive: null,
    createServer: null, exec: null, fetch: null, forever: null,
    import: null, listen: null, memCreate: null, memRead: null,
    memWrite: null, mkdir: null, now: null, randomInt: null,
    read: null, readBytes: null, readFile: null, readdir: null,
    rename: null, rm: null, sandbox: null, stat: null,
    test: null, write: null, writeBytes: null, writeFile: null,
}

/**
 * The commands of {@link nodeCommandSet}, in the form a partial runner tests
 * membership against. The cast is the one `Object.keys` always needs: it
 * answers `string[]` for a record whose keys the type system knows exactly.
 *
 * @type {Commands<NodeOp>}
 */
export const nodeCommands = /** @type {Commands<NodeOp>} */ (Object.keys(nodeCommandSet))

// mkdir

/** @type {Func<Mkdir>} */
export const mkdir = do_('mkdir')

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
        ioStep(e, node => {
            if (node === undefined) {
                return pureOk(undefined)
            }
            const { first: v, tail } = node
            const lenV = length(v)
            if ((lenV & 0b111n) !== 0n) {
                return pureError(ioError({ message: 'invalid buffer size' }))
            }
            return ioStep(
                writeBytes(path, offset, v),
                () => f(offset + Number(lenV >> 3n), tail))
        })
    return f
}

/**
 * @template {Operation} O
 * @param {string} path
 * @param {List<O, Vec, IoChannel>} e
 * @returns {Effect<O | WriteBytes | CreateExclusive, void, IoChannel>}
 */
export const writeFromStream = (path, e) =>
    ioStep(
        createExclusive(path),
        () => writeLoop(path)(0, e))

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

// write

/** Emits a `Write` effect to the given named stream. */
/** @type {Func<Write>} */
export const write = do_('write')

/**
 * Encodes `s + '\n'` as UTF-8 and emits a `Write` effect to `stream`.
 * Shared implementation for `log` and `error`.
 *
 * @type {(stream: WriteConsoles) => Console}
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
 * A failed `read` — a runner without the operation — propagates: the line is
 * not silently truncated into a `null` that a caller would read as EOF.
 *
 * @type {(stream: ReadConsoles) => Effect<Read, string | null, NotImplemented>}
 */
export const readLine = stream => {
    /** @type {(acc: _UtfList) => Effect<Read, string | null, NotImplemented>} */
    const loop = acc =>
        ioStep(
            read(stream),
            b => b === null
                ? pureOk(acc === null ? null : utf8ListToString(reverse(acc)))
                : b === lf
                    ? pureOk(utf8ListToString(reverse(acc)))
                    : loop({ first: b, tail: acc })
        )
    return loop(null)
}

// Test registration

/** @type {Func<Test>} */
export const test = do_('test')

// Node

/**
 * Writes an error line to `stderr` and fails with exit code `1`. The canonical
 * "fail with a message" program for a `NodeProgram`. For non-`1` exit codes,
 * compose `resultMapStep(error(s), () => resultError(n))` directly.
 *
 * **It never succeeds, and the type says so.** `E` is `number` and `T` is
 * `never`, so `step`'s continuation takes a `never` and can never run. That is
 * a continuation nobody reaches, not a compile error: writing one still type-
 * checks, because a function accepting `never` accepts anything. What the type
 * buys is that no *value* can be invented for the success branch, so nothing
 * downstream can proceed as if this had succeeded.
 *
 * **The write's own outcome is deliberately discarded**, which is why this is
 * `resultMapStep` rather than `mapStep`. The program is already failing and
 * the exit code is `1` whether or not `stderr` accepted the bytes; propagating
 * here would hand every caller a "failed to report a failure" branch with no
 * better answer available to it than the one taken here.
 *
 * @type {(s: string) => Effect<Write, never, number>}
 */
export const errorExit = s =>
    resultMapStep(error(s), () => resultError(1))

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
