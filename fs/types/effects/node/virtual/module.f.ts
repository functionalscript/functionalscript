/**
 * Virtual Node-effect operations for filesystem and process tests.
 *
 * @module
 */
import { todo } from '../../../../dev/module.f.ts'
import { parse } from '../../../../path/module.f.ts'
import { utf8ToString } from '../../../../text/module.f.ts'
import { isVec, type Vec } from '../../../bit_vec/module.f.ts'
import { error, ok } from '../../../result/module.f.ts'
import { run, type MemOperationMap, type RunInstance } from '../../mock/module.f.ts'
import type { Dirent, IoResult, Module, NodeOp } from '../module.f.ts'

/**
 * In-memory JS module entry. When `import_` is called on the path, the
 * function is invoked and its return value is the module value (with a
 * `default` export and optional named exports). Using a function (not a
 * plain value) lets the entry be distinguished from `Vec`/`Dir` at runtime
 * via `typeof === 'function'`, and lets the fixture compute the module on
 * each import for closures/state.
 */
export type JsModule = () => unknown

const isJsModule = (x: unknown): x is JsModule => typeof x === 'function'

export type Dir = {
    readonly[name in string]?: Dir | Vec | JsModule
}

export type State = {
    stdout: string
    stderr: string
    root: Dir
    internet: {
        readonly[url: string]: Vec
    }
    epochNs: number
}

export const emptyState: State = {
    stdout: '',
    stderr: '',
    root: {},
    internet: {},
    epochNs: 0,
}

const operation =
<T>(op: (dir: Dir, path: readonly string[]) => readonly[Dir, T]) =>
{
    const f = (dir: Dir, path: readonly string[]): readonly[Dir, T] =>
    {
        if (path.length === 0) {
            return op(dir, path)
        }
        const [first, ...rest] = path
        const subDir = dir[first]
        if (subDir === undefined || isVec(subDir) || isJsModule(subDir)) {
            return op(dir, path)
        }
        const [newSubDir, r] = f(subDir, rest)
        return [{ ...dir, [first]: newSubDir }, r]
    }
    return (state: State, path: string) => {
        const [root, result] = f(state.root, parse(path))
        return [{ ...state, root }, result] as const
    }
}

const readOperation = <T>(op: (dir: Dir, path: readonly string[]) => T) => operation(
    (dir, path) => [dir, op(dir, path)]
)

const okVoid = ok(undefined)

const mkdir = (recursive: boolean) => operation((dir, path): readonly[Dir, IoResult<void>] => {
    let d = {}
    let i = path.length
    if (i > 1 && !recursive) {
        return [dir, error('non-recursive')]
    }
    while (i > 0) {
        i -= 1
        d = { [path[i]]: d }
    }
    dir = { ...dir, ...d }
    return [dir, okVoid]
})

const readFileError = error('no such file')

const readFile = readOperation((dir, path): IoResult<Vec> => {
    if (path.length !== 1) { return readFileError }
    const file = dir[path[0]]
    if (isJsModule(file)) { throw new Error(`'${path[0]}' is a JsModule; readFile not supported`) }
    if (!isVec(file)) { return error(`'${path[0]}' is not a file`) }
    return ok(file)
})

const import_ = readOperation((dir, path): IoResult<Module> => {
    if (path.length !== 1) { return error('no such file') }
    const entry = dir[path[0]]
    if (entry === undefined) { return error('no such file') }
    if (!isJsModule(entry)) { return error(`'${path[0]}' is not a JsModule`) }
    return ok(entry() as Module)
})

const writeFileError = error('invalid file')

const writeFile = (payload: Vec) => operation((dir, path): readonly[Dir, IoResult<void>] => {
    if (path.length !== 1) { return [dir, writeFileError] }
    const [name] = path
    const file = dir[name]
    // fail if the file is a directory
    if (file !== undefined && !isVec(file)) { return [dir, writeFileError] }
    dir = { ...dir, [name]: payload }
    return [dir, okVoid]
})

const invalidPath = error('invalid path')

const { entries } = Object

const readdir = (base: string, recursive: boolean) => readOperation((dir, path): IoResult<readonly Dirent[]> => {
    if (path.length !== 0) { return invalidPath }
    const f = (parentPath: string, d: Dir) => {
        let result: readonly Dirent[] = []
        for (const [name, content] of entries(d)) {
            if (content === undefined) { continue }
            const isFile = isVec(content) || isJsModule(content)
            result = [...result, { name, parentPath, isFile }]
            if (!isFile && recursive) {
                result = [...result, ...f(`${parentPath}/${name}`, content as Dir)]
            }
        }
        return result
    }
    return ok(f(base, dir))
})

const access = readOperation((dir, path): IoResult<void> => {
    if (path.length === 0) { return okVoid }
    if (path.length !== 1) { return error('no such file or directory') }
    return dir[path[0]] !== undefined ? okVoid : error('no such file or directory')
})

const rm = operation((dir, path): readonly[Dir, IoResult<void>] => {
    if (path.length !== 1) { return [dir, error('invalid path')] }
    const [name] = path
    const entry = dir[name]
    if (entry === undefined) { return [dir, error('no such file')] }
    if (!isVec(entry) && !isJsModule(entry)) { return [dir, error('is a directory')] }
    const { [name]: _, ...rest } = dir
    return [rest as Dir, okVoid]
})

const map: MemOperationMap<NodeOp, State> = {
    all: (state, ...a) => {
        let e: readonly unknown[] = []
        for (const i of a) {
            const [ns, ei] = virtual(state)(i)
            state = ns
            e = [...e, ei]
        }
        return [state, e]
    },
    fetch: (state, url) => {
        const result = state.internet[url]
        return result === undefined ? [state, error('not found')] : [state, ok(result)]
    },
    mkdir: (state, path, p) => mkdir(p !== undefined)(state, path),
    readFile,
    readdir: (state, path, { recursive }) => readdir(path, recursive === true)(state, path),
    writeFile: (state, path, payload) => writeFile(payload)(state, path),
    access,
    import: import_,
    rm,
    exec: todo,
    createServer: todo,
    listen: todo,
    forever: todo,
    now: (state) => [state, state.epochNs],
    sandbox: (state, f) => {
        let result
        try { result = ok(f()) } catch (e) { result = error(e) }
        return [state, { result, duration: 0 }]
    },
    write: (state, stream, data) => {
        const s = utf8ToString(data)
        return [{ ...state, [stream]: `${state[stream]}${s}` }, undefined] as const
    },
}

export const virtual: RunInstance<NodeOp, State> = run(map)
