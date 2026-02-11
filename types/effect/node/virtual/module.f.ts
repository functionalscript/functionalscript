import { isVec, type Vec } from "../../../bit_vec/module.f.ts"
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

const okVoid = ['ok', undefined] as const

const mkdir = (recursive: boolean) => operation((dir, path): readonly[VirtualDir, IoResult<void>] => {
    let d = {}
    let i = path.length
    if (i > 1 && !recursive) {
        return [dir, ['error', 'non-recursive']]
    }
    while (i > 0) {
        i -= 1
        d = { [path[i]]: d }
    }
    dir = { ...dir, ...d }
    return [dir, okVoid]
})

const readFileError = ['error', 'no such file'] as const

const readFile = operation((dir, path): readonly[VirtualDir, IoResult<Vec>] => {
    if (path.length !== 1) { return [dir, readFileError] }
    const file = dir[path[0]]
    if (!isVec(file)) { return [dir, readFileError] }
    return [dir, ['ok', file]]
})

const writeFileError = ['error', 'invalid file'] as const

const writeFile = (payload: Vec) => operation((dir, path): readonly[VirtualDir, IoResult<void>] => {
    if (path.length !== 1) { return [dir, writeFileError] }
    const [name] = path
    const file = dir[name]
    // fail if the file is a directory
    if (file !== undefined && !isVec(file)) { return [dir, writeFileError] }
    dir = { ...dir, [name]: payload }
    return [dir, okVoid]
})

export const virtual: MemOperationMap<NodeOperations, VirtualState> = {
    log: (state, payload) => [{ ...state, stdout: `${state.stdout}${payload}\n` }, undefined],
    mkdir: (state, [path, p]) => mkdir(p !== undefined)(state, path),
    readFile,
    writeFile: (state, [path, payload]) => writeFile(payload)(state, path),
}
