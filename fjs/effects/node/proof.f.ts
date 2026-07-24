import { empty, isVec, uint, vec, vec8, type Vec } from "../../types/bit_vec/module.f.ts"
import { utf8, utf8ToString } from "../../text/module.f.ts"
import { decode, pure, step } from "../module.f.ts"
import { eff } from "../eff/module.f.ts"
import { both, fetch, mkdir, now, readdir, readFile, readUtf8File, rm, sandbox, writeFile, writeUtf8File, rename, readBytes, randomInt, writeFromStream, type IoResult } from "./module.f.ts"
import { create as memCreate, read as memRead, write as memWrite } from "../memory/module.f.ts"
import { empty as listEmpty, nonEmpty as listNonEmpty } from "../list/module.f.ts"
import { emptyState, virtual, type Dir } from "./virtual/module.f.ts"
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.ts'

export const proof = {
    map: () => {
        const e = eff(readFile('hello')).step(([k, v]) => {
            assert(k !== 'error', v)
            return pure(uint(v) * 2n)
        }).value
        //
        let d = decode(e)
        while (!d.done) {
            assertEq(d.command, 'readFile')
            assert(d.payload[0] === 'hello', d.payload)
            d = decode(d.continuation(['ok', vec8(0x15n)]))
        }
        assertEq(d.result, 0x2An)
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
            assert(!(typeof tmp !== 'object' || Array.isArray(tmp)), state.root)
            const cache = (tmp as Dir).cache
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
            if ((result as { code?: unknown }).code !== 'ENOENT') { throw result }
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
            assertEq(result, 'invalid path')
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
            assertEq(result, 'invalid file')
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
            assertEq(result, 'invalid file')
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
            assert(!(typeof tmp !== 'object' || Array.isArray(tmp)), state.root)
            assertEq((tmp as Dir).cache, undefined, tmp)
        },
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(rm('hello'))
            assert(t === 'error', result)
            assertEq(result, 'no such file')
        },
        isDirectory: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: {} },
            })(rm('tmp'))
            assert(t === 'error', result)
            assertEq(result, 'invalid path')
            assert(state.root.tmp !== undefined, state.root)
        },
    },
    both: () => {
        const [_, results] = virtual({
            ...emptyState,
            root: {
                a: [vec8(0x2An)],
                b: [vec8(0x15n)],
            },
        })(both(readFile('a'))(readFile('b')))
        assert(results[0][0] === 'ok', results[0])
        assert(results[1][0] === 'ok', results[1])
        assertEq(uint(results[0][1]), 0x2An, results[0][1])
        assertEq(uint(results[1][1]), 0x15n, results[1][1])
    },
    now: () => {
        const [_, result] = virtual({ ...emptyState, epochNs: 1_000_000 })(now())
        assertEq(result, 1_000_000)
    },
    sandbox: {
        // Virtual `sandbox` is now a pass-through: the function is expected
        // to return a `SandboxResult` directly. Fixtures dictate the result
        // (and `duration`) instead of the runner measuring.
        ok: () => {
            const [_, { result, duration }] = virtual(emptyState)(
                sandbox(() => ({ result: ['ok', 42], duration: 0 }) as never))
            assert(result[0] === 'ok', result)
            assertEq(result[1], 42)
            assertEq(duration, 0)
        },
        error: () => {
            const err = new Error('fail')
            const [_, { result }] = virtual(emptyState)(
                sandbox(() => ({ result: ['error', err], duration: 0 }) as never))
            assert(result[0] === 'error', result)
            assertEq(result[1], err)
        },
    },
    memory: {
        createAndRead: () => {
            const effect = step(memCreate(42), key => memRead(key))
            const [_, value] = virtual(emptyState)(effect)
            assertEq(value, 42)
        },
        createAndWrite: () => {
            const effect = step(
                    memCreate(1),
                    key => step(
                        memWrite(key, 99),
                        () => memRead(key)))
            const [_, value] = virtual(emptyState)(effect)
            assertEq(value, 99)
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
            assertEq(uint((state.root.dst as readonly Vec[])[0]), 0x2An, state.root)
        },
        nestedRename: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { src: [vec8(0x2An)] } },
            })(rename('tmp/src', 'tmp/dst'))
            assert(t === 'ok', result)
            const tmp = state.root.tmp
            assert(!(typeof tmp !== 'object' || Array.isArray(tmp)), state.root)
            assertEq((tmp as Dir).src, undefined, tmp)
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
            assertEq(r1, 0)
            const [state2, r2] = virtual(state1)(randomInt())
            assertEq(r2, 1)
            const [_, r3] = virtual(state2)(randomInt())
            assertEq(r3, 2)
        },
    },
    writeFromStream: {
        createExclusiveFails: () => {
            // The destination already exists, so `createExclusive` fails (EEXIST) and
            // the error propagates without ever touching `writeBytes`.
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { hello: [vec8(0x2An)] },
            })(writeFromStream('hello', listEmpty<never, IoResult<Vec>>()))
            assert(t === 'error', result)
            const file = state.root.hello
            assert(!(!Array.isArray(file) || uint(file[0]) !== 0x2An), file)
        },
        invalidBufferSize: () => {
            // A chunk whose bit length isn't a multiple of 8 trips the
            // byte-alignment guard before `writeBytes` is ever called.
            const [_, [t, result]] = virtual(emptyState)(
                writeFromStream('hello', listNonEmpty<never, IoResult<Vec>>(['ok', vec(4n)(0b1010n)], listEmpty()))
            )
            assert(t === 'error', result)
            assertEq(result, 'invalid buffer size')
        },
    },
}
