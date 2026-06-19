/**
 * Virtual Node-effect operations for filesystem and process tests.
 *
 * @module
 */
import { todo } from '../../../asserts/module.f.ts'
import { join, parse } from '../../../path/module.f.ts'
import { utf8ToString } from '../../../text/module.f.ts'
import { isVec, length, maxLengthBytes, msb, vec, type Vec } from '../../../types/bit_vec/module.f.ts'
import { error, ok } from '../../../types/result/module.f.ts'
import { run, type MemOperationMap, type RunInstance } from '../../mock/module.f.ts'
import { asBase, asNominal, type Key } from '../../memory/module.f.ts'
import type { Dirent, IoResult, Module, NodeOp, SandboxResult } from '../module.f.ts'

/**
 * In-memory JS module entry. When `import_` is called on the path, the
 * function is invoked and its return value is the module value (with a
 * `default` export and optional named exports). Using a function (not a
 * plain value) lets the entry be distinguished from `Vec`/`Dir` at runtime
 * via `typeof === 'function'`, and lets the fixture compute the module on
 * each import for closures/state.
 */
export type JsModule = () => Module

export type Entity = Vec | Dir | JsModule

export type Dir = {
    readonly[name in string]?: Entity
}

export type State = {
    stdout: string
    stderr: string
    /** Remaining stdin bytes; each `read` pops the first, `null` at EOF. */
    stdin: readonly number[]
    root: Dir
    internet: {
        readonly[url: string]: Vec
    }
    epochNs: number
    memoryNext: number
    memoryValues: { readonly [key: string]: unknown }
    /** Monotonically increasing counter returned by `randomInt`; starts at 0. */
    randomNext: number
}

export const emptyState: State = {
    stdout: '',
    stderr: '',
    stdin: [],
    root: {},
    internet: {},
    epochNs: 0,
    memoryNext: 0,
    memoryValues: {},
    randomNext: 0,
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
        if (typeof subDir !== 'object') {
            return op(dir, path)
        }
        const [newSubDir, r] = f(subDir, rest)
        return [{ ...dir, [first]: newSubDir }, r]
    }
    return (path: string) => (state: State) => {
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

/** Absent-path error mirroring Node's `ENOENT`, so `isNotFound` recognizes it. */
const enoent = error({ code: 'ENOENT' })

const readFile = readOperation((dir, path): IoResult<Vec> => {
    if (path.length !== 1) { return enoent }
    const file = dir[path[0]]
    if (typeof file === 'function') { throw new Error(`'${path[0]}' is a JsModule; readFile not supported`) }
    if (file === undefined) { return enoent }
    // exists but is a directory — a real error, not a missing path
    if (!isVec(file)) { return error(`'${path[0]}' is not a file`) }
    return ok(file)
})

const import_ = readOperation((dir, path): IoResult<Module> => {
    if (path.length !== 1) { return error('no such file') }
    const entry = dir[path[0]]
    if (typeof entry !== 'function') { return error(`'${path[0]}' is not a JsModule`) }
    return ok(entry())
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
            const isFile = typeof content !== 'object'
            result = [...result, { name, parentPath, isFile }]
            if (!isFile && recursive) {
                result = [...result, ...f(join(parentPath, name), content as Dir)]
            }
        }
        return result
    }
    return ok(f(base, dir))
})

const access = readOperation((dir, path): IoResult<void> => {
    if (path.length === 0) { return okVoid }
    if (path.length !== 1) { return enoent }
    return dir[path[0]] !== undefined ? okVoid : enoent
})

const rm = operation((dir, path): readonly[Dir, IoResult<void>] => {
    if (path.length !== 1) { return [dir, error('invalid path')] }
    const [name] = path
    const entry = dir[name]
    if (entry === undefined) { return [dir, error('no such file')] }
    if (typeof entry === 'object') { return [dir, error('is a directory')] }
    const { [name]: _, ...rest } = dir
    return [rest as Dir, okVoid]
})

const extractEntity = (dir: Dir, path: readonly string[]): readonly[Dir, IoResult<Entity>] => {
    if (path.length === 0) { return [dir, error('cannot extract root')] }
    if (path.length === 1) {
        const [name] = path
        const entry = dir[name]
        if (entry === undefined) { return [dir, enoent] }
        const { [name]: _, ...rest } = dir
        return [rest as Dir, ok(entry)]
    }
    const [first, ...rest] = path
    const sub = dir[first]
    if (sub === undefined || isVec(sub) || typeof sub === 'function') { return [dir, enoent] }
    const [newSub, result] = extractEntity(sub, rest)
    if (result[0] === 'error') { return [dir, result] }
    return [{ ...dir, [first]: newSub }, result]
}

const insertEntityAt = (dir: Dir, path: readonly string[], entity: Entity): readonly[Dir, IoResult<void>] => {
    if (path.length === 0) { return [dir, error('cannot insert at root')] }
    if (path.length === 1) {
        const [name] = path
        const existing = dir[name]
        if (existing !== undefined) {
            const entityIsDir = typeof entity === 'object'
            const existingIsDir = typeof existing === 'object'
            if (entityIsDir && !existingIsDir) {
                return [dir, error(`cannot overwrite file '${name}' with a directory`)]
            }
            if (!entityIsDir && existingIsDir) {
                return [dir, error(`'${name}' is a directory`)]
            }
            if (entityIsDir && existingIsDir) {
                const existingDir = existing as Dir
                const hasContent = Object.values(existingDir).some(v => v !== undefined)
                if (hasContent) {
                    return [dir, error(`cannot overwrite non-empty directory '${name}'`)]
                }
            }
        }
        return [{ ...dir, [name]: entity }, okVoid]
    }
    const [first, ...rest] = path
    const sub = dir[first]
    if (sub === undefined) { return [dir, enoent] }
    if (isVec(sub) || typeof sub === 'function') { return [dir, error('not a directory')] }
    const [newSub, result] = insertEntityAt(sub as Dir, rest, entity)
    if (result[0] === 'error') { return [dir, result] }
    return [{ ...dir, [first]: newSub }, result]
}

const isProperPrefix = (prefix: readonly string[], path: readonly string[]): boolean =>
    prefix.length < path.length && prefix.every((seg, i) => seg === path[i])

const rename = (src: string, dst: string) => (state: State): readonly[State, IoResult<void>] => {
    const srcParsed = parse(src)
    const dstParsed = parse(dst)
    // extract source first to report ENOENT if it's missing, before checking subtree guards
    const [srcRoot, srcResult] = extractEntity(state.root, srcParsed)
    if (srcResult[0] === 'error') { return [state, srcResult] }
    // now that source exists, reject if dst is strictly inside src's subtree (rename into own descendant)
    // or if src is strictly inside dst's subtree (rename onto own ancestor)
    if (isProperPrefix(srcParsed, dstParsed) || isProperPrefix(dstParsed, srcParsed)) {
        return [state, error('cannot rename a directory into its own subtree or onto an ancestor')]
    }
    const [dstRoot, dstResult] = insertEntityAt(srcRoot, dstParsed, srcResult[1])
    if (dstResult[0] === 'error') { return [state, dstResult] }
    return [{ ...state, root: dstRoot }, okVoid]
}

const readBytesOp = (path: string, offset: number, size: number) => readOperation((dir, p): IoResult<Vec> => {
    if (p.length !== 1) { return enoent }
    const file = dir[p[0]]
    if (typeof file === 'function') { throw new Error(`'${p[0]}' is a JsModule; readBytes not supported`) }
    if (file === undefined) { return enoent }
    if (!isVec(file)) { return error(`'${p[0]}' is not a file`) }
    if (offset < 0) { return error(`Offset ${offset} is negative`) }
    if (size < 0) { return error(`Chunk size ${size} is negative`) }
    if (BigInt(size) > maxLengthBytes) { return error(`Chunk size ${size} exceeds maximum allowed size of ${maxLengthBytes} bytes`) }
    const offsetBits = BigInt(offset) * 8n
    const sizeBits = BigInt(size) * 8n
    const remaining = msb.removeFront(offsetBits)(file)
    const actualSizeBits = sizeBits < length(remaining) ? sizeBits : length(remaining)
    return ok(vec(actualSizeBits)(msb.front(actualSizeBits)(remaining)))
})(path)

const map: MemOperationMap<NodeOp, State> = {
    all: (...a) => state => {
        let e: readonly unknown[] = []
        for (const i of a) {
            const [ns, ei] = virtual(state)(i)
            state = ns
            e = [...e, ei]
        }
        return [state, e]
    },
    memCreate: value => state => {
        const id = `mem${state.memoryNext}`
        const key: Key<unknown> = asNominal(id)
        return [{
            ...state,
            memoryNext: state.memoryNext + 1,
            memoryValues: { ...state.memoryValues, [id]: value },
        }, key]
    },
    memRead: key => state =>
        [state, state.memoryValues[asBase(key)]],
    memWrite: (key, value) => state => {
        const id = asBase(key)
        return [{
            ...state,
            memoryValues: { ...state.memoryValues, [id]: value },
        }, undefined]
    },
    fetch: url => state => {
        const result = state.internet[url]
        return result === undefined ? [state, error('not found')] : [state, ok(result)]
    },
    mkdir: (path, p) => mkdir(p !== undefined)(path),
    readFile,
    readdir: (path, { recursive }) => readdir(path, recursive === true)(path),
    writeFile: (path, payload) => writeFile(payload)(path),
    access,
    import: import_,
    rm,
    rename,
    readBytes: readBytesOp,
    randomInt: () => state => [{ ...state, randomNext: state.randomNext + 1 }, state.randomNext],
    exec: todo,
    createServer: todo,
    listen: todo,
    forever: todo,
    now: () => state => [state, state.epochNs],
    // Virtual sandbox is a pass-through: the fixture's test function is
    // expected to return a `SandboxResult` directly (encoding pass/fail and a
    // chosen duration), so the handler invokes it without try/catch or clock
    // reads. This makes test outcomes deterministic — fixtures dictate the
    // result instead of the runner measuring real execution. A genuine
    // exception in a fixture propagates loudly as a bug in the fixture.
    // See: issues/156-tf-virtual-tests.md
    sandbox: f => state => [state, f() as SandboxResult<unknown>],
    await: p => state => [state, [p]],
    test: todo,
    write: (stream, data) => state => {
        const s = utf8ToString(data)
        return [{ ...state, [stream]: `${state[stream]}${s}` }, undefined] as const
    },
    read: () => state => {
        const [first, ...rest] = state.stdin
        return state.stdin.length === 0
            ? [state, null]
            : [{ ...state, stdin: rest }, first]
    },
}

export const virtual: RunInstance<NodeOp, State> = run(map)
