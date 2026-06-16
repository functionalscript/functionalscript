/**
 * Content-addressable storage utilities for hashing, addressing, and path parsing.
 *
 * @module
 */
import { computeSync, sha256, type Sha2 } from '../crypto/sha2/module.f.ts'
import { join, parse } from '../path/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../cbase32/module.f.ts'
import { forEachStep, pure, type Effect, type Operation } from '../effects/module.f.ts'
import { access, errorExit, isNotFound, log, mkdir, readdir, readFile, writeFile, type Access, type All, type Await, type Exec, type Fs, type Mkdir, type NodeEffect, type NodeOp, type NodeProgramOptions, type Read, type Readdir, type ReadFile, type Rm, type Write, type WriteFile } from '../effects/node/module.f.ts'
import { dispatch, type Commands } from '../cli/module.f.ts'
import { casMcpServer } from './mcp/module.f.ts'
import { toOption } from '../types/nullable/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import { splitAt } from '../types/string/module.f.ts'
import type { MemOp } from '../effects/memory/module.f.ts'

export type KvStore<O extends Operation> = {
    /** Reads a value by key; returns `undefined` when the key does not exist. */
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    /** Writes a key/value pair to the underlying storage. */
    readonly write: (key: Vec, value: Vec) => Effect<O, void>
    /** Lists all keys available in the store. */
    readonly list: () => Effect<O, readonly Vec[]>
}

/** A key/value tuple where index `0` is the key and index `1` is the value. */
export type Kv = readonly[Vec, Vec];

const o = { withFileTypes: true } as const

const split2 = splitAt(2)

const prefix = '.cas'

/** Converts a content key to its sharded relative CAS file path. */
const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split2(s)
    const [b, c] = split2(bc)
    return join(prefix, a, b, c)
}

export type FileKvStoreOperation = ReadFile | Mkdir | WriteFile | Access | Readdir

/**
 * Creates a filesystem-backed key/value store under the provided root path.
 */
export const fileKvStore = (path: string): KvStore<FileKvStoreOperation> => ({
    read: (key: Vec): Effect<FileKvStoreOperation, Vec|undefined> =>
        readFile(toPath(key)).step(r => {
            if (r[0] === 'ok') { return pure(r[1]) }
            // A missing file means "no such content"; surface anything else.
            if (isNotFound(r[1])) { return pure(undefined) }
            throw r[1]
        }),
    write: (key: Vec, value: Vec): Effect<FileKvStoreOperation, void> => {
        const p = toPath(key)
        const parts = parse(p)
        const dir = join(path, ...parts.slice(0, -1))
        // TODO: error handling
        return mkdir(dir, { recursive: true })
            .step(() => writeFile(join(path, p), value))
            .step(() => pure(undefined))
    },
    list: (): Effect<FileKvStoreOperation, readonly Vec[]> =>
        // A fresh store has no `.cas` directory yet. Treat *only* that case as an
        // empty store, mirroring how `read` maps a missing file to `undefined`.
        // A `.cas` that exists but cannot be read (permissions, corruption) is a
        // genuine storage error and is surfaced, not masked as "no hashes".
        access('.cas').step(a => {
            if (a[0] === 'error') {
                if (isNotFound(a[1])) { return pure([] as readonly Vec[]) }
                throw a[1]
            }
            return readdir('.cas', { recursive: true })
                .step(r => pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
                    toOption(isFile
                        ? cBase32ToVec(parentPath.substring(prefix.length).replaceAll('/', '') + name)
                        : null))))
        }),
})

export type Cas<O extends Operation> = {
    /** Reads content by hash; returns `undefined` when not found. */
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    /** Stores content and returns its computed hash. */
    readonly write: (value: Vec) => Effect<O, Vec>
    /** Lists all stored content hashes. */
    readonly list: () => Effect<O, readonly Vec[]>
}

/**
 * Builds a content-addressable storage facade from a SHA-2 implementation.
 */
export const cas = (sha2: Sha2): <O extends Operation>(_: KvStore<O>) => Cas<O> => {
    const compute = computeSync(sha2)
    return ({ read, write, list }) => ({
        read,
        write: (value: Vec) => {
            const hash = compute([value])
            return write(hash, value)
                .step(() => pure(hash))
        },
        list,
    })
}

const c = cas(sha256)(fileKvStore('.'))

export const commands: Commands<FileKvStoreOperation | Write | All | MemOp | Read> = [
    {
        names: ['add'],
        description: 'Store file content and print its hash',
        handler: ({ args: [path, ...rest] }) => {
            if (path === undefined || rest.length !== 0) {
                return errorExit("'cas add' expects one parameter")
            }
            return readFile(path)
                .step(v => c.write(unwrap(v)))
                .step(hash => log(vecToCBase32(hash)))
                .step(() => pure(0))
        },
    },
    {
        names: ['get'],
        description: 'Restore content by hash into a file',
        handler: ({ args: [hashCBase32, path, ...rest] }) => {
            if (hashCBase32 === undefined || path === undefined || rest.length !== 0) {
                return errorExit("'cas get' expects two parameters")
            }
            const hash = cBase32ToVec(hashCBase32)
            if (hash === null) {
                return errorExit(`invalid hash format: ${hashCBase32}`)
            }
            return c.read(hash)
                .step(v => {
                    const result: Effect<Write | WriteFile, number> = v === undefined
                        ? errorExit(`no such hash: ${hashCBase32}`)
                        : writeFile(path, v)
                            .step(() => pure(0))
                    return result
                })
        },
    },
    {
        names: ['list'],
        description: 'List all stored content hashes',
        handler: () =>
            c.list()
                .step(forEachStep(j => log(vecToCBase32(j))))
                .step(() => pure(0)),
    },
    {
        names: ['mcp'],
        description: 'Run an MCP server over stdio exposing the CAS as tools',
        handler: () =>
            casMcpServer(c).step(() => pure(0)),
    },
]

export const main = dispatch(commands)
