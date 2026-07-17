import { empty, isVec, uint, vec8, type Vec } from "../../types/bit_vec/module.f.ts"
import { utf8, utf8ToString } from "../../text/module.f.ts"
import { decode, pure } from "../module.f.ts"
import { both, fetch, mkdir, now, readdir, readFile, readUtf8File, rm, sandbox, writeFile, writeUtf8File, rename, readBytes, randomInt, writeFromStream, type IoResult } from "./module.f.ts"
import { create as memCreate, read as memRead, write as memWrite } from "../memory/module.f.ts"
import { empty as listEmpty } from "../list/module.f.ts"
import { emptyState, virtual, type Dir } from "./virtual/module.f.ts"
import { assert } from '../../asserts/module.f.ts'

export const proof = {
    map: () => {
        const e = readFile('hello').step(([k, v]) => {
            assert(k !== 'error', v)
            return pure(uint(v) * 2n)
        })
        //
        let d = decode(e)
        while (!d.done) {
            assert(d.command === 'readFile', d.command)
            assert(d.payload[0] === 'hello', d.payload)
            d = decode(d.continuation(['ok', vec8(0x15n)]))
        }
        assert(d.result === 0x2An, d.result)
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
        assert(uint(result) === 0x2An, result)
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
            assert(state.root.tmp === undefined, state.root.tmp)
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
            assert(uint(result) === 0x2An, result)
            assert(state.root.hello !== undefined, state.root)
        },
        nested: () => {
            const [_, [tag, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: [vec8(0x15n)] } }
            })(readFile('tmp/cache'))
            assert(tag !== 'error', result)
            assert(uint(result) === 0x15n, result)
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
            assert(result === 'Hello, world!', result)
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
            assert(result.length === 2, result)
            const file = result.find(x => x.name === 'file')
            assert(file !== undefined, file)
            const dir = result.find(x => x.name === 'dir')
            assert(dir !== undefined, dir)
        },
        nested: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: [vec8(0x15n)] } }
            })(readdir('tmp', { recursive: true }))
            assert(t === 'ok', result)
            assert(result.length === 1, result)
            const [r0] = result
            assert(r0.name === 'cache', r0)
            assert(r0.parentPath === 'tmp', r0)
        },
        noSuchDir: () => {
            const [_, [t, result]] = virtual(emptyState)(readdir('tmp', { recursive: true }))
            assert(t === 'error', result)
            assert(result === 'invalid path', result)
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
            assert(uint(file[0]) === 0x2An, file)
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
            assert(uint(file[0]) === 0x2An, file)
        },
        nestedPath: () => {
            const [state, [t, result]] = virtual(emptyState)(
                writeFile('tmp/cache', vec8(0x2An))
            )
            assert(t === 'error', result)
            assert(result === 'invalid file', result)
            assert(state.root.tmp === undefined, state.root)
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
            assert(result === 'invalid file', result)
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
        assert(utf8ToString(file[0]) === 'Hello, world!', file)
    },
    rm: {
        one: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { hello: [vec8(0x2An)] },
            })(rm('hello'))
            assert(t === 'ok', result)
            assert(state.root.hello === undefined, state.root)
        },
        nested: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: [vec8(0x15n)] } },
            })(rm('tmp/cache'))
            assert(t === 'ok', result)
            const tmp = state.root.tmp
            assert(!(typeof tmp !== 'object' || Array.isArray(tmp)), state.root)
            assert((tmp as Dir).cache === undefined, tmp)
        },
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(rm('hello'))
            assert(t === 'error', result)
            assert(result === 'no such file', result)
        },
        isDirectory: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: {} },
            })(rm('tmp'))
            assert(t === 'error', result)
            assert(result === 'invalid path', result)
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
        assert(uint(results[0][1]) === 0x2An, results[0][1])
        assert(uint(results[1][1]) === 0x15n, results[1][1])
    },
    now: () => {
        const [_, result] = virtual({ ...emptyState, epochNs: 1_000_000 })(now())
        assert(result === 1_000_000, result)
    },
    sandbox: {
        // Virtual `sandbox` is now a pass-through: the function is expected
        // to return a `SandboxResult` directly. Fixtures dictate the result
        // (and `duration`) instead of the runner measuring.
        ok: () => {
            const [_, { result, duration }] = virtual(emptyState)(
                sandbox(() => ({ result: ['ok', 42], duration: 0 }) as never))
            assert(result[0] === 'ok', result)
            assert(result[1] === 42, result[1])
            assert(duration === 0, duration)
        },
        error: () => {
            const err = new Error('fail')
            const [_, { result }] = virtual(emptyState)(
                sandbox(() => ({ result: ['error', err], duration: 0 }) as never))
            assert(result[0] === 'error', result)
            assert(result[1] === err, result[1])
        },
    },
    memory: {
        createAndRead: () => {
            const effect = memCreate(42).step(key => memRead(key))
            const [_, value] = virtual(emptyState)(effect)
            assert(value === 42, value)
        },
        createAndWrite: () => {
            const effect = memCreate(1).step(key =>
                memWrite(key, 99).step(() => memRead(key))
            )
            const [_, value] = virtual(emptyState)(effect)
            assert(value === 99, value)
        },
    },
    rename: {
        fileOverFile: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { src: [vec8(0x2An)], dst: [vec8(0x15n)] },
            })(rename('src', 'dst'))
            assert(t === 'ok', result)
            assert(state.root.src === undefined, state.root)
            assert(Array.isArray(state.root.dst), state.root)
            assert(uint((state.root.dst as readonly Vec[])[0]) === 0x2An, state.root)
        },
        nestedRename: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { src: [vec8(0x2An)] } },
            })(rename('tmp/src', 'tmp/dst'))
            assert(t === 'ok', result)
            const tmp = state.root.tmp
            assert(!(typeof tmp !== 'object' || Array.isArray(tmp)), state.root)
            assert((tmp as Dir).src === undefined, tmp)
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
            assert(r1 === 0, r1)
            const [state2, r2] = virtual(state1)(randomInt())
            assert(r2 === 1, r2)
            const [_, r3] = virtual(state2)(randomInt())
            assert(r3 === 2, r3)
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
    },
}
