/**
 * Virtual Node-effect operations for filesystem and process tests.
 *
 * @module
 *
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../mock/types.ts'
 * @import { Dirent, FileStat, IoError, IoResult, Module, NodeOp, NodeProgramOptions, SandboxResult } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Error } from '../../../types/result/types.ts'
 * @import { Dir, State, _Entity } from './types.ts'
 */

import { assert, todo } from '../../../asserts/module.f.mjs'
import { isProperPrefix, join, parse } from '../../../path/module.f.mjs'
import { utf8ToString } from '../../../text/module.f.mjs'
import { empty, length, maxLengthBytes, msb, vec } from '../../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'
import { ioError, nodeCommands } from '../module.f.mjs'
import { partialRun } from '../../mock/module.f.mjs'
import { asBase, asNominal } from '../../memory/module.f.mjs'

/** @type {State} */
export const emptyState = {
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

/**
 * @template T
 * @param {(dir: Dir, path: readonly string[]) => readonly [Dir, T]} op
 * @returns {(path: string) => (state: State) => readonly [State, T]}
 */
const operation = op => {
    /** @type {(dir: Dir, path: readonly string[]) => readonly [Dir, T]} */
    const f = (dir, path) => {
        if (path.length === 0) {
            return op(dir, path)
        }
        const [first, ...rest] = path
        const subDir = dir[first]
        // `instanceof Array`, not `Array.isArray`: the latter narrows to `any[]`,
        // which `readonly Vec[]` is not assignable to, so its negative branch never
        // removes a `readonly` array from `_Entity`. Only `instanceof` narrows here.
        if (typeof subDir !== 'object' || subDir instanceof Array) {
            return op(dir, path)
        }
        const [newSubDir, r] = f(subDir, rest)
        return [{ ...dir, [first]: newSubDir }, r]
    }
    return path => state => {
        const [root, result] = f(state.root, parse(path))
        return [{ ...state, root }, result]
    }
}

/**
 * @template T
 * @param {(dir: Dir, path: readonly string[]) => T} op
 * @returns {(path: string) => (state: State) => readonly [State, T]}
 */
const readOperation = op => operation((dir, path) => [dir, op(dir, path)])

const okVoid = ok(undefined)

/**
 * A virtual host failure. The virtual runner reports the same normalized
 * {@link IoError} the Node runner does, so a program cannot tell the two apart
 * by the shape of what it catches — which is what makes a proof against the
 * virtual filesystem evidence about the real one.
 *
 * @type {(message: string) => Error<IoError>}
 */
const fail = message => error(ioError({ message }))

/** @type {(recursive: boolean) => (dir: Dir, path: readonly string[]) => readonly [Dir, IoResult<void>]} */
const mkdirOp = recursive => (dir, path) => {
    let d = {}
    let i = path.length
    if (i > 1 && !recursive) {
        return [dir, fail('non-recursive')]
    }
    while (i > 0) {
        i -= 1
        d = { [path[i]]: d }
    }
    dir = { ...dir, ...d }
    return [dir, okVoid]
}

/** @type {(recursive: boolean) => (path: string) => (state: State) => readonly [State, IoResult<void>]} */
const mkdir = recursive => operation(mkdirOp(recursive))

/** Absent-path error mirroring Node's `ENOENT`, so `isNotFound` recognizes it. */
const enoent = error(ioError({ code: 'ENOENT', message: 'no such file or directory' }))

/** @type {(path: string) => (state: State) => readonly [State, IoResult<Vec>]} */
const readFile = readOperation((dir, path) => {
    if (path.length !== 1) { return enoent }
    const file = dir[path[0]]
    if (typeof file === 'function') { throw new Error(`'${path[0]}' is a JsModule; readFile not supported`) }
    if (file === undefined) { return enoent }
    // `operation`'s wrapper descends into every plain-object (`Dir`) entry
    // before this op ever runs, and the `JsModule` case already threw above,
    // so `file` here is always a `Vec[]` — never a bare `Dir`.
    assert(Array.isArray(file), `'${path[0]}' is not a file`)
    const chunks = file
    const capBits = maxLengthBytes * 8n
    let result = empty
    for (const chunk of chunks) {
        const chunkLen = length(chunk)
        if (chunkLen === 0n) { continue }
        if (length(result) + chunkLen > capBits) {
            return fail(`File size exceeds maximum allowed size of ${maxLengthBytes} bytes`)
        }
        result = msb.concat(result)(chunk)
    }
    return ok(result)
})

/** @type {(path: string) => (state: State) => readonly [State, IoResult<Module>]} */
const import_ = readOperation((dir, path) => {
    if (path.length !== 1) { return fail('no such file') }
    const entry = dir[path[0]]
    if (typeof entry !== 'function') { return fail(`'${path[0]}' is not a JsModule`) }
    return ok(entry())
})

const writeFileError = fail('invalid file')

/** @type {(payload: Vec) => (dir: Dir, path: readonly string[]) => readonly [Dir, IoResult<void>]} */
const writeFileOp = payload => (dir, path) => {
    if (path.length !== 1) { return [dir, writeFileError] }
    const [name] = path
    const file = dir[name]
    if (file !== undefined && !Array.isArray(file)) { return [dir, writeFileError] }
    dir = { ...dir, [name]: [payload] }
    return [dir, okVoid]
}

/** @type {(payload: Vec) => (path: string) => (state: State) => readonly [State, IoResult<void>]} */
const writeFile = payload => operation(writeFileOp(payload))

const invalidPath = fail('invalid path')

const { entries } = Object

/** @type {(base: string, recursive: boolean) => (path: string) => (state: State) => readonly [State, IoResult<readonly Dirent[]>]} */
const readdir = (base, recursive) => readOperation((dir, path) => {
    if (path.length !== 0) { return invalidPath }
    /** @type {(parentPath: string, d: Dir) => readonly Dirent[]} */
    const f = (parentPath, d) => {
        /** @type {readonly Dirent[]} */
        let result = []
        for (const [name, content] of entries(d)) {
            if (content === undefined) { continue }
            const isFile = content instanceof Array || typeof content !== 'object'
            result = [...result, { name, parentPath, isFile }]
            if (!isFile && recursive) {
                result = [...result, ...f(join(parentPath, name), content)]
            }
        }
        return result
    }
    return ok(f(base, dir))
})

/** @type {(path: string) => (state: State) => readonly [State, IoResult<void>]} */
const access = readOperation((dir, path) => {
    if (path.length === 0) { return okVoid }
    if (path.length !== 1) { return enoent }
    return dir[path[0]] !== undefined ? okVoid : enoent
})

/** @type {(dir: Dir, path: readonly string[]) => readonly [Dir, IoResult<void>]} */
const rmOp = (dir, path) => {
    if (path.length !== 1) { return [dir, fail('invalid path')] }
    const [name] = path
    const entry = dir[name]
    if (entry === undefined) { return [dir, fail('no such file')] }
    // No "is a directory" guard here: `operation`'s wrapper descends into
    // every plain-object (`Dir`) entry before this op ever runs, so `entry`
    // is always a `Vec[]` or a `JsModule` — never a bare `Dir` — and rm can
    // always proceed. (`rm` on a genuinely non-empty directory instead hits
    // `path.length !== 1` above, once the wrapper has descended into it.)
    const { [name]: _, ...rest } = dir
    return [rest, okVoid]
}

/** @type {(path: string) => (state: State) => readonly [State, IoResult<void>]} */
const rm = operation(rmOp)

/** @type {(dir: Dir, path: readonly string[]) => readonly [Dir, IoResult<_Entity>]} */
const extractEntity = (dir, path) => {
    if (path.length === 0) { return [dir, fail('cannot extract root')] }
    if (path.length === 1) {
        const [name] = path
        const entry = dir[name]
        if (entry === undefined) { return [dir, enoent] }
        const { [name]: _, ...rest } = dir
        return [rest, ok(entry)]
    }
    const [first, ...rest] = path
    const sub = dir[first]
    if (sub === undefined || sub instanceof Array || typeof sub === 'function') { return [dir, enoent] }
    const [newSub, result] = extractEntity(sub, rest)
    if (result[0] === 'error') { return [dir, result] }
    return [{ ...dir, [first]: newSub }, result]
}

/** @type {(dir: Dir, path: readonly string[], entity: _Entity) => readonly [Dir, IoResult<void>]} */
const insertEntityAt = (dir, path, entity) => {
    // `insertEntityAt`'s only external caller, `rename`, always rejects an
    // empty `dst` earlier — `isProperPrefix([], srcParsed)` is true whenever
    // `srcParsed` is non-empty, so renaming onto root is already caught as
    // "onto an ancestor" before this function runs. The recursive self-calls
    // below never pass an empty path either (they only recurse when
    // `path.length > 1`, with a non-empty remainder).
    assert(path.length > 0, 'cannot insert at root')
    if (path.length === 1) {
        const [name] = path
        const existing = dir[name]
        if (existing !== undefined) {
            const entityIsDir = !Array.isArray(entity) && typeof entity === 'object'
            const existingIsDir = !Array.isArray(existing) && typeof existing === 'object'
            if (entityIsDir && !existingIsDir) {
                return [dir, fail(`cannot overwrite file '${name}' with a directory`)]
            }
            if (!entityIsDir && existingIsDir) {
                return [dir, fail(`'${name}' is a directory`)]
            }
            if (entityIsDir && existingIsDir) {
                const existingDir = existing
                const hasContent = Object.values(existingDir).some(v => v !== undefined)
                if (hasContent) {
                    return [dir, fail(`cannot overwrite non-empty directory '${name}'`)]
                }
            }
        }
        return [{ ...dir, [name]: entity }, okVoid]
    }
    const [first, ...rest] = path
    const sub = dir[first]
    if (sub === undefined) { return [dir, enoent] }
    if (sub instanceof Array || typeof sub === 'function') { return [dir, fail('not a directory')] }
    const [newSub, result] = insertEntityAt(sub, rest, entity)
    if (result[0] === 'error') { return [dir, result] }
    return [{ ...dir, [first]: newSub }, result]
}

/** @type {(src: string, dst: string) => (state: State) => readonly [State, IoResult<void>]} */
const rename = (src, dst) => state => {
    const srcParsed = parse(src)
    const dstParsed = parse(dst)
    // extract source first to report ENOENT if it's missing, before checking subtree guards
    const [srcRoot, srcResult] = extractEntity(state.root, srcParsed)
    if (srcResult[0] === 'error') { return [state, srcResult] }
    // now that source exists, reject if dst is strictly inside src's subtree (rename into own descendant)
    // or if src is strictly inside dst's subtree (rename onto own ancestor)
    if (isProperPrefix(srcParsed, dstParsed) || isProperPrefix(dstParsed, srcParsed)) {
        return [state, fail('cannot rename a directory into its own subtree or onto an ancestor')]
    }
    const [dstRoot, dstResult] = insertEntityAt(srcRoot, dstParsed, srcResult[1])
    if (dstResult[0] === 'error') { return [state, dstResult] }
    return [{ ...state, root: dstRoot }, okVoid]
}

/** @type {(path: string, offset: number, size: number) => (state: State) => readonly [State, IoResult<Vec>]} */
const readBytesOp = (path, offset, size) => readOperation((dir, p) => {
    if (p.length !== 1) { return enoent }
    const file = dir[p[0]]
    if (typeof file === 'function') { throw new Error(`'${p[0]}' is a JsModule; readBytes not supported`) }
    if (file === undefined) { return enoent }
    // `operation`'s wrapper descends into every plain-object (`Dir`) entry
    // before this op ever runs, and the `JsModule` case already threw above,
    // so `file` here is always a `Vec[]` — never a bare `Dir`.
    assert(Array.isArray(file), `'${p[0]}' is not a file`)
    if (!Number.isInteger(offset)) { return fail(`Offset ${offset} is not an integer`) }
    if (!Number.isInteger(size)) { return fail(`Chunk size ${size} is not an integer`) }
    if (offset < 0) { return fail(`Offset ${offset} is negative`) }
    if (size < 0) { return fail(`Chunk size ${size} is negative`) }
    if (BigInt(size) > maxLengthBytes) { return fail(`Chunk size ${size} exceeds maximum allowed size of ${maxLengthBytes} bytes`) }
    const chunks = file
    let toSkip = BigInt(offset) * 8n
    let toRead = BigInt(size) * 8n
    let result = empty
    for (const chunk of chunks) {
        if (toRead === 0n) { break }
        const chunkBits = length(chunk)
        if (toSkip >= chunkBits) { toSkip -= chunkBits; continue }
        const skipInChunk = toSkip
        const availableBits = chunkBits - skipInChunk
        const takeBits = availableBits <= toRead ? availableBits : toRead
        const taken = vec(takeBits)(msb.front(takeBits)(msb.removeFront(skipInChunk)(chunk)))
        result = msb.concat(result)(taken)
        toSkip = 0n
        toRead -= takeBits
    }
    return ok(result)
})(path)

/** Total byte size of a chunk-list file (each chunk is byte-aligned).
 *
 * @type {(chunks: readonly Vec[]) => number}
 */
const fileSizeBytes = chunks =>
    chunks.reduce((acc, c) => acc + Number(length(c) / 8n), 0)

/** Absent-path error for an already-existing exclusive create, mirroring `EEXIST`. */
const eexist = error(ioError({ code: 'EEXIST', message: 'file already exists' }))

/** @type {(dir: Dir, path: readonly string[]) => readonly [Dir, IoResult<void>]} */
const createExclusiveOp = (dir, path) => {
    if (path.length !== 1) { return [dir, invalidPath] }
    const [name] = path
    // O_EXCL: fail if the name is already taken; otherwise create an empty file.
    if (dir[name] !== undefined) { return [dir, eexist] }
    return [{ ...dir, [name]: [] }, okVoid]
}

/** @type {(path: string) => (state: State) => readonly [State, IoResult<void>]} */
const createExclusive = operation(createExclusiveOp)

// The lock-free upload only ever writes sequentially at the current end of the
// staging file (`offset === size`), so the virtual model implements that append
// case exactly: it never creates (a missing file is `ENOENT`), never overwrites
// existing bytes, and never leaves a hole — matching the effect's contract for
// the one access pattern its callers use.
/** @type {(offset: number, data: Vec) => (dir: Dir, p: readonly string[]) => readonly [Dir, IoResult<void>]} */
const writeBytesRawOp = (offset, data) => (dir, p) => {
    if (p.length !== 1) { return [dir, enoent] }
    const [name] = p
    const file = dir[name]
    if (file === undefined) { return [dir, enoent] }              // writeBytes never creates
    if (!Array.isArray(file)) { return [dir, fail(`'${name}' is not a file`)] }
    if (!Number.isInteger(offset) || offset < 0) { return [dir, fail(`Offset ${offset} is invalid`)] }
    const chunks = file
    if (offset !== fileSizeBytes(chunks)) {
        return [dir, fail(`writeBytes offset ${offset} must equal the file size (append-only)`)]
    }
    return [{ ...dir, [name]: [...chunks, data] }, okVoid]
}

/** @type {(path: string, offset: number, data: Vec) => (state: State) => readonly [State, IoResult<void>]} */
const writeBytesOp = (path, offset, data) => operation(writeBytesRawOp(offset, data))(path)

/** @type {(path: string) => (state: State) => readonly [State, IoResult<FileStat>]} */
const statOp = readOperation((dir, path) => {
    if (path.length !== 1) { return enoent }
    const file = dir[path[0]]
    if (file === undefined) { return enoent }
    if (!Array.isArray(file)) { return fail(`'${path[0]}' is not a file`) }
    return ok({ size: fileSizeBytes(file) })
})

/** @type {PartialMemOperationMap<NodeOp, State>} */
const map = {
    all: (...a) => state => {
        // Each entry is the effect's whole `Result`: `all`'s own envelope says
        // only whether the runner could dispatch it, so the inner answers pass
        // through untouched for `allOk` to collapse.
        /** @type {readonly Result<unknown, unknown>[]} */
        let e = []
        for (const i of a) {
            const [ns, ei] = virtual(state)(i)
            state = ns
            e = [...e, ei]
        }
        return [state, ok(e)]
    },
    memCreate: value => state => {
        const id = `mem${state.memoryNext}`
        const key = asNominal(id)
        return [{
            ...state,
            memoryNext: state.memoryNext + 1,
            memoryValues: { ...state.memoryValues, [id]: value },
        }, ok(key)]
    },
    memRead: key => state =>
        [state, ok(state.memoryValues[asBase(key)])],
    memWrite: (key, value) => state => {
        const id = asBase(key)
        return [{
            ...state,
            memoryValues: { ...state.memoryValues, [id]: value },
        }, okVoid]
    },
    fetch: url => state => {
        const result = state.internet[url]
        return result === undefined ? [state, fail('not found')] : [state, ok(result)]
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
    createExclusive,
    writeBytes: writeBytesOp,
    stat: statOp,
    randomInt: () => state => [{ ...state, randomNext: state.randomNext + 1 }, ok(state.randomNext)],
    now: () => state => [state, ok(state.epochNs)],
    // Virtual sandbox is a pass-through: the fixture's test function is
    // expected to return a `SandboxResult` directly (encoding pass/fail and a
    // chosen duration), so the handler invokes it without try/catch or clock
    // reads. This makes test outcomes deterministic — fixtures dictate the
    // result instead of the runner measuring real execution. A genuine
    // exception in a fixture propagates loudly as a bug in the fixture.
    // See: issues/156-tf-virtual-tests.md
    sandbox: f => state => [state, ok(/** @type {SandboxResult<unknown>} */ (f()))],
    await: p => state => [state, ok([p])],
    write: (stream, data) => state => {
        const s = utf8ToString(data)
        return [{ ...state, [stream]: `${state[stream]}${s}` }, okVoid]
    },
    read: () => state => {
        const [first, ...rest] = state.stdin
        return state.stdin.length === 0
            ? [state, ok(null)]
            : [{ ...state, stdin: rest }, ok(first)]
    },
}

/**
 * The virtual runner.
 *
 * **It implements part of `NodeOp`, and says so.** `exec`, `createServer`,
 * `listen`, `forever` and `test` have no meaning against an in-memory
 * filesystem, and they used to be present as `todo` handlers — entries that
 * existed only to satisfy a total operation map and threw when reached. They
 * are simply absent now, so a program that asks for one gets
 * `error(notImplemented)` back through its own continuation and decides what an
 * incompatible runner means for it, which is what `NotImplemented` was
 * introduced for. A command that is not a `NodeOp` at all still panics.
 *
 * @type {RunInstance<NodeOp, State>}
 */
export const virtual = partialRun(nodeCommands)(map)

const testContext = { test: todo }

/**
 * Safe, inert defaults for every {@link NodeProgramOptions} field, intended for
 * proof files that need to call a program without owning the full literal.
 *
 * Proofs spread-override only what their test cares about:
 *
 * ```ts
 * const opts: NodeProgramOptions = { ...defaultNodeProgramOptions, args }
 * ```
 *
 * Future additions to `NodeProgramOptions` only need a default added here,
 * keeping unrelated proof files from churning.
 *
 * @type {NodeProgramOptions}
 */
export const defaultNodeProgramOptions = {
    args: [],
    env: {},
    home: '.',
    std: { stdout: { isTTY: false }, stderr: { isTTY: false } },
    testContext,
    bunTestContext: testContext,
    engine: 'node',
    inlineTestContext: false,
}
