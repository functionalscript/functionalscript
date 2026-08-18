/**
 * @import { Vec } from "../../types/bit_vec/types.ts"
 * @import { IoChannel, IoError, IoResult, ReadFile } from "./types.ts"
 * @import { Result } from "../../types/result/types.ts"
 * @import { List } from "../list/types.ts"
 * @import { OperationMap } from "../types.ts"
 */

import { empty, isVec, uint, vec, vec8 } from "../../types/bit_vec/module.f.mjs"
import { utf8, utf8ToString } from "../../text/module.f.mjs"
import { match, pure, step } from "../module.f.mjs"
import { step as ioStep } from "../io/module.f.mjs"
import { both, errorMessage, errorSummary, exitStep, fetch, ioError, isNotFound, mkdir, now, readdir, readFile, readUtf8File, rm, sandbox, toIoError, writeFile, writeUtf8File, rename, readBytes, randomInt, writeFromStream, usesInlineTestContext, versionLessThan } from "./module.f.mjs"
import { create as memCreate, read as memRead, write as memWrite } from "../memory/module.f.mjs"
import { empty as listEmpty, nonEmpty as listNonEmpty } from "../list/module.f.mjs"
import { emptyState, virtual } from "./virtual/module.f.mjs"
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'

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

/** Asserts that an operation succeeded with `expected`.
 * @type {<T, E>(r: Result<T, E>, expected: T) => void}
 */
const assertOk = (r, expected) => {
    assert(r[0] === 'ok', r)
    assertEq(r[1], expected)
}

export const proof = {
    // The one boundary where a runner's `catch` becomes effect data: whatever
    // was thrown is reduced to a code (when the host attached a string one)
    // and a message.
    toIoError: {
        error: () => {
            assertIoMessage(toIoError(new Error('boom')), 'boom')
        },
        withCode: () => {
            const e = toIoError(Object.assign(new Error('missing'), { code: 'ENOENT' }))
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, 'ENOENT', e)
            assertEq(e[1].message, 'missing', e)
        },
        // A thrown non-`Error` still normalizes: the value's string form is the
        // message, and there is no code to carry.
        string: () => {
            const e = toIoError('plain')
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, undefined, e)
            assertEq(e[1].message, 'plain', e)
        },
        null: () => {
            assertIoMessage(toIoError(null), 'null')
        },
        // An object whose `code` is not a string is not an OS error code, so it
        // is dropped rather than carried as one.
        nonStringCode: () => {
            const e = toIoError({ code: 42 })
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, undefined, e)
        },
        noCode: () => {
            const e = toIoError({})
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, undefined, e)
        },
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
            assertEq(code, 0)
            assertEq(state.stderr, '')
        },
        // ...and a failure is reported on `stderr` and exits `1`.
        error: () => {
            const [state, code] = virtual(emptyState)(exitStep(readFile('missing')))
            assertEq(code, 1)
            assertEq(state.stderr, 'no such file or directory\n')
        },
    },
    externalTestContext: () => {
        assert(usesInlineTestContext('node', 'v22.20.0'))
        assert(usesInlineTestContext('node', '25.99.99'))
        assert(!usesInlineTestContext('node', '26.0.0'))
        assert(!usesInlineTestContext('node', '26.1.0'))
        assert(!usesInlineTestContext('node'))
        assert(usesInlineTestContext('bun'))
        assert(!usesInlineTestContext('deno', '22.0.0'))
        assert(versionLessThan('25.99.99', '26.0.0'))
        assert(versionLessThan('26.0.0', '26.1.0'))
        assert(versionLessThan('26.1.0', '26.1.1'))
        assert(!versionLessThan('26.1.1', '26.1.1'))
    },
    map: () => {
        const e = step(
            readFile('hello'),
            ([k, v]) => {
                assert(k !== 'error', v)
                return pure(uint(v) * 2n)
            })
        //
        let r = readHello(e)
        while (r[0] === 'cont') {
            r = readHello(r[2](r[1]))
        }
        assertEq(r[1], 0x2An)
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
    },
    writeUtf8File: () => {
        const [state, [t, result]] = virtual(emptyState)(
            writeUtf8File('hello', 'Hello, world!')
        )
        assert(t === 'ok', result)
        const file = state.root.hello
        assert(Array.isArray(file), file)
        assertEq(utf8ToString(file[0]), 'Hello, world!', file)
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
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(rm('hello'))
            assert(t === 'error', result)
            assertIoMessage(result, 'no such file')
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
        assertOk(result, 1_000_000)
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
            assertOk(value, 42)
        },
        createAndWrite: () => {
            const effect = ioStep(
                    memCreate(1),
                    key => ioStep(
                        memWrite(key, 99),
                        () => memRead(key)))
            const [_, value] = virtual(emptyState)(effect)
            assertOk(value, 99)
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
    randomInt: {
        increments: () => {
            const [state1, r1] = virtual(emptyState)(randomInt())
            assertOk(r1, 0)
            const [state2, r2] = virtual(state1)(randomInt())
            assertOk(r2, 1)
            const [_, r3] = virtual(state2)(randomInt())
            assertOk(r3, 2)
        },
    },
    writeFromStream: {
        createExclusiveFails: () => {
            // The destination already exists, so `createExclusive` fails (EEXIST) and
            // the error propagates without ever touching `writeBytes`.
            /** @type {List<never, IoResult<Vec>>} */
            const chunks = listEmpty()
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { hello: [vec8(0x2An)] },
            })(writeFromStream('hello', chunks))
            assert(t === 'error', result)
            const file = state.root.hello
            assert(!(!Array.isArray(file) || uint(file[0]) !== 0x2An), file)
        },
        invalidBufferSize: () => {
            // A chunk whose bit length isn't a multiple of 8 trips the
            // byte-alignment guard before `writeBytes` is ever called.
            /** @type {List<never, IoResult<Vec>>} */
            const chunks = listNonEmpty(['ok', vec(4n)(0b1010n)], listEmpty())
            const [_, [t, result]] = virtual(emptyState)(
                writeFromStream('hello', chunks)
            )
            assert(t === 'error', result)
            assertIoMessage(result, 'invalid buffer size')
        },
    },
}
