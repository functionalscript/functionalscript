/**
 * @import { Vec } from "../../types/bit_vec/types.ts"
 * @import { IoChannel, IoError, IoResult, NodeOp, ReadBytes, ReadFile, Rm, Stat, WriteBytes, WriteFile, _ChunkSource, _Gate } from "./types.ts"
 * @import { Result } from "../../types/result/types.ts"
 * @import { List } from "../list/types.ts"
 * @import { List as List_ } from "../../types/list/types.ts"
 * @import { Effect, OperationMap } from "../types.ts"
 * @import { MemOperationMap } from "../mock/types.ts"
 */

import { byteLength, empty, isVec, maxLengthBytes, u8ListMsb, u8ListToVecMsb, uint, vec, vec8 } from "../../types/bit_vec/module.f.mjs"
import { utf8, utf8ToString } from "../../text/module.f.mjs"
import { match } from "../module.f.mjs"
import { mapStep, pureError, pureOk, step as ioStep } from "../module.f.mjs"
import { badPortCode, badPortMessage, both, carriesNoBody, declaredLength, doubledLengthMessage, errorMessage, errorSummary, exitStep, fetch, framingHeaderMessage, headerValue, inflate, inflateTrailingMessage, ioError, isNotFound, isPort, maxPort, mkdir, now, readdir, readFile, readUtf8File, refusalMessage, refusedStatus, responseGate, rm, runnerResponse, sandbox, unframedBodyMessage, writeFile, writeUtf8File, rename, readBytes, randomInt, writeFromStream, usesInlineTestContext, readWholeBytes, readChunks, windowRefusal, maxOffset } from "./module.f.mjs"
import { create as memCreate, read as memRead, write as memWrite } from "../memory/module.f.mjs"
import { empty as listEmpty, nonEmpty as listNonEmpty } from "../list/module.f.mjs"
import { emptyState, virtual } from "./virtual/module.f.mjs"
import { assert, assertEq, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

// Answers the one command the `map` proof below drives. Routing the loop
// through `match` keeps the `Pure`/`Do` layout out of this module: the map key
// is the command assertion, and `MatchResult` types the continuation.
/** @type {OperationMap<ReadFile, IoResult<Vec>>} */
const readHelloMap = {
    readFile: path => {
        assertEq(path, 'hello')
        return ok(vec8(0x15n))
    },
}

const readHello = match(readHelloMap)

/**
 * Asserts that a channel error is a host failure carrying `message`. Every
 * runner reports through the same normalized {@link IoError}, so a proof
 * against the virtual filesystem names the message rather than the shape.
 * @type {(e: IoChannel, message: string) => void}
 */
const assertIoMessage = (e, message) => {
    assert(e[0] === 'ioError', e)
    assertEq(e[1].message, message)
}

/** `n` zero bytes as a `Vec`.
 * @type {(n: number) => Vec} */
const bytes = n => u8ListToVecMsb(Array.from({ length: n }, () => 0))

/** Runs an effect against the empty virtual file system.
 * @type {<T>(e: Effect<NodeOp, T, IoChannel>) => readonly [unknown, Result<T, IoChannel>]} */
const run = e => virtual(emptyState)(e)

/**
 * Pulls a whole stream, answering the byte length of every cell in order — or
 * the channel error that ended it.
 *
 * **Pulling is the point.** A `List` cell is an effect, so a stream that fails
 * on its SECOND cell answers `ok` when only the first is taken: the failure
 * lives in a tail nobody pulled. A leaf that stopped at the first cell would
 * pass whether or not the loop refused, which is how the short-read leaf below
 * first passed against an implementation that was in fact correct.
 *
 * @type {(source: _ChunkSource<NodeOp>, bound: number | null) => Result<readonly number[], IoChannel>}
 */
const drain = (source, bound) => {
    /** @type {(l: any, acc: readonly number[]) => any} */
    const loop = (l, acc) => ioStep(l, cell => cell === undefined
        ? pureOk(acc)
        : loop(cell.tail, [...acc, Number(byteLength(cell.first))]))
    return run(loop(readChunks(source, bound), []))[1]
}

/** The cell lengths of a stream that must not fail.
 * @type {(source: _ChunkSource<NodeOp>, bound: number | null) => readonly number[]} */
const lengths = (source, bound) => {
    const r = drain(source, bound)
    assert(r[0] === 'ok', r)
    return r[1]
}


export const proof = {
    isPort: {
        // Both ends are ports: `0` asks for an ephemeral one.
        inRange: () => {
            assert(isPort(0))
            assert(isPort(8080))
            assert(isPort(maxPort))
        },
        outOfRange: () => {
            assert(!isPort(-1))
            assert(!isPort(maxPort + 1))
        },
        notInteger: () => {
            assert(!isPort(1.5))
            assert(!isPort(NaN))
            assert(!isPort(Infinity))
        },
    },
    // Node's own words, byte-for-byte, as the virtual runner reports them.
    badPort: () => {
        assertEq(badPortCode, 'ERR_SOCKET_BAD_PORT')
        assertEq(badPortMessage(-1), 'options.port should be >= 0 and < 65536. Received type number (-1).')
        assertEq(badPortMessage(NaN), 'options.port should be >= 0 and < 65536. Received type number (NaN).')
    },
    isNotFound: {
        enoent: () => {
            assert(isNotFound(ioError({ code: 'ENOENT', message: 'no such file or directory' })))
        },
        otherCode: () => {
            assert(!isNotFound(ioError({ code: 'EACCES', message: 'permission denied' })))
        },
        // A runner that cannot perform the operation has not looked for the
        // path at all, so a missing handler is never "not found".
        notImplemented: () => {
            assert(!isNotFound(['notImplemented', 'readFile']))
        },
    },
    errorMessage: {
        io: () => {
            assertEq(errorMessage(ioError({ message: 'disk full' })), 'disk full')
        },
        notImplemented: () => {
            assertEq(errorMessage(['notImplemented', 'readFile']), 'operation not implemented: readFile')
        },
    },
    errorSummary: {
        // The distinction that matters: `errorMessage` hands back the host's
        // words, which is where the path lives; `errorSummary` never does.
        io: () => {
            assertEq(errorSummary(ioError({ code: 'ENOENT', message: "no such file or directory, scandir '/home/u/.cas'" })), 'io error: ENOENT')
        },
        ioWithoutCode: () => {
            assertEq(errorSummary(ioError({ message: "cannot read '/home/u/.cas'" })), 'io error')
        },
        notImplemented: () => {
            assertEq(errorSummary(['notImplemented', 'readdir']), 'operation not implemented: readdir')
        },
    },
    exitStep: {
        // The exit-code policy a `NodeProgram` ends with: success is `0`...
        ok: () => {
            const [state, code] = virtual(emptyState)(exitStep(writeFile('hello', vec8(0x2An))))
            assertEq(code[0], 'ok')
            assertEq(code[1], 0)
            assertEq(state.stderr, '')
        },
        // ...and a failure is reported on `stderr` and exits `1`.
        // ...and the code is `[1]` either way, which is what lets a runner
        // read it without asking which branch it came from.
        error: () => {
            const [state, code] = virtual(emptyState)(exitStep(readFile('missing')))
            assertEq(code[0], 'error')
            assertEq(code[1], 1)
            assertEq(state.stderr, 'no such file or directory\n')
        },
    },
    externalTestContext: () => {
        assert(usesInlineTestContext('node', 'v22.20.0'))
        assert(usesInlineTestContext('node', '25.99.99'))
        assert(!usesInlineTestContext('node', '26.0.0'))
        assert(!usesInlineTestContext('node', '26.1.0'))
        // Nightly and release-candidate builds suffix `process.version`.
        assert(usesInlineTestContext('node', 'v25.0.0-nightly20260930abc'))
        assert(usesInlineTestContext('node', 'v26.0.0-rc.1'))
        assert(usesInlineTestContext('node', 'v26.0.0-rc.1+build-1'))
        assert(!usesInlineTestContext('node', 'v26.0.0+build-1'))
        assert(!usesInlineTestContext('node', 'v26.1.0-nightly20260930abc'))
        assert(!usesInlineTestContext('node'))
        assert(usesInlineTestContext('bun'))
        assert(!usesInlineTestContext('deno', '22.0.0'))
    },
    map: () => {
        const e = mapStep(readFile('hello'), v => uint(v) * 2n)
        //
        let r = readHello(e)
        while (r[0] === 'cont') {
            r = readHello(r[2](r[1]))
        }
        // `done` carries the whole `Result`: an interpreter never separates the
        // channels, so the projection's value is inside the `ok`.
        assertEq(r[1][1], 0x2An)
    },
    fetch: () => {
        const [_, [t, result]] = virtual({
            ...emptyState,
            internet: {
                'https://example.com/data': vec8(0x2An),
            },
        })(fetch('https://example.com/data'))
        assert(t !== 'error', result)
        assert(isVec(result), result)
        assertEq(uint(result), 0x2An, result)
    },
    // The virtual runner has no inflater, and says so through the channel
    // rather than by guessing: a program that needs one gets its control back.
    inflate: () => {
        const [_, [t, result]] = virtual(emptyState)(inflate(vec8(0x78n)))
        assertEq(t, 'error')
        assertStructurallySame(result, ['notImplemented', 'inflate'])
        assertEq(inflateTrailingMessage(3), '3 bytes after the end of the zlib stream')
        // A `Vec` that is not whole bytes is refused before any runner is
        // asked: the virtual one, which would have said `notImplemented`,
        // never sees it.
        const [__, [tu, unaligned]] = virtual(emptyState)(inflate(vec(4n)(0b1010n)))
        assert(tu === 'error', unaligned)
        assertIoMessage(unaligned, 'invalid buffer size')
    },
    mkdir: {
        one: () => {
            const [state, [t, result]] = virtual(emptyState)(mkdir('a'))
            assert(t !== 'error', result)
            const a = state.root.a
            assert(!(a === undefined || Array.isArray(a)), a)
        },
        rec: () => {
            const [state, [t, result]] = virtual(emptyState)(
                mkdir('tmp/cache', { recursive: true })
            )
            assert(t === 'ok', result)
            const tmp = state.root.tmp
            // `instanceof Array`, not `Array.isArray`: only the former's negative
            // branch removes a `readonly` array from a union, so only it narrows
            // `_Entity` to `Dir`.
            assert(!(typeof tmp !== 'object' || tmp instanceof Array), state.root)
            const cache = tmp.cache
            assert(!(typeof cache !== 'object' || Array.isArray(cache)), tmp)
        },
        nonRec: () => {
            const [state, [t, result]] = virtual(emptyState)(
                mkdir('tmp/cache')
            )
            assert(t === 'error', result)
            assertEq(state.root.tmp, undefined)
        }
    },
    readFile: {
        one: () => {
            const initial = {
                ...emptyState,
                root: {
                    hello: [vec8(0x2An)],
                },
            }
            const [state, [t, result]] = virtual(initial)(readFile('hello'))
            assert(t !== 'error', result)
            assert(isVec(result), result)
            assertEq(uint(result), 0x2An, result)
            assert(state.root.hello !== undefined, state.root)
        },
        nested: () => {
            const [_, [tag, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: [vec8(0x15n)] } }
            })(readFile('tmp/cache'))
            assert(tag !== 'error', result)
            assertEq(uint(result), 0x15n, result)
        },
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(readFile('hello'))
            assert(t === 'error', result)
        },
        nestedPath: () => {
            const [_, [t, result]] = virtual(emptyState)(readFile('tmp/cache'))
            assert(t === 'error', result)
            assert(result[0] === 'ioError', result)
            assertEq(result[1].code, 'ENOENT', result)
        },
        withinLimit: () => {
            // Test with a small file well within the 131,072 byte limit
            const initial = {
                ...emptyState,
                root: {
                    smallFile: [vec8(0x2An)],
                },
            }
            const [_, [t, result]] = virtual(initial)(readFile('smallFile'))
            assert(t !== 'error', result)
            assert(isVec(result), result)
        }
    },
    readUtf8File: {
        ok: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { hello: [utf8('Hello, world!')] },
            })(readUtf8File('hello'))
            assert(t === 'ok', result)
            assertEq(result, 'Hello, world!')
        },
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(readUtf8File('hello'))
            assert(t === 'error', result)
        },
    },
    readdir: {
        one: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: {
                    file: [vec8(0x2An)],
                    dir: {
                        a: [empty]
                    },
                },
            })(readdir('', { recursive: true }))
            assert(t === 'ok', result)
            const file = result.find(x => x.name === 'file')
            if (file === undefined || file.parentPath !== '' || !file.isFile) { throw `file: ${file}` }
            const dirA = result.find(x => x.name === 'a')
            if (dirA === undefined || dirA.parentPath !== '/dir') { throw `dirA: ${dirA?.parentPath}` }
        },
        nonRecursive: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: {
                    file: [vec8(0x2An)],
                    dir: {
                        a: [empty]
                    },
                },
            })(readdir('', { }))
            assert(t === 'ok', result)
            assertEq(result.length, 2, result)
            assertNotNullish(result.find(x => x.name === 'file'))
            assertNotNullish(result.find(x => x.name === 'dir'))
        },
        nested: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: [vec8(0x15n)] } }
            })(readdir('tmp', { recursive: true }))
            assert(t === 'ok', result)
            assertEq(result.length, 1, result)
            const [r0] = result
            assertEq(r0.name, 'cache', r0)
            assertEq(r0.parentPath, 'tmp', r0)
        },
        noSuchDir: () => {
            const [_, [t, result]] = virtual(emptyState)(readdir('tmp', { recursive: true }))
            assert(t === 'error', result)
            assertIoMessage(result, 'invalid path')
        },
    },
    writeFile: {
        one: () => {
            const [state, [t, result]] = virtual(emptyState)(
                writeFile('hello', vec8(0x2An))
            )
            assert(t === 'ok', result)
            const file = state.root.hello
            assert(Array.isArray(file), file)
            assertEq(uint(file[0]), 0x2An, file)
        },
        overwrite: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: {
                    hello: [vec8(0x15n)],
                },
            })(
                writeFile('hello', vec8(0x2An))
            )
            assert(t === 'ok', result)
            const file = state.root.hello
            assert(Array.isArray(file), file)
            assertEq(uint(file[0]), 0x2An, file)
        },
        nestedPath: () => {
            const [state, [t, result]] = virtual(emptyState)(
                writeFile('tmp/cache', vec8(0x2An))
            )
            assert(t === 'error', result)
            assertIoMessage(result, 'invalid file')
            assertEq(state.root.tmp, undefined, state.root)
        },
        directory: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: {
                    tmp: {},
                },
            })(
                writeFile('tmp', vec8(0x2An))
            )
            assert(t === 'error', result)
            assertIoMessage(result, 'invalid file')
            const tmp = state.root.tmp
            assert(!(tmp === undefined || Array.isArray(tmp)), tmp)
        },
        // A `Vec` that is not whole bytes is refused before any runner is
        // asked: the node one would pad the last byte and write a byte the
        // caller never gave, and this one would store what no file can hold.
        // The file it would have replaced is left as it was.
        notWholeBytes: () => {
            const root = { hello: [vec8(0x15n)] }
            const [state, [t, result]] = virtual({ ...emptyState, root })(
                writeFile('hello', vec(4n)(0b1010n))
            )
            assert(t === 'error', result)
            assertIoMessage(result, 'invalid buffer size')
            assertStructurallySame(state.root, root)
        },
    },
    writeUtf8File: {
        small: () => {
            const [state, [t, result]] = virtual(emptyState)(
                writeUtf8File('hello', 'Hello, world!')
            )
            assert(t === 'ok', result)
            const file = state.root.hello
            assert(Array.isArray(file), file)
            assertEq(utf8ToString(file[0]), 'Hello, world!', file)
        },
        // A text of a `Vec`'s size or less is one chunk, a text past it several,
        // each a `Vec`, and the file reads back as the whole text.
        large: () => {
            const text = 'a'.repeat(Number(maxLengthBytes) + 7)
            const [state, [t, result]] = virtual(emptyState)(writeUtf8File('big', text))
            assert(t === 'ok', result)
            const file = state.root.big
            assert(Array.isArray(file), file)
            assert(file.length > 1, file.length)
            assert(file.every(v => byteLength(v) <= maxLengthBytes))
            assertEq(file.map(utf8ToString).join(''), text)
        },
        // Three bytes to a code unit is the widest a piece can be.
        wide: () => {
            const text = '\u20ac'.repeat(Number(maxLengthBytes))
            const [state, [t, result]] = virtual(emptyState)(writeUtf8File('wide', text))
            assert(t === 'ok', result)
            const file = state.root.wide
            assert(Array.isArray(file), file)
            assert(file.every(v => byteLength(v) <= maxLengthBytes))
            assertEq(file.map(utf8ToString).join(''), text)
        },
        // A surrogate pair across where a piece would end stays whole: each chunk
        // decodes alone, and none holds half a pair.
        pair: () => {
            const unit = Math.floor(Number(maxLengthBytes) / 3)
            const text = `${'a'.repeat(unit - 1)}\u{1F600}${'b'.repeat(unit)}`
            const [state, [t, result]] = virtual(emptyState)(writeUtf8File('pair', text))
            assert(t === 'ok', result)
            const file = state.root.pair
            assert(Array.isArray(file), file)
            assertEq(file.map(utf8ToString).join(''), text)
            assertEq(utf8ToString(file[0]).length, unit - 1)
        },
        // A text of exactly one piece's width is one chunk.
        exact: () => {
            const text = 'a'.repeat(Math.floor(Number(maxLengthBytes) / 3))
            const [state, [t, result]] = virtual(emptyState)(writeUtf8File('exact', text))
            assert(t === 'ok', result)
            const file = state.root.exact
            assert(Array.isArray(file), file)
            assertEq(file.length, 1)
        },
        // The first piece goes in through `writeFile`; if a later one fails the
        // error is the write's and the file is removed.
        failsClosed: () => {
            /** @type {readonly string[]} */
            let removed = []
            /** @type {OperationMap<WriteFile | WriteBytes | Rm, IoResult<void>>} */
            const map = {
                writeFile: () => ok(undefined),
                writeBytes: () => error(ioError({ message: 'disk full' })),
                rm: path => {
                    removed = [...removed, path]
                    return ok(undefined)
                },
            }
            const host = match(map)
            let r = host(writeUtf8File('big', 'a'.repeat(Number(maxLengthBytes) + 7)))
            while (r[0] === 'cont') {
                r = host(r[2](r[1]))
            }
            const [tag, failure] = r[1]
            assert(tag === 'error', r)
            assertIoMessage(failure, 'disk full')
            assertStructurallySame(removed, ['big'])
        },
    },
    rm: {
        one: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { hello: [vec8(0x2An)] },
            })(rm('hello'))
            assert(t === 'ok', result)
            assertEq(state.root.hello, undefined, state.root)
        },
        nested: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: [vec8(0x15n)] } },
            })(rm('tmp/cache'))
            assert(t === 'ok', result)
            const tmp = state.root.tmp
            assert(!(typeof tmp !== 'object' || tmp instanceof Array), state.root)
            assertEq(tmp.cache, undefined, tmp)
        },
        // `ENOENT`, as node answers and as `stat`, `readFile` and `access` here
        // already did — it used to be a message of its own with no code, so
        // `isNotFound` could not recognise it.
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(rm('hello'))
            assert(t === 'error', result)
            assert(isNotFound(result), result)
        },
        isDirectory: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: {} },
            })(rm('tmp'))
            assert(t === 'error', result)
            assertIoMessage(result, 'invalid path')
            assert(state.root.tmp !== undefined, state.root)
        },
    },
    both: () => {
        const [_, both2] = virtual({
            ...emptyState,
            root: {
                a: [vec8(0x2An)],
                b: [vec8(0x15n)],
            },
        })(both(readFile('a'))(readFile('b')))
        assert(both2[0] === 'ok', both2)
        const results = both2[1]
        assert(results[0][0] === 'ok', results[0])
        assert(results[1][0] === 'ok', results[1])
        assertEq(uint(results[0][1]), 0x2An, results[0][1])
        assertEq(uint(results[1][1]), 0x15n, results[1][1])
    },
    now: () => {
        const [_, result] = virtual({ ...emptyState, epochNs: 1_000_000 })(now())
        assertEq(assertOk(result), 1_000_000)
    },
    sandbox: {
        // Virtual `sandbox` is now a pass-through: the function is expected
        // to return a `SandboxResult` directly. Fixtures dictate the result
        // (and `duration`) instead of the runner measuring.
        ok: () => {
            const [_, sandboxed] = virtual(emptyState)(
                sandbox(() => ({ result: ['ok', 42], duration: 0 })))
            // Two `Result`s, one inside the other on purpose: the outer one is
            // the operation's own status, the inner one is the sandboxed
            // function's outcome — returned data, not effect status.
            assert(sandboxed[0] === 'ok', sandboxed)
            const { result, duration } = sandboxed[1]
            assert(result[0] === 'ok', result)
            assertEq(result[1], 42)
            assertEq(duration, 0)
        },
        error: () => {
            const err = new Error('fail')
            const [_, sandboxed] = virtual(emptyState)(
                sandbox(() => ({ result: ['error', err], duration: 0 })))
            assert(sandboxed[0] === 'ok', sandboxed)
            const { result } = sandboxed[1]
            assert(result[0] === 'error', result)
            assertEq(result[1], err)
        },
    },
    memory: {
        createAndRead: () => {
            const effect = ioStep(memCreate(42), key => memRead(key))
            const [_, value] = virtual(emptyState)(effect)
            assertEq(assertOk(value), 42)
        },
        createAndWrite: () => {
            const effect = ioStep(
                    memCreate(1),
                    key => ioStep(
                        memWrite(key, 99),
                        () => memRead(key)))
            const [_, value] = virtual(emptyState)(effect)
            assertEq(assertOk(value), 99)
        },
    },
    rename: {
        fileOverFile: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { src: [vec8(0x2An)], dst: [vec8(0x15n)] },
            })(rename('src', 'dst'))
            assert(t === 'ok', result)
            assertEq(state.root.src, undefined, state.root)
            assert(Array.isArray(state.root.dst), state.root)
            assertEq(uint(state.root.dst[0]), 0x2An, state.root)
        },
        nestedRename: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { src: [vec8(0x2An)] } },
            })(rename('tmp/src', 'tmp/dst'))
            assert(t === 'ok', result)
            const tmp = state.root.tmp
            assert(!(typeof tmp !== 'object' || tmp instanceof Array), state.root)
            assertEq(tmp.src, undefined, tmp)
        },
        dirOverFile: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { src: {}, dst: [vec8(0x15n)] },
            })(rename('src', 'dst'))
            assert(t === 'error', result)
            assert(Array.isArray(state.root.dst), state.root)
        },
        missingSource: () => {
            const [_, [t, result]] = virtual(emptyState)(rename('missing', 'dst'))
            assert(t === 'error', result)
        },
    },
    readBytes: {
        simple: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { file: [vec8(0xABn)] },
            })(readBytes('file', 0, 1))
            assert(t === 'ok', result)
            assert(isVec(result), result)
        },
        withOffset: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { file: [vec8(0xABn), vec8(0xCDn)] },
            })(readBytes('file', 1, 1))
            assert(t === 'ok', result)
            assert(isVec(result), result)
        },
        oversizeChunk: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { file: [vec8(0x2An)] },
            })(readBytes('file', 0, Number(2n ** 32n)))
            assert(t === 'error', result)
        },
        missingFile: () => {
            const [_, [t, result]] = virtual(emptyState)(readBytes('missing', 0, 4))
            assert(t === 'error', result)
        },
    },
    // **Which pair of numbers is a window at all**, asked here because both
    // runners ask it: the node one before it allocates a buffer, the virtual one
    // before it walks the chunks. Four bounds and two runners is eight places a
    // bound could have been spelled differently, so the words are asserted and not
    // only the refusal.
    windowRefusal: {
        // A window a host will read.
        accepted: () => {
            assertEq(windowRefusal(0, 0), null)
            assertEq(windowRefusal(0, 1), null)
            assertEq(windowRefusal(7, Number(maxLengthBytes)), null)
            // The largest offset Node takes, inclusive: measured on Darwin with
            // Node 23.11.0, a `read` at this position answers nought bytes for a
            // short file and one byte further fails `ERR_OUT_OF_RANGE`.
            assertEq(windowRefusal(maxOffset, 1), null)
        },
        // **The two Node answers silently.** `Buffer.alloc` truncates a fractional
        // size rather than refusing it — measured on Node 23.11.0,
        // `Buffer.alloc(1.5)` is one byte long and `Buffer.alloc(0.5)` is none — so
        // a runner that allocated first would read one byte for a size of `1.5`
        // and say nothing about the half it dropped, while the other refused.
        fractional: () => {
            assertEq(windowRefusal(1.5, 1), 'Offset 1.5 is not an integer')
            assertEq(windowRefusal(0, 1.5), 'Chunk size 1.5 is not an integer')
            assertEq(windowRefusal(0, 0.5), 'Chunk size 0.5 is not an integer')
            // Neither is a number at all, and `Number.isInteger` is what says so.
            assertEq(windowRefusal(NaN, 1), 'Offset NaN is not an integer')
            assertEq(windowRefusal(Infinity, 1), 'Offset Infinity is not an integer')
            assertEq(windowRefusal(0, NaN), 'Chunk size NaN is not an integer')
        },
        negative: () => {
            assertEq(windowRefusal(-1, 1), 'Offset -1 is negative')
            assertEq(windowRefusal(0, -1), 'Chunk size -1 is negative')
        },
        // **Past the largest byte a position may name**, which is Node's limit and
        // not a choice: `read` at `maxOffset + 1` fails `ERR_OUT_OF_RANGE` —
        // `must be >= -1 && <= 9007199254740991` — where an integer that large is
        // otherwise an ordinary end-of-file read. A runner answering the plausible
        // empty read for it hands a caller a branch the host never takes.
        unsafeOffset: () => {
            assertEq(
                windowRefusal(maxOffset + 1, 1),
                `Offset ${maxOffset + 1} exceeds maximum allowed offset of ${maxOffset}`)
            assertEq(
                windowRefusal(2 ** 60, 1),
                `Offset ${2 ** 60} exceeds maximum allowed offset of ${maxOffset}`)
        },
        oversizeChunk: () => {
            const over = Number(maxLengthBytes) + 1
            assertEq(
                windowRefusal(0, over),
                `Chunk size ${over} exceeds maximum allowed size of ${maxLengthBytes} bytes`)
        },
        // The order the bounds are asked in, because a value breaks two of them at
        // once and the answer says which was asked first.
        order: () => {
            // Not an integer before negative: `-1.5` is both.
            assertEq(windowRefusal(-1.5, 1), 'Offset -1.5 is not an integer')
            assertEq(windowRefusal(0, -1.5), 'Chunk size -1.5 is not an integer')
            // The offset before the size, so one call reports one thing.
            assertEq(windowRefusal(-1, -1), 'Offset -1 is negative')
            assertEq(windowRefusal(1.5, 1.5), 'Offset 1.5 is not an integer')
            // Negative before too-large, and the offset's bound before the size's.
            assertEq(
                windowRefusal(maxOffset + 1, Number(maxLengthBytes) + 1),
                `Offset ${maxOffset + 1} exceeds maximum allowed offset of ${maxOffset}`)
        },
    },
    readWholeBytes: {
        // A file of one chunk and a file of more read the same, and the chunks
        // come back joined into one byte list. The virtual filesystem holds a
        // file as its chunks already, so this is the shape a real open answers.
        whole: () => {
            for (const chunks of [
                /** @type {readonly Vec[]} */ ([]),
                [vec8(0x2An)],
                [vec8(0x01n), vec8(0x02n)],
                [u8ListToVecMsb([1, 2, 3]), u8ListToVecMsb([4, 5])],
            ]) {
                const [, [t, result]] = virtual({ ...emptyState, root: { file: chunks } })(
                    readWholeBytes('file'))
                assert(t === 'ok', result)
                assertStructurallySame(
                    toArray(/** @type {List_<number>} */ (result)),
                    chunks.flatMap(v => toArray(u8ListMsb(v))))
            }
        },
        // A whole file is not bounded by a `Vec`, which is the reason the
        // operation answers chunks: `readFile` refuses the same fixture.
        pastTheVecCap: () => {
            const big = Array.from({ length: 3 }, () => u8ListToVecMsb(Array.from(
                { length: Number(maxLengthBytes) },
                (_, i) => i % 251)))
            const root = { file: big }
            const [, [t, result]] = virtual({ ...emptyState, root })(readWholeBytes('file'))
            assert(t === 'ok', result)
            assertEq(toArray(/** @type {List_<number>} */ (result)).length, Number(maxLengthBytes) * 3)
            // and the bounded read of the same file refuses
            const [, [rt]] = virtual({ ...emptyState, root })(readFile('file'))
            assertEq(rt, 'error')
        },
        // A path that is not there is the channel's, as every other read is.
        missingFile: () => {
            const [, [t]] = virtual(emptyState)(readWholeBytes('missing'))
            assertEq(t, 'error')
        },
    },
    randomInt: {
        increments: () => {
            const [state1, r1] = virtual(emptyState)(randomInt())
            assertEq(assertOk(r1), 0)
            const [state2, r2] = virtual(state1)(randomInt())
            assertEq(assertOk(r2), 1)
            const [_, r3] = virtual(state2)(randomInt())
            assertEq(assertOk(r3), 2)
        },
    },
    readChunks: {
        // Drains a stream into the byte counts of its cells. Every leaf below
        // asks the same question of a different source, so it is asked once.
        //
        // A `List` is an effect answering `{first, tail}` or `undefined`, so
        // draining it is an ordinary `ioStep` recursion — the same shape a
        // consumer writes.
        //
        // The counts are what these leaves assert, not merely the cell count:
        // the defect this loop exists to prevent is a chunk of the wrong SIZE,
        // and a leaf that counted cells would pass through it.
        unboundedEndsAtTheFirstEmptyRead: () => {
            const whole = Number(maxLengthBytes)
            /** @type {_ChunkSource<never>} */
            const source = offset => pureOk(offset >= 3 * whole ? empty : bytes(whole))
            assertStructurallySame(lengths(source, null), [whole, whole, whole])
        },
        boundedStopsAtTheBoundWithoutAnEmptyRead: () => {
            // A source that would answer forever still ends, because the bound
            // ends it. The unbounded loop had no way to express this: it ended
            // only on an empty read.
            const whole = Number(maxLengthBytes)
            /** @type {_ChunkSource<never>} */
            const source = (_, size) => pureOk(bytes(size))
            assertStructurallySame(lengths(source, whole + 7), [whole, 7])
        },
        boundedAdvancesByWhatItGotNotByChunkBytes: () => {
            // THE LEAF NEITHER OLD LOOP COULD HAVE HAD. Both stepped
            // `offset + chunkBytes` whatever the read returned. This source
            // answers SHORT of what was asked, so a fixed step would skip the
            // bytes it did not return — a hole in a body whose length the
            // client has already been told.
            /** @type {_ChunkSource<never>} */
            const source = (_, size) => pureOk(bytes(Math.min(size, 100)))
            assertStructurallySame(lengths(source, 250), [100, 100, 50])
        },
        aBoundedStreamThatEndsShortFailsTheCell: () => {
            // A file that shrank mid-read is a truncated body under a declared
            // length — the plausible wrong value DESIGN §10 refuses. It fails
            // rather than ending, which is the whole difference from the
            // unbounded case above.
            const whole = Number(maxLengthBytes)
            /** @type {_ChunkSource<never>} */
            const source = offset => pureOk(offset === 0 ? bytes(whole) : empty)
            // Drained, not taken: the refusal is in the SECOND cell, so a leaf
            // that read only the first would answer `ok` and pass against an
            // implementation that refuses correctly. This one did, until it was
            // watched.
            const result = drain(source, whole * 2)
            assert(result[0] === 'error', result)
            assertIoMessage(result[1], `read ended at ${whole} of ${whole * 2} bytes`)
        },
        aFailedReadFailsTheStream: () => {
            // A cell's own failure is never mistaken for the `undefined` that
            // ends one.
            /** @type {_ChunkSource<ReadBytes>} */
            const source = () => readBytes('nope', 0, 8)
            const result = drain(source, null)
            assertEq(result[0], 'error')
        },
        aChunkThatIsNotWholeBytesIsRefused: () => {
            // The return type permits one, and `bytesIn` would report a 1-bit
            // chunk as nought — an end-of-stream the source never signalled,
            // with the bits discarded.
            /** @type {_ChunkSource<never>} */
            const source = () => pureOk(vec(1n)(1n))
            const result = drain(source, null)
            assert(result[0] === 'error', result)
            assertIoMessage(result[1], 'chunk at 0 is 1 bits, not whole bytes')
        },
        aZeroBoundAsksForNothing: () => {
            /** @type {_ChunkSource<never>} */
            const source = () => { throw new Error('must not be asked') }
            assertStructurallySame(lengths(source, 0), [])
        },
    },
    writeFromStream: {
        createExclusiveFails: () => {
            // The destination already exists, so `createExclusive` fails (EEXIST) and
            // the error propagates without ever touching `writeBytes`.
            /** @type {List<never, Vec, IoChannel>} */
            const chunks = listEmpty()
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { hello: [vec8(0x2An)] },
            })(writeFromStream('hello', chunks))
            assert(t === 'error', result)
            const file = state.root.hello
            assert(!(!Array.isArray(file) || uint(file[0]) !== 0x2An), file)
        },
        writesEveryChunk: () => {
            /** @type {List<never, Vec, IoChannel>} */
            const chunks = listNonEmpty(vec8(0x01n), listNonEmpty(vec8(0x02n), listEmpty()))
            const [state, [t, result]] = virtual(emptyState)(writeFromStream('hello', chunks))
            assert(t === 'ok', result)
            const file = state.root.hello
            assert(Array.isArray(file), file)
            assertStructurallySame(file.map(uint), [0x01n, 0x02n])
        },
        invalidBufferSize: () => {
            // A chunk whose bit length isn't a multiple of 8 is refused by
            // `writeBytes` before any runner is asked, and the file the good
            // chunk before it went into is removed.
            /** @type {List<never, Vec, IoChannel>} */
            const chunks = listNonEmpty(vec8(0x01n), listNonEmpty(vec(4n)(0b1010n), listEmpty()))
            const [state, [t, result]] = virtual(emptyState)(
                writeFromStream('hello', chunks)
            )
            assert(t === 'error', result)
            assertIoMessage(result, 'invalid buffer size')
            assert(state.root.hello === undefined, state.root)
        },
        streamFails: () => {
            // The stream itself fails after one chunk is written: the error is
            // the stream's, and the partial file is gone.
            /** @type {List<never, Vec, IoChannel>} */
            const chunks = listNonEmpty(vec8(0x01n), pureError(ioError({ message: 'stream failed' })))
            const [state, [t, result]] = virtual(emptyState)(writeFromStream('hello', chunks))
            assert(t === 'error', result)
            assertIoMessage(result, 'stream failed')
            assert(state.root.hello === undefined, state.root)
        },
    },
    // What both runners read a response's framing from. The predicates live here
    // rather than in each runner because a gate the two answer differently is a
    // request a program cannot be proven against.
    framing: {
        // A header name is matched the way Node matches one. `Headers` is a
        // `StringMap`, so a listener may spell `Content-Length` a dozen ways and
        // Node reads all of them; a runner comparing the key exactly would find no
        // length on a response that declares one.
        headerValue: () => {
            assertEq(headerValue({ 'content-length': '7' }, 'content-length'), '7')
            assertEq(headerValue({ 'Content-Length': '7' }, 'content-length'), '7')
            assertEq(headerValue({ 'CONTENT-LENGTH': '7' }, 'content-length'), '7')
            assertEq(headerValue({}, 'content-length'), null)
            assertEq(headerValue({ 'content-type': 'text/plain' }, 'content-length'), null)
            // A name that is **there with no value** is a name that names nothing.
            // `StringMap` admits it — every value can be missing — and Node's own
            // `req.headers` produces such entries, so the branch is a fixture
            // rather than a hypothetical.
            assertEq(headerValue({ 'content-length': undefined }, 'content-length'), null)
            // **And the scan does not stop there.** The entries a runner forwards
            // are the defined ones, so a name present with no value is not the
            // answer to a name present with one further along. Reading the first
            // *spelling* rather than the first defined entry made this response
            // declare no length at all, and on Node 23.11.0 it went out under
            // `content-length: 2` with the pump counting against nothing.
            assertEq(headerValue({ 'Content-Length': undefined, 'content-length': '2' }, 'content-length'), '2')
            assertEq(headerValue({ 'content-length': undefined, 'Content-Length': '2' }, 'content-length'), '2')
        },
        // The declared length, which is what the runner counts against. A header
        // it cannot read is **no declaration** for either the gate or the count:
        // treating it as a number would put the count against a value the runner
        // invented.
        declaredLength: () => {
            assertEq(declaredLength({ 'content-length': '0' }), 0)
            assertEq(declaredLength({ 'Content-Length': '131072' }), 131072)
            // A parser reads `00007` as seven, and so does this.
            assertEq(declaredLength({ 'content-length': '00007' }), 7)
            assertEq(declaredLength({}), null)
            assertEq(declaredLength({ 'content-length': '' }), null)
            assertEq(declaredLength({ 'content-length': 'seven' }), null)
            assertEq(declaredLength({ 'content-length': '-1' }), null)
            assertEq(declaredLength({ 'content-length': '1.5' }), null)
            assertEq(declaredLength({ 'content-length': ' 7' }), null)
            assertEq(declaredLength({ 'content-length': '1e3' }), null)
            // Digits a `number` cannot hold exactly. `Number` answers a value for
            // them, and counting bytes against that value would be counting
            // against a rounding — so it is no declaration either.
            assertEq(declaredLength({ 'content-length': '99999999999999999999' }), null)
        },
        // The set is the host's, not the RFC's: `205` forbids a body too and Node
        // sends one anyway, so a guard written from the specification would
        // suppress a body the host was about to send.
        carriesNoBody: () => {
            assert(carriesNoBody('HEAD', 200))
            assert(carriesNoBody('GET', 204))
            assert(carriesNoBody('GET', 304))
            assert(carriesNoBody('GET', 100))
            assert(carriesNoBody('GET', 199))
            assert(!carriesNoBody('GET', 200))
            assert(!carriesNoBody('GET', 205))
            assert(!carriesNoBody('GET', 206))
            assert(!carriesNoBody('POST', 200))
        },
        // The four gates, and the order they are asked in — the same function
        // both runners call, so the order is the design's rather than each
        // runner's.
        responseGate: () => {
            /** @type {(gate: _Gate) => string} */
            const named = gate => gate[0] === 'pump' ? `pump ${gate[1]}` : gate[0]
            // Nothing fires, and the pump runs with the declared length.
            assertEq(named(responseGate('GET', true, 200, { 'content-length': '7' })), 'pump 7')
            // A request the host will frame chunked needs no length.
            assertEq(named(responseGate('GET', true, 200, {})), 'pump null')
            // Gate 1, and before gate 2: the response is malformed whatever body
            // this particular request would have carried.
            assertEq(named(responseGate('GET', true, 200, { 'transfer-encoding': 'chunked' })), 'framingHeader')
            assertEq(named(responseGate('HEAD', true, 200, { 'transfer-encoding': 'chunked' })), 'framingHeader')
            // Gate 2, and before gate 3: a `HEAD` is a complete answer whatever
            // framing the body it does not carry would have had, so the other
            // order refuses a request this server can satisfy exactly.
            assertEq(named(responseGate('HEAD', true, 200, { 'content-length': '7' })), 'noBody')
            assertEq(named(responseGate('HEAD', false, 200, {})), 'noBody')
            assertEq(named(responseGate('GET', false, 304, {})), 'noBody')
            // Gate 3: a body with no length the runner can read, on a request the
            // host will not frame chunked.
            assertEq(named(responseGate('GET', false, 200, {})), 'unframed')
            assertEq(named(responseGate('GET', false, 200, { 'content-length': 'seven' })), 'unframed')
            // And the same request with a length it can read is served.
            assertEq(named(responseGate('GET', false, 200, { 'content-length': '7' })), 'pump 7')
            // **Gate 3 on a chunked-capable request too, where the length is
            // present and unreadable.** `chunkedResponse` is an escape only for a
            // response that declares no length at all: the header's presence is
            // what takes Node's chunked framing away, whatever it says. Measured
            // on Node 23.11.0, a listener answering `content-length: '1 '` with a
            // two-byte body put the padded value on the wire verbatim, sent no
            // `Transfer-Encoding`, and left the socket in the keep-alive pool — so
            // the pump would have run unbounded against a frame the host had
            // already given up, and the surplus byte is the next response's status
            // line.
            assertEq(named(responseGate('GET', true, 200, { 'content-length': '1 ' })), 'unframed')
            assertEq(named(responseGate('GET', true, 200, { 'content-length': 'seven' })), 'unframed')
            // A header present with no value is a header that names nothing, and
            // it reaches the wire the same way.
            assertEq(named(responseGate('GET', true, 200, { 'content-length': '' })), 'unframed')
            // Gate 2 still comes first, so a `HEAD` is answered rather than
            // refused however unreadable the length it does not carry is.
            assertEq(named(responseGate('HEAD', true, 200, { 'content-length': '1 ' })), 'noBody')
            // **Gate 4: a length declared twice is no length either.** Node keeps
            // its pending headers under lower-cased names, so the later value
            // replaces the earlier one and a runner reading the first would count
            // against a number the client never sees. Measured on Darwin with Node
            // 23.11.0, `{ 'Content-Length': '1', 'content-length': '2' }` and a
            // one-byte body put `content-length: 2` and one byte on the wire and
            // left the socket in the keep-alive pool.
            assertEq(named(responseGate('GET', true, 200, { 'Content-Length': '1', 'content-length': '2' })), 'doubledLength')
            // Either way round, since neither value is the one to count against.
            assertEq(named(responseGate('GET', true, 200, { 'content-length': '2', 'Content-Length': '1' })), 'doubledLength')
            // On the request that has no chunking too: the doubling is the
            // response's, not this request's.
            assertEq(named(responseGate('GET', false, 200, { 'Content-Length': '1', 'content-length': '2' })), 'doubledLength')
            // Asked **last**, so each gate above keeps the answer it already had.
            // A `HEAD` is suppressed rather than refused, for the reason gate 2
            // comes before gate 3 at all — the body a doubled length would
            // mis-frame is one Node never carries, and gate 2 already lets an
            // unreadable length stand on a `HEAD`.
            assertEq(named(responseGate('HEAD', true, 200, { 'Content-Length': '1', 'content-length': '2' })), 'noBody')
            // Gate 1 still first: the response is malformed whatever it declares.
            assertEq(named(responseGate('GET', true, 200, { 'transfer-encoding': 'chunked', 'Content-Length': '1', 'content-length': '2' })), 'framingHeader')
            // And gate 3 catches the response that is doubled *and* unreadable,
            // with a blunter message that is true of it as well.
            assertEq(named(responseGate('GET', true, 200, { 'Content-Length': 'one', 'content-length': 'two' })), 'unframed')
            // A name present with no value is not a second declaration: the entries
            // a runner forwards are the defined ones, so this response declares its
            // length once, and it is the one Node emits.
            assertEq(named(responseGate('GET', true, 200, { 'Content-Length': undefined, 'content-length': '2' })), 'pump 2')
            // Two spellings of a name the runner never counts against are no
            // concern of the gate's: Node collapses them and the response is framed
            // exactly as the single length says.
            assertEq(named(responseGate('GET', true, 200, { 'content-length': '1', 'Content-Type': 'text/a', 'content-type': 'text/b' })), 'pump 1')
        },
        // The frame a refusal goes out as, shared so that the two runners spell it
        // alike: a refusal a program is proven against is the refusal it meets.
        runnerResponse: () => {
            const { status, headers, body } = runnerResponse(refusedStatus, framingHeaderMessage)
            assertEq(status, 500)
            assertEq(utf8ToString(body[0]), `${framingHeaderMessage}\n`)
            assertEq(`${headers['content-length']}`, `${byteLength(body[0])}`)
            assertEq(`${headers.connection}`, 'close')
            assertEq(refusalMessage(['framingHeader']), framingHeaderMessage)
            assertEq(refusalMessage(['unframed']), unframedBodyMessage)
            assertEq(refusalMessage(['doubledLength']), doubledLengthMessage)
        },
    },
}
