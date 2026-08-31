/**
 * Node.js effect operations: filesystem (`mkdir`, `readFile`, `readdir`,
 * `writeFile`, `rm`, `access`, plus the `readUtf8File`/`writeUtf8File` text
 * helpers), networking (`fetch`, `createServer`, `listen`),
 * subprocess `exec`, `now`, `forever`, and `all`/`both` parallelism;
 * defines the `NodeOp`/`NodeProgram` types used by the Node runner.
 *
 * The console family — `write`, `log`, `error`, `errorExit`, `read`,
 * `readLine` — and `sandbox`, `catch_` and `import_` are re-exported from
 * [`../common`](../common/module.f.mjs) rather than declared here: an operation
 * belongs to the layer of whoever implements it, and a browser sandboxes,
 * catches, writes and loads modules.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Commands, CommandSet, Effect, Func, NotImplemented, Operation } from '../types.ts'
 * @import { List } from '../list/types.ts'
 * @import { All, Access, Await, Catch, Console, CreateExclusive, CreateServer, Dirent, Engine, Env, Exec, ExecResult, Fetch, FileStat, Forever, Fs, Headers, Http, IncomingMessage, IoChannel, IoError, IoErrorInfo, Listen, MakeDirectoryOptions, Mkdir, Now, NodeOp, NodeProgramOptions, RandomInt, Read, ReadBytes, ReadConsoles, ReadFile, Readdir, ReaddirOptions, RequestListener, Rename, Rm, Sandbox, SandboxResult, Server, ServerResponse, Stat, Test, TestContext, TestFn, Write, WriteBytes, WriteConsoles, WriteFile, _UtfList, _WriteLoop } from './types.ts'
 */

import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { toCodePointList } from '../../text/utf8/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { reverse } from '../../types/list/module.f.mjs'
import { length } from '../../types/bit_vec/module.f.mjs'
import { error as resultError, ok as resultOk, unwrap } from '../../types/result/module.f.mjs'
import { do_, ioError, pure, toIoError } from '../module.f.mjs'
import {
    catch_, error, errorExit, import_, log, read, readLine, sandbox, write,
} from '../common/module.f.mjs'
import {
    mapStep as ioMapStep, pureError, pureOk, resultMapStep, resultStep, step as ioStep,
} from '../module.f.mjs'

/**
 * `ioError` and `toIoError` are declared in
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
export { ioError, toIoError }

// `../common`'s, kept visible here because `NodeOp` unions them and dozens of
// call sites name them through this module — a live coupling, not a shim. An
// operation belongs to the layer of whoever implements it, and every one of
// these has, or will have, a second implementer: a browser sandboxes, catches,
// writes, and loads modules through an `import()` of its own.
export { catch_, error, errorExit, import_, log, read, readLine, sandbox, write }

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

// all

/**
 * To run the operation `O` should be known by the runner/engine.
 * This is the reason why we merge `O` with `All` in the resulting effect.
 */
export const all =
    // `Func` cannot express a variadic generic operation, so the declared type
    // is written out here and `do_`'s is set aside.
    /** @type {<O extends Operation, T, E>(...a: readonly Effect<O, T, E>[]) => Effect<O | All, readonly Result<T, E>[], NotImplemented>} */
    (/** @type {unknown} */ (do_('all')))

/**
 * Collapses a list of results into a result of the list, keeping the **first**
 * error in list order and discarding the later ones.
 *
 * Keeping one is what makes this a `Result` rather than a report: the callers
 * that need it are chains, and a chain has one error channel. A site that wants
 * every failure wants a different return type and should not reach for this.
 *
 * @type {<T, E>(list: readonly Result<T, E>[]) => Result<readonly T[], E>}
 */
const okList = list => {
    for (const r of list) {
        if (r[0] === 'error') { return r }
    }
    return resultOk(list.map(unwrap))
}

/**
 * {@link all} in the `ok` channel: collects the values when every effect
 * succeeded, and answers with the first failure otherwise.
 *
 * `all` alone cannot serve a fallible chain. Its envelope is the runner's
 * (`OpResult`, saying whether the *operation* could be dispatched), so handing
 * it `Effect`s nests one `Result` inside another and the caller receives
 * `readonly Result<T, E>[]`. That has to be collapsed before the chain can
 * `step` again, and a continuation that forgets to is the value-discarding
 * hazard this migration exists to remove — one level in, where it is harder to
 * see.
 *
 * **Every effect still runs.** The short-circuit is in the *result*, not in the
 * execution: `all` performs them concurrently and this reads the answers once
 * they are all in, so a failure does not cancel its siblings the way it stops
 * the sequential `forEachStep` in `./module.f.mjs`. The error channel
 * unions the runner's
 * `NotImplemented` with the effects' own `E` for the same reason every other
 * step does — either can be what went wrong.
 *
 * @type {<O extends Operation, T, E>(...a: readonly Effect<O, T, E>[]) => Effect<O | All, readonly T[], NotImplemented | E>}
 */
export const allOk = (...a) =>
    ioStep(all(...a), rs => pure(okList(rs)))

/**
 * @template {Operation} O0
 * @template T0
 * @template E0
 * @param {Effect<O0, T0, E0>} a
 * @returns {<O1 extends Operation, T1, E1>(b: Effect<O1, T1, E1>) => Effect<O0 | O1 | All, readonly[Result<T0, E0>, Result<T1, E1>], NotImplemented>}
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
 * Renders a channel error as a human line: an {@link IoError}'s own message, or
 * the command name a runner could not dispatch.
 *
 * @type {(e: IoChannel) => string}
 */
export const errorMessage = ([tag, payload]) =>
    tag === 'notImplemented' ? `operation not implemented: ${payload}` : payload.message

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
