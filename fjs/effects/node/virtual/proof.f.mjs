/**
 * @import { Dir, State, _QueuedRequest } from './types.ts'
 * @import { NodeOp, ReadRequestBytes, RequestListener, ServerResponse } from '../types.ts'
 * @import { List, Next } from '../../list/types.ts'
 * @import { All } from '../../common/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Effect, IoResult } from '../../types.ts'
 * @import { IoChannel } from '../types.ts'
 * @import { Key } from '../../memory/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { resolveFileModule, access, awaitIfPromise, exec, fetch, log, rm, rmdir, writeFile, readFile, readdir, import_, rename, readBytes, readRequestBytes, writeBytes, stat, createExclusive, writeExclusive, createServer, errorMessage, forever, listen, readWhole, notAFileCode, notAFileMessage, requestBodyOffsetMessage, mkdir } from '../module.f.mjs'
import { empty, length, maxLengthBytes, msb, vec, vec8 } from '../../../types/bit_vec/module.f.mjs'
import { history, historyStep, pureOk, resultMapStep, step } from '../../module.f.mjs'
import { ok } from '../../../types/result/module.f.mjs'
import { both } from '../../common/module.f.mjs'
import { asNominal as asNominalHandle } from '../../../types/nominal/module.f.mjs'
import { byteLength, repeat, u8ListMsb } from '../../../types/bit_vec/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { utf8, utf8ToString } from '../../../text/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, nodeProgramOptions, virtual } from './module.f.mjs'
import { do_ } from '../../module.f.mjs'
import { catchStep } from '../../module.f.mjs'
import { asNominal, create as memCreate, read as memRead, write as memWrite } from '../../memory/module.f.mjs'

/**
 * A listener that reads its whole request body and answers with it.
 *
 * **Its channel is `never` and the fold's is not**, which is the whole shape of
 * a listener that reads a body: a pull can fail — the offset refusal below is
 * how — and `RequestListener` has nowhere to propagate that to, so the failure
 * becomes a `500` carrying its message. That is the contract the type states,
 * and it is also what lets a proof read a refusal out of a response.
 *
 * The header counts the cells, because a body reassembled from one chunk and a
 * body reassembled from many are different claims and only the number tells them
 * apart.
 *
 * @type {RequestListener<ReadRequestBytes>}
 */
const echoBody = ({ body }) => {
    /** @type {(taken: readonly Vec[], rest: List<ReadRequestBytes, Vec, IoChannel>) => Effect<ReadRequestBytes, readonly Vec[], IoChannel>} */
    const loop = (taken, rest) => step(rest, node =>
        node === undefined ? pureOk(taken) : loop([...taken, node.first], node.tail))
    return resultMapStep(loop([], body), r => ok(r[0] === 'ok'
        ? { status: 200, headers: { 'x-chunks': `${r[1].length}` }, body: r[1] }
        : { status: 500, headers: {}, body: [utf8(errorMessage(r[1]))] }))
}

/** A request a fixture queues, carrying `body`.
 *
 * @type {(body: readonly Vec[]) => _QueuedRequest}
 */
const posted = body => ({ method: 'POST', url: '/', headers: {}, body })

/**
 * What `listener` answered the one queued request carrying `body`, and the state
 * it left behind.
 *
 * @type {(listener: RequestListener<ReadRequestBytes | All>, body: readonly Vec[]) => readonly[State, ServerResponse]}
 */
const answered = (listener, body) => {
    const e = step(createServer(listener), server => listen(server, 8080, '127.0.0.1'))
    const [s, result] = virtual({ ...emptyState, requests: [posted(body)] })(e)
    assert(result[0] === 'ok', result)
    return [s, s.responses[0]]
}

/**
 * A recorded response body as text, its chunks joined: a body is however many
 * `Vec`s the answer takes, and a listener that writes one is the ordinary case
 * rather than the shape of the type.
 *
 * @type {(r: ServerResponse) => string}
 */
const responseText = r => utf8ToString(r.body.reduce((v, chunk) => msb.concat(v)(chunk), empty))

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
    // `rmdir` removes an empty directory and nothing else, with the codes a host
    // answers — measured on node 22.22.2. Each refusal leaves the tree exactly as
    // it was, which is the property a caller pruning after a delete relies on: a
    // directory holding anything, a sibling ref included, is never taken.
    rmdirStates: () => {
        /** @type {Dir} */
        const root = {
            empty: {},
            full: { inner: {} },
            nested: { deep: {} },
            file: [vec8(0x1n)],
        }
        /** @type {(path: string) => readonly [Dir, IoResult<void>]} */
        const removed = path => {
            const [state, r] = virtual({ ...emptyState, root })(rmdir(path))
            return [state.root, r]
        }
        /** @type {(path: string, code: string) => void} */
        const refused = (path, code) => {
            const [after, r] = removed(path)
            assert(r[0] === 'error', path)
            assertIoCode(r[1], code)
            assertStructurallySame(after, root)
        }
        // an empty directory goes, and only it
        const [gone, ok1] = removed('empty')
        assert(ok1[0] === 'ok')
        assertStructurallySame(gone, { full: { inner: {} }, nested: { deep: {} }, file: [vec8(0x1n)] })
        // nested: only the leaf, so the parent it empties stays — `rmdir` is
        // never recursive, which is what makes pruning a walk the caller owns
        const [leaf, ok2] = removed('nested/deep')
        assert(ok2[0] === 'ok')
        assertStructurallySame(leaf, { empty: {}, full: { inner: {} }, nested: {}, file: [vec8(0x1n)] })
        refused('full', 'ENOTEMPTY')
        refused('file', 'ENOTDIR')
        refused('file/x', 'ENOTDIR')
        refused('absent', 'ENOENT')
        refused('absent/deeper', 'ENOENT')
        refused('', 'ENOENT')
        refused('.', 'EINVAL')
    },
    // `rm` answers the host's codes for a path it cannot serve, presence checked
    // before length: `ENOENT` for a name absent at any depth, `ENOTDIR` for one
    // reached through a file. Both used to be messages without a code.
    rmUnservable: () => {
        /** @type {Dir} */
        const root = { file: [vec8(0x1n)] }
        for (const [path, code] of [['absent', 'ENOENT'], ['absent/deeper', 'ENOENT'], ['file/x', 'ENOTDIR']]) {
            const [state, r] = virtual({ ...emptyState, root })(rm(path))
            assert(r[0] === 'error', path)
            assertIoCode(r[1], code)
            assertStructurallySame(state.root, root)
        }
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
        const [made, ok1] = virtual(emptyState)(writeExclusive('x.lock', [payload]))
        assert(ok1[0] === 'ok')
        assertStructurallySame(made.root, { 'x.lock': [payload] })
        // the same name again: `EEXIST`, and the bytes already there are kept,
        // which is the half a plain `writeFile` would get wrong
        const [again, taken] = virtual(made)(writeExclusive('x.lock', [vec8(0x7Fn)]))
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
        const [intact, isDir] = virtual({ ...emptyState, root: held })(writeExclusive('x.lock', [vec8(0x7Fn)]))
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
        const [, noName] = virtual({ ...emptyState, root: held })(writeExclusive('', [payload]))
        assert(noName[0] === 'error')
        assertIoCode(noName[1], 'ENOENT')
        const [, noName2] = virtual({ ...emptyState, root: held })(createExclusive(''))
        assert(noName2[0] === 'error')
        assertIoCode(noName2[1], 'ENOENT')
        // `.` *is* the root, and the root is a directory a name cannot be created
        // over — the control that keeps the carve-out from swallowing it.
        const [, dot] = virtual({ ...emptyState, root: held })(writeExclusive('.', [payload]))
        assert(dot[0] === 'error')
        assertIoCode(dot[1], 'EEXIST')
        // a name whose directory is not there: the operation wrapper falls
        // through with the whole remaining path, and nothing is created. A
        // non-empty root, so a mutant that answered the right error beside a
        // wiped directory would be caught.
        /** @type {Dir} */
        const root = { keep: [vec8(0x1n)] }
        const [state, nested] = virtual({ ...emptyState, root })(writeExclusive('a/b', [payload]))
        assert(nested[0] === 'error')
        assertStructurallySame(state.root, root)
        // And a `Vec` that is not whole bytes never reaches this runner at all:
        // `writeExclusive` refuses it in `../module.f.mjs`, because the node
        // runner's `fromVec` would pad the last byte and create a file holding
        // a byte the caller never gave while this one stored the vector as it
        // was. The refusal is the same one `inflate` makes.
        const [kept, unaligned] = virtual({ ...emptyState, root })(writeExclusive('x.lock', [vec(4n)(0b1010n)]))
        assert(unaligned[0] === 'error')
        assertIoMessage(unaligned[1], 'invalid buffer size')
        assertStructurallySame(kept.root, root)
        // Every chunk is checked, not the first: a whole first chunk ahead of a
        // partial one is refused the same way, before anything is created.
        const [keptLate, late] = virtual({ ...emptyState, root })(writeExclusive('x.lock', [payload, vec(4n)(0b1010n)]))
        assert(late[0] === 'error')
        assertIoMessage(late[1], 'invalid buffer size')
        assertStructurallySame(keptLate.root, root)
        // and several whole chunks are the file's contents, in order
        const [many, ok2] = virtual(emptyState)(writeExclusive('x', [payload, vec8(0x7Fn)]))
        assert(ok2[0] === 'ok')
        assertStructurallySame(many.root, { x: [payload, vec8(0x7Fn)] })
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
            assertIoCode(failure(rm(name)), 'ENOENT')
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
    // A server without a socket: `createServer` stores the listener and
    // `listen` hands it the requests the fixture queued, which is what makes a
    // request-in / response-out proof possible here at all.
    http: {
        answersQueuedRequests: () => {
            /** @type {(url: string) => _QueuedRequest} */
            const get = url => ({ method: 'GET', url, headers: {}, body: [] })
            /** @type {RequestListener<never>} */
            const listener = ({ url }) =>
                pureOk({ status: 200, headers: {}, body: [utf8(`echo ${url}`)] })
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
            /** @type {(name: string) => RequestListener<never>} */
            const named = name => () => pureOk({ status: 200, headers: {}, body: [utf8(name)] })
            // Flat, because the third link needs the *first* one's value: a
            // history carries `a` forward instead of a nested continuation
            // closing over it.
            const created = history(createServer(named('a')))
            const both = historyStep(created, () => createServer(named('b')))
            const first = step(both, ([, a]) => listen(a, 8080, '127.0.0.1'))
            /** @type {State} */
            const state = {
                ...emptyState,
                requests: [{ method: 'GET', url: '/', headers: {}, body: [] }],
            }
            const [s, result] = virtual(state)(first)
            assert(result[0] === 'ok', result)
            assertEq(responseText(s.responses[0]), 'a')
        },
        // A port a host would refuse is refused here, or a program that cannot
        // run anywhere could still be proven.
        badPort: () => {
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: [] })
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
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: [] })
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
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: [] })
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
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: [] })
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
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: [] })
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
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: [] })
            const created = history(createServer(listener))
            const bound = historyStep(created, server => listen(server, 8080, '127.0.0.1'))
            const e = step(bound, ([, server]) => listen(server, 9090, ''))
            const [, result] = virtual(emptyState)(e)
            assert(result[0] === 'error', result)
            assertIoCode(result[1], 'ERR_INVALID_ARG_VALUE')
        },
        alreadyListening: () => {
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: [] })
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
        // **A body arriving in many small chunks is reassembled in order.** The
        // chunk boundaries are the point: a fold that kept only its last cell,
        // or joined the cells the other way round, answers the same *length* as
        // one that works, so the bytes are checked and so is the count.
        readsEveryChunkInOrder: () => {
            const chunks = Array.from({ length: 300 }, (_, i) => vec8(BigInt(i % 251)))
            const [s, r] = answered(echoBody, chunks)
            assertEq(r.status, 200)
            assertEq(`${r.headers['x-chunks']}`, '300')
            // By length and then by the first byte that differs: a body of
            // three hundred chunks printed whole names nothing a reader can act
            // on, where an index names where the order went wrong.
            const got = r.body.flatMap(v => toArray(u8ListMsb(v)))
            const sent = chunks.flatMap(v => toArray(u8ListMsb(v)))
            assertEq(got.length, sent.length)
            assertEq(got.findIndex((b, i) => b !== sent[i]), -1)
            // Drained: nothing left to hand out, and the cursor is at the end.
            const [cursor] = s.bodies
            assertEq(cursor.rest.length, 0)
            assertEq(cursor.offset, 300)
        },
        // **Two requests are two bodies, and reading one does not move the
        // other.** Each delivered request gets its own cursor, so the second
        // listener's pulls have to leave the first one's alone — which is what a
        // shared cursor, or an update that wrote over the wrong slot, would get
        // wrong while still answering the right bytes to whichever request ran
        // last.
        eachRequestHasItsOwnBody: () => {
            const e = step(createServer(echoBody), server => listen(server, 8080, '127.0.0.1'))
            const [s, result] = virtual({
                ...emptyState,
                requests: [posted([utf8('first'), utf8('!')]), posted([utf8('second')])],
            })(e)
            assert(result[0] === 'ok', result)
            assertEq(s.responses.map(responseText).join(', '), 'first!, second')
            // Two cursors, each drained to its own length.
            assertEq(s.bodies.length, 2)
            assertEq(s.bodies.map(c => `${c.rest.length}:${c.offset}`).join(), '0:6,0:6')
        },
        // **A body past the `Vec` cap is a body this runner delivers**, where
        // the Node runner used to answer `413` because there was no request
        // value to build. Each cell is a `Vec` and nothing bounds their number,
        // so the whole body is twice the cap and every byte of it arrives.
        readsPastTheVecCap: () => {
            const big = repeat(maxLengthBytes)(vec8(0x5an))
            const [, r] = answered(echoBody, [big, big])
            assertEq(r.status, 200)
            assertEq(r.body.reduce((n, v) => n + byteLength(v), 0n), maxLengthBytes * 2n)
        },
        // **A listener that answers without reading leaves the body where it
        // was**, which is what the Node runner then closes the connection over.
        // Here there is no socket, so what a proof asserts is the cursor: a
        // `rest` as long as the fixture's, and an offset of nought.
        answersWithoutReadingTheBody: () => {
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 204, headers: {}, body: [] })
            const [s, r] = answered(listener, [utf8('ignored'), utf8('entirely')])
            assertEq(r.status, 204)
            const [cursor] = s.bodies
            assertEq(cursor.offset, 0)
            assertEq(cursor.rest.length, 2)
        },
        // **A second pull on a cell already read is refused, not answered with
        // the next chunk.** A `List`'s tail is a value, so pulling one twice is
        // ordinary code; over a socket the bytes behind the cursor are gone, so
        // the second pull could only be answered with whatever comes next — a
        // body no client sent, arriving in order and whole. That is refused here
        // for the same reason it is refused there, with the shared message, so
        // the two runners cannot drift.
        refusesARePull: () => {
            /** @type {RequestListener<ReadRequestBytes>} */
            const rePull = ({ body }) => resultMapStep(
                // The same `body` twice: the first pull moves the cursor, and
                // the second names an offset the body is already past.
                step(body, () => step(body, () => pureOk(undefined))),
                r => ok(r[0] === 'ok'
                    ? { status: 200, headers: {}, body: [] }
                    : { status: 500, headers: {}, body: [utf8(errorMessage(r[1]))] }))
            const [, r] = answered(rePull, [utf8('ab'), utf8('cd')])
            assertEq(r.status, 500)
            assertEq(responseText(r), requestBodyOffsetMessage(0, 2))
        },
        // **And refused when the two pulls are at the same time**, which is the
        // same claim in the shape the Node runner nearly got wrong. This runner
        // folds `all` over its state, so a pull always reads what the pull before
        // it left, and the refusal here needs nothing added. The Node runner's
        // `all` is `Promise.all`, so it had to be made to queue its pulls to
        // answer this the same way — and the pair is here so that neither runner
        // can drift from the other on it.
        refusesAConcurrentPull: () => {
            /** @type {(one: Result<Next<ReadRequestBytes, Vec, IoChannel>, IoChannel>) => string} */
            const pulled = one => one[0] === 'error'
                ? errorMessage(one[1])
                : one[1] === undefined ? 'end' : `ok ${byteLength(one[1].first)}`
            /** @type {RequestListener<ReadRequestBytes | All>} */
            const together = ({ body }) => resultMapStep(
                both(body)(body),
                r => ok(r[0] === 'error'
                    ? { status: 503, headers: {}, body: [] }
                    : { status: 500, headers: {}, body: [utf8(r[1].map(pulled).join(' | '))] }))
            const [, r] = answered(together, [utf8('ab'), utf8('cd')])
            assertEq(r.status, 500)
            assertEq(responseText(r), `ok 2 | ${requestBodyOffsetMessage(0, 2)}`)
        },
        // **The end of a body is worth the same however often it is asked
        // for.** A pull at the offset the body ended at is not a re-pull of an
        // earlier cell — there is nothing behind the cursor to confuse it with —
        // so no bytes is the answer again rather than a refusal.
        endOfBodyRepeats: () => {
            /** @type {RequestListener<ReadRequestBytes>} */
            const twice = ({ body }) => resultMapStep(
                step(body, node => {
                    assertEq(node, undefined)
                    return step(body, again => pureOk(again))
                }),
                r => ok(r[0] === 'ok'
                    ? { status: r[1] === undefined ? 200 : 418, headers: {}, body: [] }
                    : { status: 500, headers: {}, body: [utf8(errorMessage(r[1]))] }))
            const [, r] = answered(twice, [])
            assertEq(r.status, 200)
        },
        // A handle for a body no `listen` handed out is not a value pure code
        // can build — `RequestBody` is a `Nominal` — so the only way to ask is
        // the way this proof asks, and what comes back is the offset refusal
        // rather than bytes from a cursor that was never this request's.
        refusesAMisplacedOffset: () => {
            const [, result] = virtual({ ...emptyState, bodies: [{ rest: [], offset: 7 }] })(
                readRequestBytes(asNominalHandle(0), 0, 128))
            assert(result[0] === 'error', result)
            assertEq(errorMessage(result[1]), requestBodyOffsetMessage(0, 7))
        },
        // `forever` is the operation this runner cannot answer — its result
        // type leaves it nothing but `notImplemented` to return — so a server
        // program run here ends where it would otherwise have blocked.
        foreverIsNotImplemented: () => {
            const [, result] = virtual(emptyState)(forever())
            assert(result[0] === 'error', result)
            assertEq(result[1][1], 'forever')
        },
    },
}
