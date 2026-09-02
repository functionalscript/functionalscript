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
        writeBytesOnJsModule: () => {
            // writeBytes shares `resolveFile` with the two reads, so a fixture
            // that appends to a module is the same mistake and is told so the
            // same way. It used to answer `'a.f.ts' is not a file` instead —
            // the only entry that could reach that branch was a `JsModule`, so
            // the message named the one thing it was not.
            /** @type {Dir} */
            const root = { 'a.f.ts': () => ({}) }
            virtual({ ...emptyState, root })(writeBytes('a.f.ts', 0, vec8(0x1n)))
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
    // `../../../djs/parser/proof.f.mjs`); it was never a working fixture here
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
            assertEq(s.listening.map(b => b.address).join(), '127.0.0.1:8080')
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
        // A port a host would refuse is refused here, or a program that cannot
        // run anywhere could still be proven.
        badPort: () => {
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: empty })
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
            const listener = () => pureOk({ status: 200, headers: {}, body: empty })
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
            const listener = () => pureOk({ status: 200, headers: {}, body: empty })
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
            const listener = () => pureOk({ status: 200, headers: {}, body: empty })
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
            const listener = () => pureOk({ status: 200, headers: {}, body: empty })
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
            const listener = () => pureOk({ status: 200, headers: {}, body: empty })
            const created = history(createServer(listener))
            const bound = historyStep(created, server => listen(server, 8080, '127.0.0.1'))
            const e = step(bound, ([, server]) => listen(server, 9090, ''))
            const [, result] = virtual(emptyState)(e)
            assert(result[0] === 'error', result)
            assertIoCode(result[1], 'ERR_INVALID_ARG_VALUE')
        },
        alreadyListening: () => {
            /** @type {RequestListener<never>} */
            const listener = () => pureOk({ status: 200, headers: {}, body: empty })
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
    },
}
