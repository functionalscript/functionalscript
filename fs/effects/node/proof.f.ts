import { empty, isVec, uint, vec8 } from "../../types/bit_vec/module.f.ts"
import { utf8, utf8ToString } from "../../text/module.f.ts"
import { pure } from "../module.f.ts"
import { both, fetch, mkdir, now, readdir, readFile, readUtf8File, rm, sandbox, writeFile, writeUtf8File } from "./module.f.ts"
import { create as memCreate, read as memRead, write as memWrite } from "../memory/module.f.ts"
import { emptyState, virtual } from "./virtual/module.f.ts"

export const proof = {
    map: () => {
        let e = readFile('hello').step(([k, v]) => {
            if (k === 'error') { throw v }
            return pure(uint(v) * 2n)
        })
        //
        while (true) {
            const { value } = e
            if (value.length === 1) {
                const [result] = value
                if (result !== 0x2An) { throw result }
                return
            }
            const [cmd, p, cont] = value
            if (cmd !== 'readFile') { throw cmd }
            if (p[0] !== 'hello') { throw p }
            e = cont(['ok', vec8(0x15n)])
        }
    },
    fetch: () => {
        const [_, [t, result]] = virtual({
            ...emptyState,
            internet: {
                'https://example.com/data': vec8(0x2An),
            },
        })(fetch('https://example.com/data'))
        if (t === 'error') { throw result }
        if (!isVec(result)) { throw result }
        if (uint(result) !== 0x2An) { throw result }
    },
    mkdir: {
        one: () => {
            const [state, [t, result]] = virtual(emptyState)(mkdir('a'))
            if (t === 'error') { throw result }
            const a = state.root.a
            if (a === undefined || isVec(a)) { throw a }
        },
        rec: () => {
            const [state, [t, result]] = virtual(emptyState)(
                mkdir('tmp/cache', { recursive: true })
            )
            if (t !== 'ok') { throw result }
            const tmp = state.root.tmp
            if (typeof tmp !== 'object') { throw state.root }
            const cache = tmp.cache
            if (typeof cache !== 'object') { throw tmp }
        },
        nonRec: () => {
            const [state, [t, result]] = virtual(emptyState)(
                mkdir('tmp/cache')
            )
            if (t !== 'error') { throw result }
            if (state.root.tmp !== undefined) { throw state.root.tmp }
        }
    },
    readFile: {
        one: () => {
            const initial = {
                ...emptyState,
                root: {
                    hello: vec8(0x2An),
                },
            }
            const [state, [t, result]] = virtual(initial)(readFile('hello'))
            if (t === 'error') { throw result }
            if (!isVec(result)) { throw result }
            if (uint(result) !== 0x2An) { throw result }
            if (state.root.hello === undefined) { throw state.root }
        },
        nested: () => {
            const [_, [tag, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: vec8(0x15n) } }
            })(readFile('tmp/cache'))
            if (tag === 'error') { throw result }
            if (uint(result) !== 0x15n) { throw result }
        },
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(readFile('hello'))
            if (t !== 'error') { throw result }
        },
        nestedPath: () => {
            const [_, [t, result]] = virtual(emptyState)(readFile('tmp/cache'))
            if (t !== 'error') { throw result }
            if (result !== 'no such file') { throw result }
        }
    },
    readUtf8File: {
        ok: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { hello: utf8('Hello, world!') },
            })(readUtf8File('hello'))
            if (t !== 'ok') { throw result }
            if (result !== 'Hello, world!') { throw result }
        },
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(readUtf8File('hello'))
            if (t !== 'error') { throw result }
        },
    },
    readdir: {
        one: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: {
                    file: vec8(0x2An),
                    dir: {
                        a: empty
                    },
                },
            })(readdir('', { recursive: true }))
            if (t !== 'ok') { throw result }
            const file = result.find(x => x.name === 'file')
            if (file === undefined || file.parentPath !== '' || !file.isFile) { throw `file: ${file}` }
            const dirA = result.find(x => x.name === 'a')
            if (dirA === undefined || dirA.parentPath !== '/dir') { throw `dirA: ${dirA?.parentPath}` }
        },
        nonRecursive: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: {
                    file: vec8(0x2An),
                    dir: {
                        a: empty
                    },
                },
            })(readdir('', { }))
            if (t !== 'ok') { throw result }
            if (result.length !== 2) { throw result }
            const file = result.find(x => x.name === 'file')
            if (file === undefined) { throw file }
            const dir = result.find(x => x.name === 'dir')
            if (dir === undefined) { throw dir }
        },
        nested: () => {
            const [_, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: vec8(0x15n) } }
            })(readdir('tmp', { recursive: true }))
            if (t !== 'ok') { throw result }
            if (result.length !== 1) { throw result }
            const [r0] = result
            if (r0.name !== 'cache') { throw r0 }
            if (r0.parentPath !== 'tmp') { throw r0 }
        },
        noSuchDir: () => {
            const [_, [t, result]] = virtual(emptyState)(readdir('tmp', { recursive: true }))
            if (t !== 'error') { throw result }
            if (result !== 'invalid path') { throw result }
        },
    },
    writeFile: {
        one: () => {
            const [state, [t, result]] = virtual(emptyState)(
                writeFile('hello', vec8(0x2An))
            )
            if (t !== 'ok') { throw result }
            const file = state.root.hello
            if (!isVec(file)) { throw file }
            if (uint(file) !== 0x2An) { throw file }
        },
        overwrite: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: {
                    hello: vec8(0x15n),
                },
            })(
                writeFile('hello', vec8(0x2An))
            )
            if (t !== 'ok') { throw result }
            const file = state.root.hello
            if (!isVec(file)) { throw file }
            if (uint(file) !== 0x2An) { throw file }
        },
        nestedPath: () => {
            const [state, [t, result]] = virtual(emptyState)(
                writeFile('tmp/cache', vec8(0x2An))
            )
            if (t !== 'error') { throw result }
            if (result !== 'invalid file') { throw result }
            if (state.root.tmp !== undefined) { throw state.root }
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
            if (t !== 'error') { throw result }
            if (result !== 'invalid file') { throw result }
            const tmp = state.root.tmp
            if (tmp === undefined || isVec(tmp)) { throw tmp }
        },
    },
    writeUtf8File: () => {
        const [state, [t, result]] = virtual(emptyState)(
            writeUtf8File('hello', 'Hello, world!')
        )
        if (t !== 'ok') { throw result }
        const file = state.root.hello
        if (!isVec(file)) { throw file }
        if (utf8ToString(file) !== 'Hello, world!') { throw file }
    },
    rm: {
        one: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { hello: vec8(0x2An) },
            })(rm('hello'))
            if (t !== 'ok') { throw result }
            if (state.root.hello !== undefined) { throw state.root }
        },
        nested: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: { cache: vec8(0x15n) } },
            })(rm('tmp/cache'))
            if (t !== 'ok') { throw result }
            const tmp = state.root.tmp
            if (typeof tmp !== 'object') { throw state.root }
            if (tmp.cache !== undefined) { throw tmp }
        },
        noSuchFile: () => {
            const [_, [t, result]] = virtual(emptyState)(rm('hello'))
            if (t !== 'error') { throw result }
            if (result !== 'no such file') { throw result }
        },
        isDirectory: () => {
            const [state, [t, result]] = virtual({
                ...emptyState,
                root: { tmp: {} },
            })(rm('tmp'))
            if (t !== 'error') { throw result }
            if (result !== 'invalid path') { throw result }
            if (state.root.tmp === undefined) { throw state.root }
        },
    },
    both: () => {
        const [_, results] = virtual({
            ...emptyState,
            root: {
                a: vec8(0x2An),
                b: vec8(0x15n),
            },
        })(both(readFile('a'))(readFile('b')))
        if (results[0][0] !== 'ok') { throw results[0] }
        if (results[1][0] !== 'ok') { throw results[1] }
        if (uint(results[0][1]) !== 0x2An) { throw results[0][1] }
        if (uint(results[1][1]) !== 0x15n) { throw results[1][1] }
    },
    now: () => {
        const [_, result] = virtual({ ...emptyState, epochNs: 1_000_000 })(now())
        if (result !== 1_000_000) { throw result }
    },
    sandbox: {
        // Virtual `sandbox` is now a pass-through: the function is expected
        // to return a `SandboxResult` directly. Fixtures dictate the result
        // (and `duration`) instead of the runner measuring.
        ok: () => {
            const [_, { result, duration }] = virtual(emptyState)(
                sandbox(() => ({ result: ['ok', 42], duration: 0 }) as never))
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 42) { throw result[1] }
            if (duration !== 0) { throw duration }
        },
        error: () => {
            const err = new Error('fail')
            const [_, { result }] = virtual(emptyState)(
                sandbox(() => ({ result: ['error', err], duration: 0 }) as never))
            if (result[0] !== 'error') { throw result }
            if (result[1] !== err) { throw result[1] }
        },
    },
    memory: {
        createAndRead: () => {
            const effect = memCreate(42).step(key => memRead(key))
            const [_, value] = virtual(emptyState)(effect)
            if (value !== 42) { throw value }
        },
        createAndWrite: () => {
            const effect = memCreate(1).step(key =>
                memWrite(key, 99).step(() => memRead(key))
            )
            const [_, value] = virtual(emptyState)(effect)
            if (value !== 99) { throw value }
        },
    },
}
