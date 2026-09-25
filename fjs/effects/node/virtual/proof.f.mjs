/**
 * @import { Dir, RecordedResponse, State } from './types.ts'
 * @import { Handle, IncomingMessage, IoResult, NodeOp, RequestListener, ServerResponse } from '../types.ts'
 * @import { Effect } from '../../types.ts'
 * @import { List } from '../../list/types.ts'
 * @import { IoChannel } from '../types.ts'
 * @import { Key } from '../../memory/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { resolveFileModule, access, awaitIfPromise, close, exec, fetch, framingHeaderMessage, fstat, handleSource, log, open, pread, readChunks, releaseHandle, rm, writeFile, readFile, readdir, import_, rename, readBytes, writeBytes, stat, createExclusive, writeExclusive, createServer, forever, listen, readWhole, notAFileCode, notAFileMessage, mkdir, unframedBodyMessage } from '../module.f.mjs'
import { empty, length, maxLengthBytes, msb, vec, vec8 } from '../../../types/bit_vec/module.f.mjs'
import { history, historyStep, pureError, pureOk, resultMapStep, step } from '../../module.f.mjs'
import { empty as endOfBody, nonEmpty } from '../../list/module.f.mjs'
import { utf8, utf8ToString } from '../../../text/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, nodeProgramOptions, virtual } from './module.f.mjs'
import { do_ } from '../../module.f.mjs'
import { catchStep } from '../../module.f.mjs'
import { ioError } from '../../module.f.mjs'
import { ok, unwrap } from '../../../types/result/module.f.mjs'
import { asNominal, create as memCreate, read as memRead, write as memWrite } from '../../memory/module.f.mjs'

/**
 * A recorded response body as text, its chunks joined: a body is however many
 * `Vec`s the answer takes, and a listener that writes one is the ordinary case
 * rather than the shape of the type.
 *
 * @type {(r: RecordedResponse) => string}
 */
const responseText = r => utf8ToString(r.body.reduce((v, chunk) => msb.concat(v)(chunk), empty))

/**
 * The chunks given, as a body already in hand: every cell is pure, so the whole
 * chain is built before the runner pulls any of it.
 *
 * That is the ordinary listener and not the shape of the type — a *lazy* body
 * produces its cells inside a command's continuation, which is what `readChunks`
 * over a {@link handleSource} does and what the `fjs/web` proofs drive.
 *
 * @type {(chunks: readonly Vec[]) => List<NodeOp, Vec, IoChannel>}
 */
const ofChunks = chunks => chunks.reduceRight(
    (tail, chunk) => nonEmpty(chunk, tail),
    /** @type {List<NodeOp, Vec, IoChannel>} */(endOfBody()))

/** A listener holding nothing writes the pure end.
 *
 * @type {Effect<NodeOp, null, never>}
 */
const holdsNothing = pureOk(null)

/**
 * What `release` writes when it runs, so that a proof can say **once** rather than
 * "at least once": `stdout` records every write in order, so two would show.
 *
 * @type {string}
 */
const released = 'released'

/** @type {Effect<NodeOp, null, never>} */
const recordRelease = resultMapStep(log(released), () => ok(null))

/**
 * A body no cell of which may be pulled: pulling it fails the response, so a
 * recorded `failure` of `null` is evidence the pump never asked.
 *
 * It needs no instrument, which is why it is written this way rather than with a
 * counter — the gates' whole point is the read they save.
 *
 * @type {List<NodeOp, Vec, IoChannel>}
 */
const neverPulled = pureError(ioError({ message: 'pulled' }))

/** A request as a fixture states one, framed the way an HTTP/1.1 request is.
 *
 * @type {(method: string, headers?: Record<string, string>, chunkedResponse?: boolean) => IncomingMessage}
 */
const requested = (method, headers = {}, chunkedResponse = true) =>
    ({ method, url: '/', headers, body: empty, chunkedResponse })

/**
 * Hands `listener` one request and answers what went out, together with the state
 * it left.
 *
 * @type {(listener: RequestListener<NodeOp>, request: IncomingMessage, state?: State) => readonly[State, RecordedResponse]}
 */
const answerOne = (listener, request, state = emptyState) => {
    const e = step(createServer(listener), server => listen(server, 8080, '127.0.0.1'))
    const [s, result] = virtual({ ...state, requests: [request] })(e)
    assert(result[0] === 'ok', result)
    assertEq(s.responses.length, 1)
    return [s, s.responses[0]]
}

/** How many bytes a recorded body carries.
 *
 * @type {(r: RecordedResponse) => number}
 */
const bodyBytes = r => r.body.reduce((n, v) => n + Number(length(v)) / 8, 0)

/**
 * Asserts that a channel error is a host failure carrying `code` — the
 * normalized shape every runner reports, virtual and Node alike.
 * @type {(e: IoChannel, code: string) => void}
 */
const assertIoCode = (e, code) => {
    assert(e[0] === 'ioError', e)
    assertEq(e[1].code, code)
}

/**
 * Asserts that a channel error is a host failure carrying `message`.
 * @type {(e: IoChannel, message: string) => void}
 */
const assertIoMessage = (e, message) => {
    assert(e[0] === 'ioError', e)
    assertEq(e[1].message, message)
}

/** @type {(name: string) => (parent: string | null) => import('../types.ts').IoResult<import('../types.ts').FileModule>} */
const resolvedModule = name => parent => virtual(emptyState)(resolveFileModule(name, parent))[1]

export const proof = {
    nodeProgramOptions: () => {
        const options = nodeProgramOptions(['a', 'b'])
        assertStructurallySame(options.args, ['a', 'b'])
        assertStructurallySame({ ...options, args: [] }, defaultNodeProgramOptions)
    },
    resolveFileModule: () => {
        assertStructurallySame(resolvedModule('./dir/../main.mjs')(null), ['ok', { id: 'main.mjs', path: './dir/../main.mjs' }])
        assertStructurallySame(resolvedModule('./%64ep.mjs')('main.mjs'), ['ok', { id: 'dep.mjs', path: 'dep.mjs' }])
        assertEq(resolvedModule('./bad%')('main.mjs')[0], 'error')
        assertStructurallySame(resolvedModule('./dep.mjs')('bad%'), ['ok', { id: 'dep.mjs', path: 'dep.mjs' }])
        assertStructurallySame(resolvedModule('./dep%3F%23%25.mjs')('main.mjs'), ['ok', { id: 'dep?#%.mjs', path: 'dep?#%.mjs' }])
        assertStructurallySame(resolvedModule('./next.mjs')('dep?#%.mjs'), ['ok', { id: 'next.mjs', path: 'next.mjs' }])
        assertStructurallySame(resolvedModule('main?#%.mjs')(null), ['ok', { id: 'main?#%.mjs', path: 'main?#%.mjs' }])
    },
    // The two ways a command can have no handler here, which are not the same
    // failure and must not answer alike.
    unimplemented: {
        // `exec` is a `NodeOp` this runner deliberately lacks — an in-memory
        // filesystem has no subprocesses. It used to be a `todo` handler that
        // threw; the program now gets its control back and can decide.
        declaredButAbsent: () => {
            const [, result] = virtual(emptyState)(exec('ls'))
            assert(result[0] === 'error', result)
            assertEq(result[1][0], 'notImplemented', result[1])
            assertEq(result[1][1], 'exec', result[1])
        },
        // What the whole stage is for: the program receives control back and
        // chooses. `exec` is unavailable here, so this one falls back to
        // writing a note instead of dying, and the run completes normally.
        programChoosesAFallback: () => {
            const e = catchStep(exec('ls'), () => log('exec unavailable'))
            const [state, result] = virtual(emptyState)(e)
            assert(result[0] === 'ok', result)
            assertEq(state.stdout, 'exec unavailable\n')
        },
        // A `command` that is not a `NodeOp` at all is a malformed node: the
        // type said it was one, so something built it from data that was never
        // checked. That stays a panic — collapsing it into `notImplemented`
        // would turn a probable bug into a routine outcome.
        throw: {
            undeclaredCommand: () => {
                // `do_` cannot build this from a well-typed call — that is the
                // point: only a node assembled outside the type system reaches
                // an interpreter with a command like this.
                const bogus = /** @type {Effect<NodeOp, never, never>} */ (
                    /** @type {any} */ (do_)('nope')())
                virtual(emptyState)(bogus)
            },
        },
    },
    rm: {
        success: () => {
            /** @type {Dir} */
            const root = { 'a.txt': [vec8(0x42n)] }
            const [, result] = virtual({ ...emptyState, root })(rm('a.txt'))
            assert(result[0] === 'ok')
        },
        notFound: () => {
            const [, result] = virtual(emptyState)(rm('notexist.txt'))
            assert(result[0] === 'error')
        },
        onDirectory: () => {
            // `operation`'s wrapper descends into 'mydir' (a plain object),
            // so rmOp itself runs with an empty remaining path and rejects
            // via its `path.length !== 1` guard, not a directory-specific one.
            /** @type {Dir} */
            const inner = {}
            /** @type {Dir} */
            const root = { 'mydir': inner }
            const [, result] = virtual({ ...emptyState, root })(rm('mydir'))
            assert(result[0] === 'error')
        },
    },
    writeFileOnDirectory: () => {
        /** @type {Dir} */
        const inner = {}
        /** @type {Dir} */
        const root = { 'mydir': inner }
        const [, result] = virtual({ ...emptyState, root })(writeFile('mydir', vec8(0x42n)))
        assert(result[0] === 'error')
    },
    writeFileOverJsModule: () => {
        // writeFile onto a path currently holding a JsModule (function) covers the
        // `!Array.isArray(file)` branch of writeFileOp: the entry exists but is
        // neither undefined nor an array.
        /** @type {Dir} */
        const root = { 'a.f.ts': () => ({}) }
        const [, result] = virtual({ ...emptyState, root })(writeFile('a.f.ts', vec8(0x42n)))
        assert(result[0] === 'error')
    },
    readdirRecursive: () => {
        const file = /** @type {const} */ ([vec8(0x42n)])
        /** @type {Dir} */
        const sub = { 'file.txt': file }
        /** @type {Dir} */
        const outer = { 'sub': sub }
        /** @type {Dir} */
        const root = { 'mydir': outer }
        const [, result] = virtual({ ...emptyState, root })(readdir('mydir', { recursive: true }))
        assert(result[0] === 'ok')
        assert(result[0] === 'ok', result)
        assertEq(result[1].length, 2)
        // A walk asks `isDirectory` rather than `!isFile`, because on a host
        // the two differ — a symbolic link is neither — so both flags are
        // answered here as well.
        assertEq(result[1][0]?.isDirectory, true)
        assertEq(result[1][0]?.isFile, false)
        assertEq(result[1][1]?.isDirectory, false)
        assertEq(result[1][1]?.isFile, true)
    },
    accessNestedPathThroughFile: () => {
        // 'a/b/c' where 'a' is a file: the operation wrapper's "not a directory"
        // fallback passes the full remaining path through unchanged, covering the
        // path.length !== 1 branch of the access op (only path.length === 0 was
        // otherwise exercised).
        /** @type {Dir} */
        const root = { 'a': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(access('a/b/c'))
        assert(result[0] === 'error')
    },
    readFileIntoDir: () => {
        // 'a/b' where both 'a' and 'b' are directories
        // hits path.length === 0 in operation's f and path.length !== 1 in readFile op
        /** @type {Dir} */
        const inner = {}
        /** @type {Dir} */
        const outer = { 'b': inner }
        /** @type {Dir} */
        const root = { 'a': outer }
        const [, result] = virtual({ ...emptyState, root })(readFile('a/b'))
        assert(result[0] === 'error')
    },
    // `a/b` where `a` is a *file*, for each read. `readFileIntoDir` and the
    // size-cap fixture both descend through real directories, so neither
    // reaches the case `operation` hands the op with two segments left; these
    // do. Without the one-segment guard — or with the call site collapsing `p`
    // to its head — both return `a`'s own bytes for a path that names no file,
    // and `result[0] === 'error'` is what catches that on its own: the mutant's
    // failure mode is a wrong *success*, so any error kills it.
    //
    // The code is pinned for a different reason, and it is worth being exact
    // about which: `ENOENT` is what this runner answers, **not** what a host
    // would. POSIX says `ENOTDIR` when a path descends through a non-directory,
    // which {@link statPath} models deliberately — so `stat('a/b')` and
    // `readFile('a/b')` disagree here for one fixture. These pin what is
    // actually returned, so that settling the disagreement has to come past
    // them; [reads-enotdir-through-a-file](./todo/reads-enotdir-through-a-file.md)
    // is where it gets settled.
    readFileNestedThroughFile: () => {
        /** @type {Dir} */
        const root = { 'a': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readFile('a/b'))
        assert(result[0] === 'error')
        assertIoCode(result[1], 'ENOENT')
    },
    readBytesNestedThroughFile: () => {
        /** @type {Dir} */
        const root = { 'a': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('a/b', 0, 1))
        assert(result[0] === 'error')
        assertIoCode(result[1], 'ENOENT')
    },
    awaitNonPromise: () => {
        // a non-promise value passes through the virtual `await` handler as-is
        const [, result] = virtual(emptyState)(awaitIfPromise(42))
        assert(result[0] === 'ok', result)
        assertEq(result[1], 42)
    },
    fetchNotFound: () => {
        // covers the `result === undefined` branch of the `fetch` handler
        const [, result] = virtual(emptyState)(fetch('https://example.com/missing'))
        assert(result[0] === 'error')
    },
    importNestedPath: () => {
        // import_ on a path whose parent does not exist covers the
        // path.length !== 1 branch of the import_ op
        const [, result] = virtual(emptyState)(import_('a/b'))
        assert(result[0] === 'error')
    },
    importNonModule: () => {
        // import_ on a Vec (not a JsModule) covers typeof entry !== 'function' branch
        /** @type {Dir} */
        const root = { 'module.f.ts': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(import_('module.f.ts'))
        assert(result[0] === 'error')
    },
    throw: {
        readFileOnJsModule: () => {
            // readFile on a JsModule path covers typeof file === 'function' branch
            /** @type {Dir} */
            const root = { 'a.f.ts': () => ({}) }
            virtual({ ...emptyState, root })(readFile('a.f.ts'))
        },
        readBytesOnJsModule: () => {
            // readBytes on a JsModule path covers typeof file === 'function' branch
            /** @type {Dir} */
            const root = { 'a.f.ts': () => ({}) }
            virtual({ ...emptyState, root })(readBytes('a.f.ts', 0, 1))
        },
    },
    // `readWhole` of a `JsModule` is that same `IoResult` and not a panic, and it
    // carries the *node runner's* code: that runner refuses a FIFO or a device
    // before it opens the path, with `ERR_NOT_A_FILE`, so a caller that branches
    // on it must be able to reach the branch here too. A procfs file is not one
    // of them — it is a regular file whose size lies, which that runner reads to
    // the end rather than refuses. The two
    // reads beside it, `readFile` and `readBytes`, still panic — their contract
    // is to produce bytes and a module has none, so a fixture aiming them at one
    // is a fixture bug.
    readWholeOnJsModule: () => {
        /** @type {Dir} */
        const root = { 'a.f.ts': () => ({}) }
        const [, result] = virtual({ ...emptyState, root })(readWhole('a.f.ts'))
        assert(result[0] === 'error')
        const e = result[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, notAFileCode)
        assertEq(e[1].message, notAFileMessage('a.f.ts'))
        // And the message is the path the caller asked for, not the entry name
        // the resolver reduced it to: an operation descends before it runs, so a
        // nested entry arrives as one segment, and the node runner names the
        // whole path. Two files of one name under different directories are the
        // case a basename cannot tell apart.
        /** @type {Dir} */
        const nested = { dir: { 'a.f.ts': () => ({}) } }
        const [, deep] = virtual({ ...emptyState, root: nested })(readWhole('dir/a.f.ts'))
        assert(deep[0] === 'error')
        const d = deep[1]
        assert(d[0] === 'ioError')
        assertEq(d[1].code, notAFileCode)
        assertEq(d[1].message, notAFileMessage('dir/a.f.ts'))
        // A *directory* is the other thing that is no regular file, and it gets
        // the same refusal here as on the host: the node runner `stat`s before it
        // opens and answers `ERR_NOT_A_FILE`, where an `ENOENT` would read as
        // absence — `fjs/git/refstore` forgives that one, so a directory called
        // `packed-refs` would be an empty packed-ref set on this runner and a
        // refusal on the host.
        const [, asDir] = virtual({ ...emptyState, root: nested })(readWhole('dir'))
        assert(asDir[0] === 'error')
        const e2 = asDir[1]
        assert(e2[0] === 'ioError')
        assertEq(e2[1].code, notAFileCode)
        assertEq(e2[1].message, notAFileMessage('dir'))
    },
    writeBytesOnJsModule: () => {
        // writeBytes shares `resolveFile` with the two reads but not their
        // `JsModule` policy: a module stands in for a host's FIFO or device,
        // writing to one fails with an ordinary IO error there, and this is
        // the proof that a caller's branch for that failure is reachable here.
        // A panic — which is what the reads answer, and what nothing in
        // FunctionalScript can catch — would delete it.
        /** @type {Dir} */
        const root = { 'a.f.ts': () => ({}) }
        const [, result] = virtual({ ...emptyState, root })(writeBytes('a.f.ts', 0, vec8(0x1n)))
        assert(result[0] === 'error')
        assertIoMessage(result[1], `'a.f.ts' is not a file`)
    },
    readFileSkipsEmptyChunk: () => {
        // A file stored with a zero-length chunk ahead of real data: readFile's
        // loop must skip it (`chunkLen === 0n`) rather than concatenating it.
        /** @type {Dir} */
        const root = { 'f': [empty, vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readFile('f'))
        assert(result[0] === 'ok', result)
        assertEq(length(result[1]), 8n)
    },
    readdirSkipsUndefinedEntry: () => {
        // `Dir`'s index signature is optional (`{[name]?: _Entity}`), so an
        // entry can legitimately be present with value `undefined` (e.g. after
        // a rename leaves a stale key in some future refactor). readdir's loop
        // must skip such entries rather than reporting them.
        /** @type {Dir} */
        const root = { 'd': { 'a': undefined, 'b': [vec8(0x42n)] } }
        const [, result] = virtual({ ...emptyState, root })(readdir('d', {}))
        assert(result[0] === 'ok', result)
        assertEq(result[1].length, 1)
    },
    renameEmptySrc: () => {
        // rename('', dst): src parses to the root path itself.
        const [, result] = virtual(emptyState)(rename('', 'dst'))
        assert(result[0] === 'error')
        assertIoMessage(result[1], 'cannot extract root')
    },
    renameSrcThroughFile: () => {
        // rename('a/b', dst) where 'a' is a file, not a directory: the
        // intermediate segment can't be descended into.
        /** @type {Dir} */
        const root = { 'a': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(rename('a/b', 'dst'))
        assert(result[0] === 'error')
    },
    renameSrcThreeLevelsMissing: () => {
        // rename('a/b/c', dst) where 'a/b' exists but 'c' doesn't: the error
        // from the deepest extractEntity call propagates through two levels
        // of recursion.
        /** @type {Dir} */
        const root = { 'a': { 'b': {} } }
        const [, result] = virtual({ ...emptyState, root })(rename('a/b/c', 'dst'))
        assert(result[0] === 'error')
    },
    renameDstMissingIntermediate: () => {
        // rename(src, 'missingdir/x'): the destination's parent doesn't exist.
        /** @type {Dir} */
        const root = { 'src': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(rename('src', 'missingdir/x'))
        assert(result[0] === 'error')
    },
    renameDstThroughFile: () => {
        // rename(src, 'blocker/x') where 'blocker' is a file, not a directory.
        /** @type {Dir} */
        const root = { 'src': [vec8(0x42n)], 'blocker': [vec8(0x1n)] }
        const [, result] = virtual({ ...emptyState, root })(rename('src', 'blocker/x'))
        assert(result[0] === 'error')
        assertIoMessage(result[1], 'not a directory')
    },
    renameDstNestedError: () => {
        // rename(src, 'a/b/c') where 'a/b' is a file: insertEntityAt's error
        // one level down propagates through the outer recursive call.
        /** @type {Dir} */
        const root = { 'src': [vec8(0x1n)], 'a': { 'b': [vec8(0x2n)] } }
        const [, result] = virtual({ ...emptyState, root })(rename('src', 'a/b/c'))
        assert(result[0] === 'error')
        assertIoMessage(result[1], 'not a directory')
    },
    createExclusiveNestedMissing: () => {
        // createExclusive('a/b') where 'a' doesn't exist: the operation
        // wrapper falls through with the full remaining path. Start from a
        // non-empty root and check it survives untouched, so a mutant that
        // returns the right error tag alongside a wiped dir would be caught.
        /** @type {Dir} */
        const root = { keep: [vec8(0x1n)] }
        const [state, result] = virtual({ ...emptyState, root })(createExclusive('a/b'))
        assert(result[0] === 'error')
        assertEq(Object.keys(state.root).length, 1)
    },
    // `writeExclusive` is `createExclusive` and `writeFile` in one step, so it
    // has both of their answers and one of its own: the name is taken, or the
    // path names nothing this runner can write, or it is created holding the
    // payload. All three, because the operation is what a lock file rests on —
    // see `WriteExclusive` in `../types.ts` for what the two separate calls let
    // through on a real host.
    writeExclusiveStates: () => {
        const payload = vec8(0x2An)
        // a free name: created, holding the payload and nothing else
        const [made, ok1] = virtual(emptyState)(writeExclusive('x.lock', payload))
        assert(ok1[0] === 'ok')
        assertStructurallySame(made.root, { 'x.lock': [payload] })
        // the same name again: `EEXIST`, and the bytes already there are kept,
        // which is the half a plain `writeFile` would get wrong
        const [again, taken] = virtual(made)(writeExclusive('x.lock', vec8(0x7Fn)))
        assert(taken[0] === 'error')
        assertIoCode(taken[1], 'EEXIST')
        assertStructurallySame(again.root, { 'x.lock': [payload] })
        // a name held by a *directory*: `EEXIST` as well, since `O_EXCL` fails on
        // the name being taken and looks no further — measured, node 22.22.2
        // answers `EEXIST` for a `wx` open of a directory where a plain `w` open
        // answers `EISDIR`. The directory is left as it was, and the payload goes
        // nowhere inside it, which is what a handler reached with an empty path
        // could otherwise do.
        /** @type {Dir} */
        const held = { 'x.lock': { inside: [payload] } }
        const [intact, isDir] = virtual({ ...emptyState, root: held })(writeExclusive('x.lock', vec8(0x7Fn)))
        assert(isDir[0] === 'error')
        assertIoCode(isDir[1], 'EEXIST')
        assertStructurallySame(intact.root, held)
        // and the same for `createExclusive`, which shares the handler because
        // the two differ in what the file holds and not in when they refuse
        const [kept2, isDir2] = virtual({ ...emptyState, root: held })(createExclusive('x.lock'))
        assert(isDir2[0] === 'error')
        assertIoCode(isDir2[1], 'EEXIST')
        assertStructurallySame(kept2.root, held)
        // An **empty** path is not the root, though `parse` collapses both to no
        // segments — so the `EEXIST` above must not reach it. Measured, node
        // 22.22.2 answers `ENOENT` for a `wx` open of `''` and `EEXIST` for one
        // of `.`; `statOnEmptyPath` pins the same pair for `stat`.
        const [, noName] = virtual({ ...emptyState, root: held })(writeExclusive('', payload))
        assert(noName[0] === 'error')
        assertIoCode(noName[1], 'ENOENT')
        const [, noName2] = virtual({ ...emptyState, root: held })(createExclusive(''))
        assert(noName2[0] === 'error')
        assertIoCode(noName2[1], 'ENOENT')
        // `.` *is* the root, and the root is a directory a name cannot be created
        // over — the control that keeps the carve-out from swallowing it.
        const [, dot] = virtual({ ...emptyState, root: held })(writeExclusive('.', payload))
        assert(dot[0] === 'error')
        assertIoCode(dot[1], 'EEXIST')
        // a name whose directory is not there: the operation wrapper falls
        // through with the whole remaining path, and nothing is created. A
        // non-empty root, so a mutant that answered the right error beside a
        // wiped directory would be caught.
        /** @type {Dir} */
        const root = { keep: [vec8(0x1n)] }
        const [state, nested] = virtual({ ...emptyState, root })(writeExclusive('a/b', payload))
        assert(nested[0] === 'error')
        assertStructurallySame(state.root, root)
        // And a `Vec` that is not whole bytes never reaches this runner at all:
        // `writeExclusive` refuses it in `../module.f.mjs`, because the node
        // runner's `fromVec` would pad the last byte and create a file holding
        // a byte the caller never gave while this one stored the vector as it
        // was. The refusal is the same one `inflate` makes.
        const [kept, unaligned] = virtual({ ...emptyState, root })(writeExclusive('x.lock', vec(4n)(0b1010n)))
        assert(unaligned[0] === 'error')
        assertIoMessage(unaligned[1], 'invalid buffer size')
        assertStructurallySame(kept.root, root)
    },
    writeBytesNestedMissing: () => {
        // writeBytes('a/b', ...) where 'a' doesn't exist. Non-empty root, as above.
        /** @type {Dir} */
        const root = { keep: [vec8(0x1n)] }
        const [state, result] = virtual({ ...emptyState, root })(writeBytes('a/b', 0, vec8(0x1n)))
        assert(result[0] === 'error')
        assertEq(Object.keys(state.root).length, 1)
    },
    writeBytesNestedThroughFile: () => {
        // `a/b` where `a` is a *file*. `operation` stops descending at the first
        // name that is not a directory, so the op is handed both segments and
        // `resolveFile`'s one-segment guard is all that stands between this and
        // an append to `a` itself. The offset is `a`'s size deliberately: that
        // is what the append-only check accepts, so without the guard this
        // write *succeeds* rather than failing for a different reason — which
        // is why the assertion is on the state, not only on the error.
        /** @type {Dir} */
        const root = { 'a': [vec8(0x42n)] }
        const [state, result] = virtual({ ...emptyState, root })(writeBytes('a/b', 1, vec8(0x1n)))
        assert(result[0] === 'error')
        assertIoCode(result[1], 'ENOENT')
        assertStructurallySame(state.root, root)
    },
    writeBytesMissingFile: () => {
        // writeBytes on a path that doesn't exist at all: writeBytes never
        // creates. Non-empty root, as above.
        /** @type {Dir} */
        const root = { keep: [vec8(0x1n)] }
        const [state, result] = virtual({ ...emptyState, root })(writeBytes('missing', 0, vec8(0x1n)))
        assert(result[0] === 'error')
        assertEq(Object.keys(state.root).length, 1)
    },
    writeBytesNotWholeBytes: () => {
        // A `Vec` that is not whole bytes never reaches this runner: `writeBytes`
        // refuses it in `../module.f.mjs`, as `writeExclusive` does, because the
        // node runner's `fromVec` would pad the last byte and write a byte the
        // caller never gave while this one appended the vector as it was. The
        // offset is the file's size, which the append-only check accepts, so
        // without the guard this write would succeed.
        /** @type {Dir} */
        const root = { 'file': [vec8(0x1n)] }
        const [state, result] = virtual({ ...emptyState, root })(writeBytes('file', 1, vec(4n)(0b1010n)))
        assert(result[0] === 'error')
        assertIoMessage(result[1], 'invalid buffer size')
        assertStructurallySame(state.root, root)
    },
    writeBytesNegativeOffset: () => {
        /** @type {Dir} */
        const root = { 'file': [vec8(0x1n)] }
        const [, result] = virtual({ ...emptyState, root })(writeBytes('file', -1, vec8(0x2n)))
        assert(result[0] === 'error')
        assertIoMessage(result[1], 'Offset -1 is invalid')
    },
    statNestedMissing: () => {
        // stat('a/b') where 'a' doesn't exist.
        const [, result] = virtual(emptyState)(stat('a/b'))
        assert(result[0] === 'error')
    },
    statMissingFile: () => {
        const [, result] = virtual(emptyState)(stat('missing'))
        assert(result[0] === 'error')
    },
    renameSamePath: () => {
        // rename('a', 'a') should succeed as a no-op, not reject
        /** @type {Dir} */
        const root = { 'a': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(rename('a', 'a'))
        assert(result[0] === 'ok')
    },
    renameIntoOwnSubtree: () => {
        // rename('a', 'a/b') should fail (dst inside src's subtree)
        /** @type {Dir} */
        const root = { 'a': { 'b': [vec8(0x42n)] } }
        const [, result] = virtual({ ...emptyState, root })(rename('a', 'a/b'))
        assert(result[0] === 'error')
    },
    renameOntoOwnAncestor: () => {
        // rename('a/b', 'a') should fail (src inside dst's subtree)
        /** @type {Dir} */
        const root = { 'a': { 'b': [vec8(0x42n)] } }
        const [, result] = virtual({ ...emptyState, root })(rename('a/b', 'a'))
        assert(result[0] === 'error')
    },
    renameNonEmptyDirOverEmptyDir: () => {
        // rename a directory onto an empty directory should succeed
        /** @type {Dir} */
        const root = { 'src': { 'file': [vec8(0x42n)] }, 'dst': {} }
        const [, result] = virtual({ ...emptyState, root })(rename('src', 'dst'))
        assert(result[0] === 'ok')
    },
    renameEmptyDirOverNonEmptyDir: () => {
        // rename an empty directory onto a non-empty directory should fail
        /** @type {Dir} */
        const root = { 'src': {}, 'dst': { 'file': [vec8(0x42n)] } }
        const [, result] = virtual({ ...emptyState, root })(rename('src', 'dst'))
        assert(result[0] === 'error')
    },
    renameFileOntoDirectory: () => {
        // rename a file to a path that is already an existing directory should fail
        /** @type {Dir} */
        const root = { 'myfile': [vec8(0x42n)], 'mydir': {} }
        const [, result] = virtual({ ...emptyState, root })(rename('myfile', 'mydir'))
        assert(result[0] === 'error')
    },
    renameForeignArrayFileOntoDirectory: () => {
        // An array with another constructor's prototype models the observable
        // instanceof behavior of an array received from another realm.
        const foreignFile = Reflect.construct(Array, [], Object)
        assert(Array.isArray(foreignFile))
        assert(!(foreignFile instanceof Array))
        /** @type {Dir} */
        const root = { 'myfile': foreignFile, 'mydir': {} }
        const [, result] = virtual({ ...emptyState, root })(rename('myfile', 'mydir'))
        assert(result[0] === 'error')
        assertIoMessage(result[1], "'mydir' is a directory")
    },
    readFileTooLarge: () => {
        // A file stored as two max-size chunks exceeds the limit; readFile must
        // return an error, and the message must name the entry it refused —
        // without it a caller that stops on the failure reports a build broken
        // by no file in particular.
        const chunk0 = vec(maxLengthBytes * 8n)(0n)
        const chunk1 = vec(1n)(1n)
        /** @type {Dir} */
        const root = { 'big': [chunk0, chunk1] }
        const [, result] = virtual({ ...emptyState, root })(readFile('big'))
        assert(result[0] === 'error')
        assertIoMessage(
            result[1],
            `File size exceeds maximum allowed size of ${maxLengthBytes} bytes: 'big'`)
    },
    readFileTooLargeNested: () => {
        // The path the caller asked for, not the entry `operation`'s descent
        // left behind: told only `'big'`, a caller cannot tell which of several
        // same-named files failed, and the Node runner names the whole path.
        const chunk0 = vec(maxLengthBytes * 8n)(0n)
        const chunk1 = vec(1n)(1n)
        /** @type {Dir} */
        const root = { a: { b: { 'big': [chunk0, chunk1] } } }
        const [, result] = virtual({ ...emptyState, root })(readFile('a/b/big'))
        assert(result[0] === 'error')
        assertIoMessage(
            result[1],
            `File size exceeds maximum allowed size of ${maxLengthBytes} bytes: 'a/b/big'`)
    },
    readBytesNegativeSize: () => {
        // readBytes with negative size should fail
        /** @type {Dir} */
        const root = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0, -1))
        assert(result[0] === 'error')
    },
    readBytesZeroSize: () => {
        // readBytes with zero size should succeed and return empty vec
        /** @type {Dir} */
        const root = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0, 0))
        assert(result[0] === 'ok')
    },
    readBytesNegativeOffset: () => {
        // readBytes with negative offset should fail
        /** @type {Dir} */
        const root = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', -1, 1))
        assert(result[0] === 'error')
    },
    readBytesFractionalSize: () => {
        // readBytes with fractional size should fail rather than throw RangeError
        /** @type {Dir} */
        const root = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0, 1.5))
        assert(result[0] === 'error')
    },
    readBytesFractionalOffset: () => {
        // readBytes with fractional offset should fail rather than throw RangeError
        /** @type {Dir} */
        const root = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('file', 0.5, 1))
        assert(result[0] === 'error')
    },
    readBytesAcrossChunkBoundary: () => {
        // Two 128 KiB chunks; read 2 bytes spanning the boundary (last byte of chunk 0, first of chunk 1).
        const chunkSize = Number(maxLengthBytes)
        const chunk0 = vec(maxLengthBytes * 8n)(0xAAn)
        const chunk1 = vec(maxLengthBytes * 8n)(0xBBn)
        /** @type {Dir} */
        const root = { 'big': [chunk0, chunk1] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('big', chunkSize - 1, 2))
        assert(result[0] === 'ok')
    },
    writeBytesWrongOffset: () => {
        // writeBytes is append-only; an offset that doesn't match the current
        // file size must fail rather than silently create a hole.
        /** @type {Dir} */
        const root = { 'file': [vec8(0x42n)] }
        const [, result] = virtual({ ...emptyState, root })(writeBytes('file', 5, vec8(0x43n)))
        assert(result[0] === 'error')
    },
    statOnDirectory: () => {
        // A host stats a directory successfully and says it is not a file. The
        // empty remaining path is how one arrives here: `operation` has already
        // descended into it.
        /** @type {Dir} */
        const root = { docs: { 'index.html': [vec8(0x41n)] } }
        const [, result] = virtual({ ...emptyState, root })(stat('docs'))
        assert(result[0] === 'ok', result)
        assertEq(result[1].isFile, false)
        // And says *what* it is, which `!isFile` cannot: a `JsModule` below
        // answers false to both.
        assertEq(result[1].isDirectory, true)
    },
    statOnEmptyPath: () => {
        // An empty path is not the root, though `parse` collapses both to no
        // segments at all. A host answers `ENOENT`, so this does.
        const [, result] = virtual(emptyState)(stat(''))
        assert(result[0] === 'error', result)
        assertIoCode(result[1], 'ENOENT')
        // `.` *is* the root, and stats as the directory it is.
        const [, root] = virtual(emptyState)(stat('.'))
        assert(root[0] === 'ok', root)
        assertEq(root[1].isFile, false)
        assertEq(root[1].isDirectory, true)
    },
    statOnJsModule: () => {
        // A `JsModule` entry is this file system's non-regular name: it exists
        // and stats fine, and says it is not a file — the shape a host reports
        // for a FIFO or a device, and what a caller's guard against reading one
        // has to be able to see.
        /** @type {Dir} */
        const root = { 'a.f.ts': () => ({}) }
        const [, result] = virtual({ ...emptyState, root })(stat('a.f.ts'))
        assert(result[0] === 'ok', result)
        assertEq(result[1].isFile, false)
        // Neither a file nor a directory. That is why `isDirectory` is its own
        // flag: a caller asking `!isFile` for "may I descend into it" would
        // descend into a FIFO.
        assertEq(result[1].isDirectory, false)
        assertEq(result[1].size, 0)
    },
    statOnInheritedName: () => {
        // A `Dir` is a plain object, so `dir[name]` finds `Object.prototype`'s
        // names too — and this file system would have read them as entries:
        // `toString` is a function, which is its `JsModule`, and `__proto__` is
        // an object, which is a directory. A host has none of these names, so
        // every one of them is absent here.
        //
        // Reachable from an *empty* root, which is what makes it worth pinning:
        // no fixture has to contain anything for a caller to ask.
        /** @type {(path: string) => void} */
        const absent = path => {
            const [, result] = virtual(emptyState)(stat(path))
            assert(result[0] === 'error', [path, result])
            assertIoCode(result[1], 'ENOENT')
        }
        absent('toString')
        absent('constructor')
        // Not `ENOTDIR`: that answer claims the name before the slash exists,
        // which is the reading an inherited name must not earn.
        absent('toString/x')
        // `__proto__` is the one that reads as a *directory* — `operation`
        // would descend into `Object.prototype` and stat it as the root.
        absent('__proto__')
        absent('__proto__/x')
    },
    // Every operation asks the same question, so every operation answers the
    // same way. Stopping at `stat` is what made `__proto__` worse rather than
    // better: with the descent refusing it and the leaf still reading it,
    // `readFile` reached its is-a-file assertion and *threw* — out of the
    // effect's channel, where no FunctionalScript program can answer it — and
    // `rm` reported success for a name that was never there.
    inheritedNameInEveryOperation: () => {
        /** @type {<T>(e: Effect<NodeOp, T, IoChannel>) => IoChannel} */
        const failure = e => {
            const [, result] = virtual(emptyState)(e)
            assert(result[0] === 'error', result)
            return result[1]
        }
        for (const name of ['__proto__', 'toString']) {
            assertIoCode(failure(stat(name)), 'ENOENT')
            assertIoCode(failure(readFile(name)), 'ENOENT')
            assertIoCode(failure(access(name)), 'ENOENT')
            // `rm` words a missing entry its own way, and says it here too.
            assertIoMessage(failure(rm(name)), 'no such file')
            // A name that is not a `JsModule`, because it is not an entry.
            assertIoMessage(failure(import_(name)), `'${name}' is not a JsModule`)
        }
        // And an own name still works, so the guard refuses names rather than
        // lookups: `createExclusive` claims one, and the second try is `EEXIST`.
        const [claimed] = virtual(emptyState)(createExclusive('__proto__'))
        assertEq(Object.keys(claimed.root).join(), '__proto__')
        const [, again] = virtual(claimed)(createExclusive('__proto__'))
        assert(again[0] === 'error', again)
        assertIoCode(again[1], 'EEXIST')
    },
    // An entry genuinely named `__proto__` is not what the guard refuses, and
    // a fixture writes one with a **computed key** — the spelling that makes an
    // own property. `{ '__proto__': e }` sets the prototype instead, which is
    // why FunctionalScript's own parser refuses that form (`protoKey` in
    // `../../../fsc/parser/proof.f.mjs`); it was never a working fixture here
    // either, since `readdir` walks own entries and would have listed the
    // directory as empty.
    protoKeyFixture: () => {
        /** @type {Dir} */
        const root = { ['__proto__']: [utf8('hi')] }
        const [, s] = virtual({ ...emptyState, root })(stat('__proto__'))
        assert(s[0] === 'ok', s)
        assertEq(s[1].isFile, true)
        const [, f] = virtual({ ...emptyState, root })(readFile('__proto__'))
        assert(f[0] === 'ok', f)
        assertEq(utf8ToString(f[1]), 'hi')
        // And the listing agrees, which is the half the refused spelling lost.
        const [, d] = virtual({ ...emptyState, root })(readdir('.', {}))
        assert(d[0] === 'ok', d)
        assertEq(d[1].map(e => e.name).join(), '__proto__')
    },
    // The writing half, which the reads above do not reach: one proof per
    // remaining lookup, so a regression confined to a single operation cannot
    // hide behind the shared helper.
    inheritedNameInWrites: () => {
        const payload = utf8('x')
        // `writeFile` **creates** it: an inherited name is absent, and writing
        // to an absent name is what this operation is for. Before the guard,
        // `dir['toString']` was a function and the write was refused as
        // "invalid file".
        const [written, result] = virtual(emptyState)(writeFile('toString', payload))
        assert(result[0] === 'ok', result)
        assertEq(Object.keys(written.root).join(), 'toString')
        // And what comes back is the payload, not the inherited function.
        const [, read] = virtual(written)(readFile('toString'))
        assert(read[0] === 'ok', read)
        assertEq(utf8ToString(read[1]), 'x')
        // The two positional operations refuse it, neither creating nor
        // reading `Object.prototype`.
        const [, bytes] = virtual(emptyState)(readBytes('toString', 0, 1))
        assert(bytes[0] === 'error', bytes)
        assertIoCode(bytes[1], 'ENOENT')
        const [, put] = virtual(emptyState)(writeBytes('toString', 0, payload))
        assert(put[0] === 'error', put)
        assertIoCode(put[1], 'ENOENT')
        // `rename` reads through both halves: `extractEntity` for the source,
        // `insertEntityAt` for the destination.
        const [, moved] = virtual(emptyState)(rename('toString', 'a.txt'))
        assert(moved[0] === 'error', moved)
        assertIoCode(moved[1], 'ENOENT')
        // Renaming *onto* one is an ordinary create, not an overwrite of
        // whatever `Object.prototype` holds there.
        /** @type {Dir} */
        const root = { 'a.txt': [vec8(0x41n)] }
        const [renamed, onto] = virtual({ ...emptyState, root })(rename('a.txt', '__proto__'))
        assert(onto[0] === 'ok', onto)
        assertEq(Object.keys(renamed.root).join(), '__proto__')
    },
    statOnRegularFile: () => {
        /** @type {Dir} */
        const root = { 'a.txt': [vec8(0x41n)] }
        const [, result] = virtual({ ...emptyState, root })(stat('a.txt'))
        assert(result[0] === 'ok', result)
        assertEq(result[1].isFile, true)
        assertEq(result[1].isDirectory, false)
        assertEq(result[1].size, 1)
    },
    statThroughNonDirectory: () => {
        // A path that descends through a name which is not a directory is
        // `ENOTDIR` — the name exists and has nothing under it — where a path
        // whose *first* missing segment is simply absent stays `ENOENT`. A POSIX
        // host draws the same line, and a caller that maps one of the two to its
        // own answer cannot be proven against a runner that reports both alike.
        /** @type {Dir} */
        const root = { 'a.txt': [vec8(0x41n)], 'm.f.ts': () => ({}), docs: {} }
        /** @type {(path: string) => string | undefined} */
        const code = path => {
            const [, result] = virtual({ ...emptyState, root })(stat(path))
            assert(result[0] === 'error', result)
            assert(result[1][0] === 'ioError', result[1])
            return result[1][1].code
        }
        assertEq(code('a.txt/index.html'), 'ENOTDIR')
        // Any depth below it, and a `JsModule` is no more descendable.
        assertEq(code('a.txt/x/y'), 'ENOTDIR')
        assertEq(code('m.f.ts/index.html'), 'ENOTDIR')
        // Absent names stay `ENOENT`, whether the missing segment is the last
        // one or the one being descended through.
        assertEq(code('nope.txt/index.html'), 'ENOENT')
        assertEq(code('docs/nope.html'), 'ENOENT')
    },
    // `mkdir` under a directory `x`, for every kind of entry `x/a` can be and
    // both values of `recursive` — the tables in `mkdirOp`'s JSDoc, row for row,
    // each measured on node 22.22.2. The **absent** rows are the ones that pin
    // the guard order: asked by length alone, `x/a/b` would answer `ENOTDIR`
    // there. Every refusal also asserts the tree is untouched, since the defect
    // this replaces was a success that turned the file `x/a` into an empty
    // directory.
    mkdirOverEachEntry: () => {
        const file = [vec8(0x41n)]
        /** @type {(a: Dir[string]) => Dir} */
        const rootWith = a => ({ x: a === undefined ? {} : { a } })
        /** @type {(a: Dir[string], path: string, recursive: boolean) => readonly [Dir, string | undefined]} */
        const run = (a, path, recursive) => {
            const [state, result] = virtual({ ...emptyState, root: rootWith(a) })(
                mkdir(path, recursive ? { recursive: true } : undefined))
            if (result[0] === 'ok') { return [state.root, 'ok'] }
            assert(result[1][0] === 'ioError', result[1])
            // a refusal creates nothing
            assertStructurallySame(state.root, rootWith(a))
            return [state.root, result[1][1].code]
        }
        // `x/a/b`
        const [absentRec, absentRecCode] = run(undefined, 'x/a/b', true)
        assertEq(absentRecCode, 'ok')
        assertStructurallySame(absentRec, { x: { a: { b: {} } } })
        assertEq(run(undefined, 'x/a/b', false)[1], 'ENOENT')
        const [dirRec, dirRecCode] = run({}, 'x/a/b', true)
        assertEq(dirRecCode, 'ok')
        assertStructurallySame(dirRec, { x: { a: { b: {} } } })
        const [dirNonRec, dirNonRecCode] = run({}, 'x/a/b', false)
        assertEq(dirNonRecCode, 'ok')
        assertStructurallySame(dirNonRec, { x: { a: { b: {} } } })
        assertEq(run(file, 'x/a/b', true)[1], 'ENOTDIR')
        assertEq(run(file, 'x/a/b', false)[1], 'ENOTDIR')
        // any depth below the file, and a `JsModule` is no more a directory
        assertEq(run(file, 'x/a/b/c', true)[1], 'ENOTDIR')
        assertEq(run(() => ({}), 'x/a/b', true)[1], 'ENOTDIR')
        // `x/a`
        const [absent, absentCode] = run(undefined, 'x/a', false)
        assertEq(absentCode, 'ok')
        assertStructurallySame(absent, { x: { a: {} } })
        const [kept, keptCode] = run({ b: file }, 'x/a', true)
        assertEq(keptCode, 'ok')
        assertStructurallySame(kept, { x: { a: { b: file } } })
        assertEq(run({ b: file }, 'x/a', false)[1], 'EEXIST')
        assertEq(run(file, 'x/a', true)[1], 'EEXIST')
        assertEq(run(file, 'x/a', false)[1], 'EEXIST')
        assertEq(run(() => ({}), 'x/a', true)[1], 'EEXIST')
    },
    // An empty path is not the root, though `parse` collapses both to no
    // segments. Measured on node 22.22.2: `''` is `ENOENT` either way, where
    // `.` is `ok` when recursive and `EEXIST` when not.
    mkdirOnEmptyPath: () => {
        /** @type {(path: string, recursive: boolean) => string | undefined} */
        const code = (path, recursive) => {
            const [state, result] = virtual(emptyState)(
                mkdir(path, recursive ? { recursive: true } : undefined))
            assertStructurallySame(state.root, emptyState.root)
            if (result[0] === 'ok') { return 'ok' }
            assert(result[1][0] === 'ioError', result[1])
            return result[1][1].code
        }
        assertEq(code('', true), 'ENOENT')
        assertEq(code('', false), 'ENOENT')
        assertEq(code('.', true), 'ok')
        assertEq(code('.', false), 'EEXIST')
    },
    largeFileReadBytes: () => {
        // A file stored as two 128 KiB chunks is larger than maxLengthBytes.
        // readBytes within the second chunk (offset = 128 KiB, size = 1) should succeed.
        const chunkSize = Number(maxLengthBytes)
        const chunk0 = vec(maxLengthBytes * 8n)(0n)
        const chunk1 = vec(maxLengthBytes * 8n)(0xFFn)
        /** @type {Dir} */
        const root = { 'large': [chunk0, chunk1] }
        const [, result] = virtual({ ...emptyState, root })(readBytes('large', chunkSize, 1))
        assert(result[0] === 'ok')
    },
    // Slots, and the one input they refuse. This runner stands in for
    // `../memory/module.mjs`, so it owes that interpreter's answers: a key it
    // never handed out is a caller bug there and a caller bug here.
    memory: {
        roundTrip: () => {
            const e = step(
                memCreate(1),
                key => step(memWrite(key, 42), () => memRead(key)))
            const [state, result] = virtual(emptyState)(e)
            assert(result[0] === 'ok', result)
            assertEq(result[1], 42)
            assertEq(state.memory.values.mem0, 42, state)
        },
        // What makes presence the test rather than the value: a slot holding
        // `undefined` was allocated, and reading one is not the failure below.
        // A guard written as `=== undefined` would answer them alike.
        holdsUndefined: () => {
            const e = step(memCreate(undefined), key => memRead(key))
            const [, result] = virtual(emptyState)(e)
            assert(result[0] === 'ok', result)
            assertEq(result[1], undefined)
        },
        // `mem0` is the name `memCreate` would hand out first, so these are
        // not spellings no run could produce — they are the slot a caller
        // forgot to allocate.
        throw: {
            readOfNeverCreated: () => {
                /** @type {Key<number>} */
                const key = asNominal('mem0')
                virtual(emptyState)(memRead(key))
            },
            writeToNeverCreated: () => {
                /** @type {Key<number>} */
                const key = asNominal('mem0')
                virtual(emptyState)(memWrite(key, 1))
            },
        },
    },
    // An open file as a value. What these are for is the one property no
    // path-taking operation has: what the reads come from cannot be replaced
    // underneath them.
    handles: {
        // The round trip, and the state afterwards: opening adds an entry,
        // closing takes it away, so a proof can see a handle that was not given
        // back.
        openReadClose: () => {
            /** @type {Dir} */
            const root = { 'a.bin': [vec8(0x41n), vec8(0x42n), vec8(0x43n)] }
            const e = step(open('a.bin'), handle => step(pread(handle, 1, 2), taken =>
                step(close(handle), () => pureOk(taken))))
            const [s, result] = virtual({ ...emptyState, root })(e)
            assertEq(utf8ToString(unwrap(result)), 'BC')
            assertEq(s.handles.length, 0)
        },
        // **The one-inode claim.** The entry is replaced while the handle is
        // open — by `rename`, which is how an atomic replacement lands — and the
        // read still answers the bytes the open resolved to. A reader that went
        // back to the *name* would answer the new file's, and where the two are
        // the same length nothing downstream could tell.
        //
        // Measured the same way through a real descriptor on Darwin with Node
        // 26.8.1: a file renamed over the name a handle was opened on is still
        // read as the bytes the handle opened.
        namesAnInode: () => {
            /** @type {Dir} */
            const root = { 'a.bin': [utf8('old')], 'b.bin': [utf8('new')] }
            const e = step(open('a.bin'), handle =>
                step(rename('b.bin', 'a.bin'), () =>
                    step(fstat(handle), s =>
                        step(pread(handle, 0, 8), taken => pureOk([s.size, utf8ToString(taken)])))))
            const [, result] = virtual({ ...emptyState, root })(e)
            assertStructurallySame(unwrap(result), [3, 'old'])
            // And the name now holds the other file, so the fixture really did
            // replace it.
            const [, after] = virtual({ ...emptyState, root })(step(rename('b.bin', 'a.bin'), () => readFile('a.bin')))
            assertEq(utf8ToString(unwrap(after)), 'new')
        },
        // `fstat` answers about the entity the handle holds, and the three kinds
        // it can be are the three `stat` reports for a name.
        kinds: () => {
            /** @type {Dir} */
            const root = { 'a.bin': [utf8('12345')], dir: {}, 'pipe.txt': () => ({}) }
            /** @type {(path: string) => readonly[number, boolean, boolean]} */
            const kindOf = path => {
                const [, r] = virtual({ ...emptyState, root })(step(open(path), handle => fstat(handle)))
                const { size, isFile, isDirectory } = unwrap(r)
                return [size, isFile, isDirectory]
            }
            assertStructurallySame(kindOf('a.bin'), [5, true, false])
            assertStructurallySame(kindOf('dir'), [0, false, true])
            // The entry standing in for a FIFO, a device or a socket: it exists
            // and is neither, which is what `isDirectory` is a second flag for.
            assertStructurallySame(kindOf('pipe.txt'), [0, false, false])
            // The root itself opens, as a directory does on POSIX.
            assertStructurallySame(kindOf('.'), [0, false, true])
        },
        // Reading what is not a regular file. A directory is `EISDIR`, measured
        // through a descriptor opened on one; the FIFO stand-in answers nought
        // bytes, which is what a non-blocking read of a writerless FIFO answered
        // on the same host. Both are values rather than panics, because a
        // caller's branch for them is only reachable if the runner returns one.
        readsThatAreNotFiles: () => {
            /** @type {Dir} */
            const root = { dir: {}, 'pipe.txt': () => ({}) }
            /** @type {(path: string) => IoResult<Vec>} */
            const readOf = path =>
                virtual({ ...emptyState, root })(step(open(path), handle => pread(handle, 0, 8)))[1]
            const directory = readOf('dir')
            assert(directory[0] === 'error', directory)
            assertIoCode(directory[1], 'EISDIR')
            assertEq(length(unwrap(readOf('pipe.txt'))), 0n)
        },
        // Reading through a handle that was given back is the host's own
        // `EBADF`, measured on Darwin with Node 26.8.1 for both operations. A
        // runner answering anything else would hand a caller a branch it cannot
        // reach on the host it ships against.
        closedIsBadDescriptor: () => {
            /** @type {Dir} */
            const root = { 'a.bin': [utf8('12345')] }
            /** @type {<T>(f: (handle: Handle) => Effect<NodeOp, T, IoChannel>) => IoChannel} */
            const afterClose = f => {
                const e = step(open('a.bin'), handle => step(close(handle), () => f(handle)))
                const [, r] = virtual({ ...emptyState, root })(e)
                assert(r[0] === 'error', r)
                return r[1]
            }
            assertIoCode(afterClose(handle => pread(handle, 0, 1)), 'EBADF')
            assertIoCode(afterClose(handle => fstat(handle)), 'EBADF')
        },
        // A second close is `ok`, which is the host's answer and not a
        // convenience: a caller that cannot tell whether it has already released
        // a handle may release it again.
        closingTwice: () => {
            /** @type {Dir} */
            const root = { 'a.bin': [utf8('1')] }
            const e = step(open('a.bin'), handle => step(close(handle), () => close(handle)))
            const [s, result] = virtual({ ...emptyState, root })(e)
            assertEq(result[0], 'ok', result)
            assertEq(s.handles.length, 0)
        },
        // The codes an open fails with are the ones `stat` fails with, and all
        // three were measured through `open` itself on Darwin with Node 26.8.1.
        openFailures: () => {
            /** @type {Dir} */
            const root = { 'a.bin': [utf8('1')] }
            /** @type {(path: string) => IoChannel} */
            const refusal = path => {
                const [s, r] = virtual({ ...emptyState, root })(open(path))
                assert(r[0] === 'error', r)
                // Nothing was opened, so nothing is owed back.
                assertEq(s.handles.length, 0)
                return r[1]
            }
            assertIoCode(refusal(''), 'ENOENT')
            assertIoCode(refusal('nope'), 'ENOENT')
            assertIoCode(refusal('a.bin/under'), 'ENOTDIR')
        },
        // `readChunks` over a handle source is the body `fjs/web` answers with:
        // one open, chunks bounded by the size the `fstat` gave.
        chunkedThroughOneOpen: () => {
            /** @type {Dir} */
            const root = { 'a.bin': [utf8('abcdefghij')] }
            /** @type {(bound: number) => readonly string[]} */
            const chunksOf = bound => {
                /** @type {(s: State, e: List<NodeOp, Vec, IoChannel>, out: readonly string[]) => readonly string[]} */
                const drain = (s, e, out) => {
                    const [next, cell] = virtual(s)(e)
                    const node = unwrap(cell)
                    return node === undefined
                        ? out
                        : drain(next, node.tail, [...out, utf8ToString(node.first)])
                }
                const [s, r] = virtual({ ...emptyState, root })(open('a.bin'))
                return drain(s, readChunks(handleSource(unwrap(r)), bound), [])
            }
            assertStructurallySame(chunksOf(10), ['abcdefghij'])
            // The bound is what the reads stop at, not the end of the file.
            assertStructurallySame(chunksOf(4), ['abcd'])
        },
        throw: {
            // **An unreleased handle fails a test.** This is the instrument the
            // `fjs/web` proofs read, shown failing on a listener that opens a
            // file and writes the pure end as its `release` — the mistake the
            // required field exists to make impossible to write by accident.
            // Without the assertion below, such a listener leaks one descriptor
            // per request and nothing anywhere reports it.
            unreleasedHandle: () => {
                /** @type {Dir} */
                const root = { 'a.bin': [utf8('leaked')] }
                /** @type {RequestListener<NodeOp>} */
                const leaks = () => resultMapStep(open('a.bin'), r => ok({
                    status: 200,
                    headers: { 'content-length': '6' },
                    body: readChunks(handleSource(unwrap(r)), 6),
                    release: holdsNothing,
                }))
                const [s] = answerOne(leaks, requested('GET'), { ...emptyState, root })
                assertEq(s.handles.length, 0, s.handles)
            },
        },
    },
    // A server without a socket: `createServer` stores the listener and
    // `listen` hands it the requests the fixture queued, which is what makes a
    // request-in / response-out proof possible here at all.
    http: {
        answersQueuedRequests: () => {
            /** @type {(url: string) => IncomingMessage} */
            const get = url => ({ method: 'GET', url, headers: {}, body: empty, chunkedResponse: true })
            /** @type {RequestListener<NodeOp>} */
            const listener = ({ url }) =>
                pureOk({ status: 200, headers: {}, body: ofChunks([utf8(`echo ${url}`)]), release: holdsNothing })
            const e = step(createServer(listener), server => listen(server, 8080, '127.0.0.1'))
            /** @type {State} */
            const state = { ...emptyState, requests: [get('/a'), get('/b')] }
            const [s, result] = virtual(state)(e)
            assert(result[0] === 'ok', result)
            assertEq(s.listening.map(b => b.address).join(), '127.0.0.1:8080')
            // The queue is emptied, so a second `listen` cannot answer the same
            // request twice.
            assertEq(s.requests.length, 0)
            assertEq(s.responses.map(responseText).join(', '), 'echo /a, echo /b')
        },
        // Two servers in one program are two servers here, as they are on a
        // host: `listen` answers with the listener its *handle* carries, not
        // with whichever was created last.
        dispatchesThroughTheHandle: () => {
            /** @type {(name: string) => RequestListener<NodeOp>} */
            const named = name => () =>
                pureOk({ status: 200, headers: {}, body: ofChunks([utf8(name)]), release: holdsNothing })
            // Flat, because the third link needs the *first* one's value: a
            // history carries `a` forward instead of a nested continuation
            // closing over it.
            const created = history(createServer(named('a')))
            const both = historyStep(created, () => createServer(named('b')))
            const first = step(both, ([, a]) => listen(a, 8080, '127.0.0.1'))
            /** @type {State} */
            const state = {
                ...emptyState,
                requests: [requested('GET')],
            }
            const [s, result] = virtual(state)(first)
            assert(result[0] === 'ok', result)
            assertEq(responseText(s.responses[0]), 'a')
        },
        // A port a host would refuse is refused here, or a program that cannot
        // run anywhere could still be proven.
        badPort: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () =>
                pureOk({ status: 200, headers: {}, body: endOfBody(), release: holdsNothing })
            /** @type {(port: number) => void} */
            const rejects = port => {
                const e = step(createServer(listener), server => listen(server, port, '127.0.0.1'))
                const [s, result] = virtual(emptyState)(e)
                assert(result[0] === 'error', result)
                assertIoCode(result[1], 'ERR_SOCKET_BAD_PORT')
                // The message is Node's own, type and all — the shape is the
                // claim this runner makes.
                assertIoMessage(
                    result[1],
                    `options.port should be >= 0 and < 65536. Received type number (${port}).`)
                assertEq(s.listening.length, 0)
            }
            rejects(-1)
            rejects(1.5)
            rejects(65536)
            rejects(NaN)
        },
        // Port `0` names no port: two servers asking the host for a free one
        // both get one, so refusing the second would reject a program that runs.
        ephemeralPorts: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () =>
                pureOk({ status: 200, headers: {}, body: endOfBody(), release: holdsNothing })
            const first = history(createServer(listener))
            const second = historyStep(first, () => createServer(listener))
            const bound = historyStep(second, b => listen(b, 0, '127.0.0.1'))
            const e = step(bound, ([, , a]) => listen(a, 0, '127.0.0.1'))
            const [s, result] = virtual(emptyState)(e)
            assert(result[0] === 'ok', result)
            assertEq(s.listening.length, 2)
        },
        // Binding fails here the way it fails on a host, which is the whole
        // point of `Listen` being fallible: a program that mishandles either
        // failure must not look correct against this runner.
        addressInUse: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () =>
                pureOk({ status: 200, headers: {}, body: endOfBody(), release: holdsNothing })
            const first = history(createServer(listener))
            const second = historyStep(first, () => createServer(listener))
            // `historyStep` spreads the history over its continuation, newest
            // first: `b` here is the second server, and `a` the first.
            const bound = historyStep(second, b => listen(b, 8080, '127.0.0.1'))
            const e = step(bound, ([, , a]) => listen(a, 8080, '127.0.0.1'))
            const [s, result] = virtual(emptyState)(e)
            assert(result[0] === 'error', result)
            assertIoCode(result[1], 'EADDRINUSE')
            // The first server keeps the address it took.
            assertEq(s.listening.length, 1)
        },
        // A DNS name is case-insensitive, so `LOCALHOST` takes the address
        // `localhost` then asks for — checked on Linux with Node 22.22.2 and on
        // Darwin with Node 23.11.0, where the second bind is `EADDRINUSE`.
        addressInUseIgnoresCase: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () =>
                pureOk({ status: 200, headers: {}, body: endOfBody(), release: holdsNothing })
            const first = history(createServer(listener))
            const second = historyStep(first, () => createServer(listener))
            const bound = historyStep(second, b => listen(b, 8080, 'LOCALHOST'))
            const e = step(bound, ([, , a]) => listen(a, 8080, 'localhost'))
            const [s, result] = virtual(emptyState)(e)
            assert(result[0] === 'error', result)
            assertIoCode(result[1], 'EADDRINUSE')
            assertIoMessage(
                result[1],
                'listen EADDRINUSE: address already in use localhost:8080')
            // Recorded lower-cased, whichever case asked for it.
            assertEq(s.listening.length, 1)
            assertEq(s.listening[0].address, 'localhost:8080')
        },
        // `''` is the host a program did not state, and Node binds every
        // interface for it — so both runners refuse it rather than forward it.
        emptyHostRefused: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () =>
                pureOk({ status: 200, headers: {}, body: endOfBody(), release: holdsNothing })
            const created = history(createServer(listener))
            const e = step(created, ([server]) => listen(server, 8080, ''))
            const [s, result] = virtual(emptyState)(e)
            assert(result[0] === 'error', result)
            assertIoCode(result[1], 'ERR_INVALID_ARG_VALUE')
            assertIoMessage(
                result[1],
                `The argument 'host' must not be empty. Received ''`)
            // Nothing bound.
            assertEq(s.listening.length, 0)
        },
        // And it is refused *first*: a server already listening, retried with
        // an empty host, names the host and not the state. Node has no order of
        // its own to copy here — it binds `''` — so the two runners have only
        // to agree, and the Node runner asks this before it touches the socket.
        emptyHostBeatsAlreadyListening: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () =>
                pureOk({ status: 200, headers: {}, body: endOfBody(), release: holdsNothing })
            const created = history(createServer(listener))
            const bound = historyStep(created, server => listen(server, 8080, '127.0.0.1'))
            const e = step(bound, ([, server]) => listen(server, 9090, ''))
            const [, result] = virtual(emptyState)(e)
            assert(result[0] === 'error', result)
            assertIoCode(result[1], 'ERR_INVALID_ARG_VALUE')
        },
        alreadyListening: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () =>
                pureOk({ status: 200, headers: {}, body: endOfBody(), release: holdsNothing })
            /** @type {(second: number) => IoChannel} */
            const again = second => {
                const created = history(createServer(listener))
                const bound = historyStep(created, server => listen(server, 8080, '127.0.0.1'))
                const e = step(bound, ([, server]) => listen(server, second, '127.0.0.1'))
                const [, result] = virtual(emptyState)(e)
                assert(result[0] === 'error', result)
                return result[1]
            }
            assertIoCode(again(9090), 'ERR_SERVER_ALREADY_LISTEN')
            // And it is asked before the port is: a server already listening
            // reports this for a port no server could take, where the same
            // value on a fresh server is `ERR_SOCKET_BAD_PORT`. That is the
            // order Node asks in, checked on Linux with Node 22.22.2 and on
            // Darwin with Node 23.11.0.
            assertIoCode(again(-1), 'ERR_SERVER_ALREADY_LISTEN')
            assertIoCode(again(65536), 'ERR_SERVER_ALREADY_LISTEN')
            assertIoCode(again(NaN), 'ERR_SERVER_ALREADY_LISTEN')
        },
        // `forever` is the operation this runner cannot answer — its result
        // type leaves it nothing but `notImplemented` to return — so a server
        // program run here ends where it would otherwise have blocked.
        foreverIsNotImplemented: () => {
            const [, result] = virtual(emptyState)(forever())
            assert(result[0] === 'error', result)
            assertEq(result[1][1], 'forever')
        },
        // **Gate 2: the producer is never pulled.** Node drops the body of a
        // `HEAD`, a `204`, a `304` or a `1xx` and answers `true` to every write
        // it discards, so a pump that ran would read a whole file at the speed of
        // the disk to send nothing — and would never finish at all for a producer
        // that does not end. The body here fails on its first cell, so a recorded
        // `failure` of `null` says the pump did not ask.
        //
        // The declared length still goes out: a `HEAD` client learns the size it
        // asked for, which is the one thing a `HEAD` is for, and a length with no
        // body behind it is a complete answer rather than an underrun.
        suppressesABodyNodeWillNotCarry: () => {
            /** @type {RequestListener<NodeOp>} */
            const listener = () => pureOk({
                status: 200,
                headers: { 'content-length': '7' },
                body: neverPulled,
                release: recordRelease,
            })
            /** @type {(method: string, status: number) => void} */
            const suppressed = (method, status) => {
                /** @type {RequestListener<NodeOp>} */
                const answering = () => resultMapStep(listener(requested(method)), r =>
                    ok({ ...unwrap(r), status }))
                const [s, r] = answerOne(answering, requested(method))
                assertEq(r.status, status)
                assertEq(r.body.length, 0)
                assertEq(r.failure, null)
                assertEq(`${r.headers['content-length']}`, '7')
                // And `release` ran, once, though nothing was pulled: the handle
                // a listener opened for a body the runner then drops is the leak
                // the field exists to prevent.
                assertEq(s.stdout, `${released}\n`)
            }
            suppressed('HEAD', 200)
            suppressed('GET', 204)
            suppressed('GET', 304)
            suppressed('GET', 199)
            // `205` forbids a body too and Node sends one anyway, so the set is
            // the host's rather than the RFC's: a guard written from the
            // specification would suppress a body the host was about to send.
            const [, sent] = answerOne(
                () => pureOk({
                    status: 205,
                    headers: { 'content-length': '7' },
                    body: ofChunks([utf8('carried')]),
                    release: recordRelease,
                }),
                requested('GET'))
            assertEq(responseText(sent), 'carried')
            assertEq(sent.failure, null)
        },
        // **Gate 1: framing is between the runner and the socket.** A listener
        // that writes a `Transfer-Encoding` is refused before the headers, and
        // the refusal is the runner's own frame rather than the listener's — as
        // it is on a socket. Node takes such a header over its own default and
        // reads it with a regular expression, so restating that rule here would
        // be wrong in the cases it was written for: `x-chunked` and
        // `chunked, gzip` both make Node chunk a body that no client de-chunks.
        refusesAListenersFraming: () => {
            /** @type {(spelling: string) => void} */
            const refused = spelling => {
                const [s, r] = answerOne(
                    () => pureOk({
                        status: 200,
                        headers: { [spelling]: 'chunked', 'content-length': '7' },
                        body: neverPulled,
                        release: recordRelease,
                    }),
                    requested('GET'))
                assertEq(r.status, 500)
                assertEq(responseText(r), `${framingHeaderMessage}\n`)
                // Nothing of the listener's body was pulled, and the handle came
                // back all the same.
                assertEq(r.failure, null)
                assertEq(s.stdout, `${released}\n`)
            }
            refused('transfer-encoding')
            // Matched the way Node matches a header name, case-insensitively: a
            // runner comparing the key exactly would forward the header it is
            // written to refuse.
            refused('Transfer-Encoding')
        },
        // **Gate 3: a body that cannot be framed is refused rather than sent.**
        // A response with no `Content-Length`, on a request the host will not
        // frame chunked, is delimited by the connection closing — so a producer
        // that fails mid-body hands the client a truncated body it reads as
        // whole, byte for byte the same response a complete one would have been.
        // There is no terminator to withhold, so the refusal comes first.
        refusesAnUnframedBody: () => {
            /** @type {(headers: Record<string, string>, chunkedResponse: boolean) => RecordedResponse} */
            const answered = (headers, chunkedResponse) => answerOne(
                () => pureOk({
                    status: 200,
                    headers,
                    body: ofChunks([utf8('carried')]),
                    release: recordRelease,
                }),
                requested('GET', {}, chunkedResponse))[1]
            const refused = answered({}, false)
            assertEq(refused.status, 500)
            assertEq(responseText(refused), `${unframedBodyMessage}\n`)
            // A request the host *will* frame chunked needs no length at all.
            assertEq(answered({}, true).status, 200)
            // And a length restores the answer on the request that has no
            // chunking: this server answers HTTP/1.0 perfectly well for a body
            // whose size it knows, which is why the refusal is `500` and not
            // `505`.
            assertEq(answered({ 'content-length': '7' }, false).status, 200)
            // A `Content-Length` this runner cannot read is no declaration, so it
            // is refused exactly where an absent one is.
            assertEq(answered({ 'content-length': 'seven' }, false).status, 500)
        },
        // **The order the gates are asked in.** They overlap, so each of these
        // is a request two of them fire on, and the answer says which was asked
        // first. Both runners take them in this order or they disagree about a
        // request neither has any trouble with.
        gateOrder: () => {
            // Gate 1 before gate 2: the response is malformed whatever body this
            // particular request would have carried.
            const framing = answerOne(
                () => pureOk({
                    status: 200,
                    headers: { 'transfer-encoding': 'chunked', 'content-length': '7' },
                    body: neverPulled,
                    release: holdsNothing,
                }),
                requested('HEAD'))[1]
            assertEq(framing.status, 500)
            assertEq(responseText(framing), `${framingHeaderMessage}\n`)
            // Gate 2 before gate 3: a `HEAD` is a complete answer whatever
            // framing the body it does not carry would have had, so the other
            // order answers `500` to a request this server can satisfy exactly.
            const suppressed = answerOne(
                () => pureOk({
                    status: 200,
                    headers: {},
                    body: neverPulled,
                    release: holdsNothing,
                }),
                requested('HEAD', {}, false))[1]
            assertEq(suppressed.status, 200)
            assertEq(suppressed.body.length, 0)
            assertEq(suppressed.failure, null)
        },
        // **The count, at the end it is usually wrong at.** A chunk that would
        // carry the body past the length already declared is a failed cell:
        // *none* of it is recorded, because a body exactly as long as it promised
        // is a body every client reads as whole. On a host the surplus is parsed
        // as the next response's status line, so the request being answered is
        // lost along with the one behind it.
        overrun: () => {
            const [s, r] = answerOne(
                () => pureOk({
                    status: 200,
                    headers: { 'content-length': '6' },
                    body: ofChunks([utf8('abc'), utf8('defgh')]),
                    release: recordRelease,
                }),
                requested('GET'))
            assertStructurallySame(r.failure, ['overrun', 6])
            // The chunk before it went out; the one that would have overrun did
            // not, whole or in part.
            assertEq(responseText(r), 'abc')
            assertEq(s.stdout, `${released}\n`)
        },
        // **And at the other end, which the host does not answer at all.** A body
        // that simply stops is as ordinary as one that overshoots, and on a host
        // nothing on the server side notices: the socket goes back into the
        // keep-alive pool and what tells the client is the idle timeout, or the
        // next response's status line read as the tail of this body.
        underrun: () => {
            const [s, r] = answerOne(
                () => pureOk({
                    status: 200,
                    headers: { 'content-length': '10' },
                    body: ofChunks([utf8('abc')]),
                    release: recordRelease,
                }),
                requested('GET'))
            assertStructurallySame(r.failure, ['underrun', 10])
            assertEq(responseText(r), 'abc')
            assertEq(s.stdout, `${released}\n`)
        },
        // A body exactly as long as it said is the whole answer, and the one a
        // proof has to be able to tell from both of the above.
        exactLength: () => {
            const [s, r] = answerOne(
                () => pureOk({
                    status: 200,
                    headers: { 'content-length': '6' },
                    body: ofChunks([utf8('abc'), utf8('def')]),
                    release: recordRelease,
                }),
                requested('GET'))
            assertEq(r.failure, null)
            assertEq(responseText(r), 'abcdef')
            assertEq(bodyBytes(r), 6)
            assertEq(s.stdout, `${released}\n`)
        },
        // A body with no declared length has nothing to fall short of, so it ends
        // where the producer ends it.
        unmeasuredBody: () => {
            const [, r] = answerOne(
                () => pureOk({
                    status: 200,
                    headers: {},
                    body: ofChunks([utf8('abc')]),
                    release: holdsNothing,
                }),
                requested('GET'))
            assertEq(r.failure, null)
            assertEq(responseText(r), 'abc')
        },
        // The cell's own failure is the producer's rather than the runner's, and
        // the record keeps them apart: a proof that could not tell this from the
        // count's destroy could not assert the count at all.
        cellFailure: () => {
            const [s, r] = answerOne(
                () => pureOk({
                    status: 200,
                    headers: { 'content-length': '6' },
                    body: nonEmpty(utf8('abc'), pureError(ioError({ code: 'EIO', message: 'disk' }))),
                    release: recordRelease,
                }),
                requested('GET'))
            assert(r.failure !== null, r)
            assertIoCode(/** @type {IoChannel} */(r.failure), 'EIO')
            assertEq(responseText(r), 'abc')
            assertEq(s.stdout, `${released}\n`)
        },
    },
}
