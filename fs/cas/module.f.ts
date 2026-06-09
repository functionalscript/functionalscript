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
import { errorExit, log, mkdir, readdir, readFile, writeFile, type Fs, type NodeEffect, type NodeOp, type NodeProgramOptions } from '../effects/node/module.f.ts'
import { dispatch, type Commands } from '../cli/module.f.ts'
import { toOption } from '../types/nullable/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'

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

const split = (s: string) => [s.substring(0, 2), s.substring(2)]

const prefix = '.cas'

/** Converts a content key to its sharded relative CAS file path. */
const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split(s)
    const [b, c] = split(bc)
    return join(prefix)(join(a)(join(b)(c)))
}

/**
 * Creates a filesystem-backed key/value store under the provided root path.
 */
export const fileKvStore = (path: string): KvStore<Fs> => ({
    read: (key: Vec): Effect<Fs, Vec|undefined> =>
        readFile(toPath(key))
            .step(([status, data]) => pure(status === 'error' ? undefined : data)),
    write: (key: Vec, value: Vec): Effect<Fs, void> => {
        const p = toPath(key)
        const parts = parse(p)
        const dir = join(path)(parts.slice(0, -1).join('/'))
        // TODO: error handling
        return mkdir(dir, { recursive: true })
            .step(() => writeFile(join(path)(p), value))
            .step(() => pure(undefined))
    },
    list: (): Effect<Fs, readonly Vec[]> =>
        // TODO: remove unwrap
        readdir('.cas', { recursive: true })
            .step(r => pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
                toOption(isFile
                    ? cBase32ToVec(parentPath.substring(prefix.length).replaceAll('/', '') + name)
                    : null)))),
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

export const main = (options: NodeProgramOptions): Effect<NodeOp, number> => {
    const c = cas(sha256)(fileKvStore('.'))
    const commands: Commands<NodeOp> = [
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
                        const result: Effect<NodeOp, number> = v === undefined
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
                    .step(forEachStep<NodeOp, Vec>(j => log(vecToCBase32(j))))
                    .step(() => pure(0)),
        },
    ]
    return dispatch(commands)(options)
}
