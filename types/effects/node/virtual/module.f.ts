/**
 * Virtual Node-effect operations for filesystem and process tests.
 *
 * @module
 */
import { parse } from "../../../../path/module.f.ts"
import { isVec, type Vec } from "../../../bit_vec/module.f.ts"
import { error, ok } from "../../../result/module.f.ts"
import { run, type MemOperationMap, type RunInstance } from "../../mock/module.f.ts"
import { pure } from "../../module.f.ts"
import type { Dirent, IoResult, NodeOperations } from "../module.f.ts"

export type Dir = {
    readonly[name in string]?: Dir | Vec
}

export type State = {
    stdout: string
    stderr: string
    root: Dir
    internet: {
        readonly[url: string]: Vec
    }
}

export const emptyState: State = {
    stdout: '',
    stderr: '',
    root: {},
    internet: {},
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
        if (subDir === undefined || isVec(subDir)) {
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
    if (!isVec(file)) { return error(`'${path[0]}' is not a file`) }
    return ok(file)
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
            const isFile = isVec(content)
            result = [...result, { name, parentPath, isFile }]
            if (!isFile && recursive) {
                result = [...result, ...f(`${parentPath}/${name}`, content)]
            }
        }
        return result
    }
    return ok(f(base, dir))
})

const console = (name: 'stderr'|'stdout') => (state: State, payload: string) =>
    [{ ...state, [name]: `${state[name]}${payload}\n` }, undefined] as const

const map: MemOperationMap<NodeOperations, State> = {
    all: (state, a) => {
        let e: readonly unknown[] = []
        for (const i of a) {
            const [ns, ei] = virtual(state)(i)
            state = ns
            e = [...e, ei]
        }
        return [state, pure(e)]
    },
    error: console('stderr'),
    log: console('stdout'),
    fetch: (state, url) => {
        const result = state.internet[url]
        return result === undefined ? [state, error('not found')] : [state, ok(result)]
    },
    mkdir: (state, [path, p]) => mkdir(p !== undefined)(state, path),
    readFile,
    readdir: (state, [path, { recursive }]) => readdir(path, recursive === true)(state, path),
    writeFile: (state, [path, payload]) => writeFile(payload)(state, path),
}

export const virtual: RunInstance<NodeOperations, State> = run(map)
