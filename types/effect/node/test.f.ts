import { empty, isVec, uint, vec8 } from "../../bit_vec/module.f.ts"
import { run } from "../mock/module.f.ts"
import { mkdir, readdir, readFile, writeFile } from "./module.f.ts"
import { emptyState, virtual } from "./virtual/module.f.ts"

export default {
    map: () => {
        let e = readFile('hello').map(([k, v]) => {
            if (k === 'error') { throw v }
            return uint(v) * 2n
        })
        //
        while (true) {
            if ('pure' in e) {
                const result = e.pure
                if (result !== 0x2An) { throw result }
                return
            }
            const [cmd, p, cont] = e.do
            if (cmd !== 'readFile') { throw cmd }
            if (p !== 'hello') { throw p }
            e = cont(['ok', vec8(0x15n)])
        }
    },
    mkdir: {
        one: () => {
            const v = run(virtual)
            const [state, [t, result]] = v(emptyState)(mkdir('a'))
            if (t === 'error') { throw result }
            const a = state.root.a
            if (a === undefined || isVec(a)) { throw a }
        },
        rec: () => {
            const [state, [t, result]] = run(virtual)(emptyState)(
                mkdir('tmp/cache', { recursive: true })
            )
            if (t !== 'ok') { throw result }
            const tmp = state.root.tmp
            if (tmp === undefined || isVec(tmp)) { throw state.root }
            const cache = tmp.cache
            if (cache === undefined || isVec(cache)) { throw tmp }
        },
        nonRec: () => {
            const [state, [t, result]] = run(virtual)(emptyState)(
                mkdir('tmp/cache')
            )
            if (t !== 'error') { throw result }
            if (state.root.tmp !== undefined) { throw state.root.tmp }
        }
    },
    readFile: {
        one: () => {
            const v = run(virtual)
            const initial = {
                ...emptyState,
                root: {
                    hello: vec8(0x2An),
                },
            }
            const [state, [t, result]] = v(initial)(readFile('hello'))
            if (t === 'error') { throw result }
            if (!isVec(result)) { throw result }
            if (uint(result) !== 0x2An) { throw result }
            if (state.root.hello === undefined) { throw state.root }
        },
        nested: () => {
            const [_, [tag, result]] = run(virtual)({
                ...emptyState,
                root: { tmp: { cache: vec8(0x15n) } }
            })(readFile('tmp/cache'))
            if (tag === 'error') { throw result }
            if (uint(result) !== 0x15n) { throw result }
        },
        noSuchFile: () => {
            const [_, [t, result]] = run(virtual)(emptyState)(readFile('hello'))
            if (t !== 'error') { throw result }
            if (result !== 'no such file') { throw result }
        },
        nestedPath: () => {
            const [_, [t, result]] = run(virtual)(emptyState)(readFile('tmp/cache'))
            if (t !== 'error') { throw result }
            if (result !== 'no such file') { throw result }
        }
    },
    readdir: {
        one: () => {
            const [_, [t, result]] = run(virtual)({
                ...emptyState,
                root: {
                    file: vec8(0x2An),
                    dir: {
                        a: empty
                    },
                },
            })(readdir('', { recursive: true }))
            if (t !== 'ok') { throw result }
            const file = result.find(x => x === 'file')
            if (file === undefined) { throw file }
            const dirA = result.find(x => x === 'dir/a')
            if (dirA === undefined) { throw file }
        },
        nested: () => {
            const [_, [t, result]] = run(virtual)({
                ...emptyState,
                root: { tmp: { cache: vec8(0x15n) } }
            })(readdir('tmp', { recursive: true }))
            if (t !== 'ok') { throw result }
            if (result.length !== 1) { throw result }
            if (result[0] !== 'cache') { throw result }
        },
        noSuchDir: () => {
            const [_, [t, result]] = run(virtual)(emptyState)(readdir('tmp', { recursive: true }))
            if (t !== 'error') { throw result }
            if (result !== 'invalid path') { throw result }
        },
    },
    writeFile: {
        one: () => {
            const [state, [t, result]] = run(virtual)(emptyState)(
                writeFile('hello', vec8(0x2An))
            )
            if (t !== 'ok') { throw result }
            const file = state.root.hello
            if (!isVec(file)) { throw file }
            if (uint(file) !== 0x2An) { throw file }
        },
        overwrite: () => {
            const [state, [t, result]] = run(virtual)({
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
            const [state, [t, result]] = run(virtual)(emptyState)(
                writeFile('tmp/cache', vec8(0x2An))
            )
            if (t !== 'error') { throw result }
            if (result !== 'invalid file') { throw result }
            if (state.root.tmp !== undefined) { throw state.root }
        },
        directory: () => {
            const [state, [t, result]] = run(virtual)({
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
}
