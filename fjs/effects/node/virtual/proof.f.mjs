/**
 * @import { Dir, State } from './types.ts'
 * @import { IncomingMessage, NodeOp, RequestListener } from '../types.ts'
 * @import { Effect } from '../../types.ts'
 * @import { IoChannel } from '../types.ts'
 */

import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { access, awaitIfPromise, exec, fetch, log, rm, writeFile, readFile, readdir, import_, rename, readBytes, writeBytes, stat, createExclusive, createServer, forever, listen } from '../module.f.mjs'
import { empty, length, maxLengthBytes, vec, vec8 } from '../../../types/bit_vec/module.f.mjs'
import { history, historyStep, pureOk, step } from '../../module.f.mjs'
import { utf8, utf8ToString } from '../../../text/module.f.mjs'
import { emptyState, virtual } from './module.f.mjs'
import { do_ } from '../../module.f.mjs'
import { catchStep } from '../../module.f.mjs'

/**
 * Asserts that a channel error is a host failure carrying `message` — the
 * normalized shape every runner reports, virtual and Node alike.
 * @type {(e: IoChannel, message: string) => void}
 */
const assertIoMessage = (e, message) => {
    assert(e[0] === 'ioError', e)
    assertEq(e[1].message, message)
}

export const proof = {
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
    writeBytesNestedMissing: () => {
        // writeBytes('a/b', ...) where 'a' doesn't exist. Non-empty root, as above.
        /** @type {Dir} */
        const root = { keep: [vec8(0x1n)] }
        const [state, result] = virtual({ ...emptyState, root })(writeBytes('a/b', 0, vec8(0x1n)))
        assert(result[0] === 'error')
        assertEq(Object.keys(state.root).length, 1)
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
    writeBytesOnJsModule: () => {
        // writeBytes on a JsModule entry covers the `!Array.isArray(file)`
        // branch (unlike readFile/readBytes, writeBytes has no separate throw
        // for JsModule, so this is the reachable way to hit "not a file").
        /** @type {Dir} */
        const root = { 'a.f.ts': () => ({}) }
        const [, result] = virtual({ ...emptyState, root })(writeBytes('a.f.ts', 0, vec8(0x1n)))
        assert(result[0] === 'error')
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
    readFileTooLarge: () => {
        // a file stored as two max-size chunks exceeds the limit; readFile must return an error
        const chunk0 = vec(maxLengthBytes * 8n)(0n)
        const chunk1 = vec(1n)(1n)
        /** @type {Dir} */
        const root = { 'big': [chunk0, chunk1] }
        const [, result] = virtual({ ...emptyState, root })(readFile('big'))
        assert(result[0] === 'error')
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
        assertEq(result[1].size, 0)
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
    // A server without a socket: `createServer` stores the listener and
    // `listen` hands it the requests the fixture queued, which is what makes a
    // request-in / response-out proof possible here at all.
    http: {
        answersQueuedRequests: () => {
            /** @type {(url: string) => IncomingMessage} */
            const get = url => ({ method: 'GET', url, headers: {}, body: empty })
            /** @type {RequestListener<never>} */
            const listener = ({ url }) =>
                pureOk({ status: 200, headers: {}, body: utf8(`echo ${url}`) })
            const e = step(createServer(listener), server => listen(server, 8080, '127.0.0.1'))
            /** @type {State} */
            const state = { ...emptyState, requests: [get('/a'), get('/b')] }
            const [s, result] = virtual(state)(e)
            assert(result[0] === 'ok', result)
            assertEq(s.port, 8080)
            assertEq(s.host, '127.0.0.1')
            // The queue is emptied, so a second `listen` cannot answer the same
            // request twice.
            assertEq(s.requests.length, 0)
            assertEq(s.responses.map(r => utf8ToString(r.body)).join(', '), 'echo /a, echo /b')
        },
        // Two servers in one program are two servers here, as they are on a
        // host: `listen` answers with the listener its *handle* carries, not
        // with whichever was created last.
        dispatchesThroughTheHandle: () => {
            /** @type {(name: string) => RequestListener<never>} */
            const named = name => () => pureOk({ status: 200, headers: {}, body: utf8(name) })
            // Flat, because the third link needs the *first* one's value: a
            // history carries `a` forward instead of a nested continuation
            // closing over it.
            const created = history(createServer(named('a')))
            const both = historyStep(created, () => createServer(named('b')))
            const first = step(both, ([, a]) => listen(a, 8080, '127.0.0.1'))
            /** @type {State} */
            const state = {
                ...emptyState,
                requests: [{ method: 'GET', url: '/', headers: {}, body: empty }],
            }
            const [s, result] = virtual(state)(first)
            assert(result[0] === 'ok', result)
            assertEq(utf8ToString(s.responses[0].body), 'a')
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
