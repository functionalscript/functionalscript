import { isVec, type Vec } from "../../../bit_vec/module.f.ts"
import { error, ok } from "../../../result/module.f.ts"
import type { MemOperationMap } from "../../mock/module.f.ts"
import type { IoResult, NodeOperations } from "../module.f.ts"

export type VirtualDir = {
    readonly[name in string]?: VirtualDir | Vec
}

export type VirtualState = {
    stdout: string
    root: VirtualDir
}

export const emptyState: VirtualState = {
    stdout: '',
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
        const [root, result] = f(state.root, path.split('/'))
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
    if (!isVec(file)) { return readFileError }
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

const readdir = readOperation((dir, path): IoResult<readonly string[]> => {
    if (path.length !== 0) { return invalidPath }
    const f = (prefix: string, d: VirtualDir) => {
        let result: readonly string[] = []
        for (const [name, content] of Object.entries(d)) {
            if (content === undefined) { continue }
            const fullName = `${prefix}${name}`
            if (isVec(content)) {
                result = [...result, fullName]
                continue
            }
            result = [...result, ...f(`${fullName}/`, content)]
        }
        return result
    }
    return ok(f('', dir))
})

export const virtual: MemOperationMap<NodeOperations, VirtualState> = {
    log: (state, payload) => [{ ...state, stdout: `${state.stdout}${payload}\n` }, undefined],
    mkdir: (state, [path, p]) => mkdir(p !== undefined)(state, path),
    readFile,
    readdir: (state, [path]) => readdir(state, path),
    writeFile: (state, [path, payload]) => writeFile(payload)(state, path),
}
