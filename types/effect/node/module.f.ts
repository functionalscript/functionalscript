import { todo } from "../../../dev/module.f.ts"
import { isVec, type Vec } from "../../bit_vec/module.f.ts"
import type { Result } from "../../result/module.f.ts"
import type { MemOperationMap } from "../mock/module.f.ts"
import { type Do, type Effect, type ToAsyncOperationMap, type Operations, do_ } from "../module.f.ts"

export type IoResult<T> = Result<T, unknown>

// readFile

export type ReadFile = { readonly readFile: readonly [string, IoResult<Vec>] }

export const readFile =
    <O extends ReadFile>(path: string): Do<O, IoResult<Vec>> =>
    do_('readFile', path)

// writeFile

export type WriteFileParam = readonly[string, Vec]

export type WriteFile = { readonly writeFile: readonly [WriteFileParam, IoResult<void>] }

export const writeFile =
    <O extends WriteFile>(...p: WriteFileParam): Do<O, IoResult<void>> =>
    do_('writeFile', p)

// mkdir

export type MakeDirectoryOptions = { readonly recursive: true }

export type MkdirParam = readonly[string, MakeDirectoryOptions?]

export type Mkdir = { readonly mkdir: readonly [MkdirParam, IoResult<void>] }

export const mkdir =
    <O extends Mkdir>(...p: MkdirParam): Do<O, IoResult<void>> =>
    do_('mkdir', p)

// Fs

export type Fs = Mkdir & ReadFile & WriteFile

// Console

export type Console = { readonly log: readonly [string, void] }

export const log =
    <O extends Console>(msg: string): Do<O, void> =>
    do_('log', msg)

// Node

export type NodeOperations =
    & Console
    & Fs

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>

// Virtual

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

const virtualMkdir = (recursive: boolean) => operation((dir, path): readonly[VirtualDir, IoResult<void>] => {
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
    return [dir, ['ok', undefined]]
})

export const virtual: MemOperationMap<NodeOperations, VirtualState> = {
    log: (state, payload) => [{ ...state, stdout: `${state.stdout}${payload}\n` }, undefined],
    mkdir: (state, [path, p]) => virtualMkdir(p !== undefined)(state, path),
    readFile: (state, payload) => todo(),
    writeFile: (state, payload) => todo(),
}
