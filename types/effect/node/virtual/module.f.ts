import { parse } from "../../../../path/module.f.ts"
import { isVec, type Vec } from "../../../bit_vec/module.f.ts"
import { error, ok } from "../../../result/module.f.ts"
import type { MemOperationMap } from "../../mock/module.f.ts"
import type { Dirent, IoResult, NodeOperations } from "../module.f.ts"

export type VirtualDir = {
    readonly[name in string]?: VirtualDir | Vec
}

export type VirtualState = {
    stdout: string
    stderr: string
    root: VirtualDir
}

export const emptyState: VirtualState = {
    stdout: '',
    stderr: '',
    root: {},
}

const operation =
<T>(op: (dir: VirtualDir, path: readonly string[]) => readonly[VirtualDir, T]) =>
{
    const f = (dir: VirtualDir, path: readonly string[]): readonly[VirtualDir, T] =>
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
    return (state: VirtualState, path: string) => {
        const [root, result] = f(state.root, parse(path))
        return [{ ...state, root }, result] as const
    }
}

// TODO: we can have a better implementation with some code shared with `operation`.
const readOperation = <T>(op: (dir: VirtualDir, path: readonly string[]) => T) => operation(
    (dir, path) => [dir, op(dir, path)]
)

const okVoid = ok(undefined)

const mkdir = (recursive: boolean) => operation((dir, path): readonly[VirtualDir, IoResult<void>] => {
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

const writeFile = (payload: Vec) => operation((dir, path): readonly[VirtualDir, IoResult<void>] => {
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

const readdir = (recursive: boolean) => readOperation((dir, path): IoResult<readonly Dirent[]> => {
    if (path.length !== 0) { return invalidPath }
    const f = (parentPath: string, d: VirtualDir) => {
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
    return ok(f('', dir))
})

const console = (name: 'stderr'|'stdout') => (state: VirtualState, payload: string) =>
    [{ ...state, [name]: `${state[name]}${payload}\n` }, undefined] as const

export const virtual: MemOperationMap<NodeOperations, VirtualState> = {
    error: console('stderr'),
    log: console('stdout'),
    mkdir: (state, [path, p]) => mkdir(p !== undefined)(state, path),
    readFile,
    readdir: (state, [path, { recursive }]) => readdir(recursive === true)(state, path),
    writeFile: (state, [path, payload]) => writeFile(payload)(state, path),
}
