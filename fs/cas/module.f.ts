/**
 * Content-addressable storage utilities for hashing, addressing, and path parsing.
 *
 * @module
 */
import { computeSync, sha256, type Sha2, type State as Sha2State } from '../crypto/sha2/module.f.ts'
import { join, normalize, parse } from '../path/module.f.ts'
import { empty, length, maxLengthBytes, msb, vec, type Vec } from '../types/bit_vec/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../cbase32/module.f.ts'
import { foldStep, forEachStep, pure, type Effect, type Operation } from '../effects/module.f.ts'
import { access, errorExit, isNotFound, log, mkdir, randomInt, readBytes, readdir, readFile, rename, writeFile, type Access, type All, type Await, type Exec, type Fs, type IoResult, type Mkdir, type NodeEffect, type NodeOp, type NodeProgramOptions, type RandomInt, type Read, type ReadBytes, type Readdir, type ReadFile, type Rename, type Rm, type Write, type WriteFile } from '../effects/node/module.f.ts'
import { dispatch, type Commands } from '../cli/module.f.ts'
import { casMcpServer } from './mcp/module.f.ts'
import { toOption } from '../types/nullable/module.f.ts'
import { error, ok, unwrap } from '../types/result/module.f.ts'
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
export const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split2(s)
    const [b, c] = split2(bc)
    return join(prefix, a, b, c)
}

export type FileKvStoreOperation = ReadFile | Mkdir | WriteFile | Access | Readdir

/**
 * Creates a filesystem-backed key/value store under the provided root path.
 */
export const fileKvStore = (path: string): KvStore<FileKvStoreOperation> => {
    const storePrefix = join(path, prefix)
    const normalizedStorePrefix = normalize(storePrefix)
    return {
        // TODO: extend the interface with `Result<Vec, unknown>` instead of `Vec|undefined`.
        read: (key: Vec): Effect<FileKvStoreOperation, Vec|undefined> =>
            readFile(join(path, toPath(key))).step(([t, v]) =>
                pure(t === 'ok' ? v : undefined)
            ),
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
            access(storePrefix).step(a => {
                if (a[0] === 'error') {
                    if (isNotFound(a[1])) { return pure([] as readonly Vec[]) }
                    throw a[1]
                }
                return readdir(storePrefix, { recursive: true })
                    .step(r => pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
                        toOption(isFile
                            ? cBase32ToVec(normalize(parentPath).substring(normalizedStorePrefix.length).replaceAll('/', '') + name)
                            : null))))
            }),
    }
}

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

/** Maximum chunk size for streaming reads: the largest `Vec` the runtime allows. */
const CHUNK_BYTES = Number(maxLengthBytes)

/** 256-bit random `Vec` built from 8 sequential `randomInt` (32-bit) calls. */
const random256: Effect<RandomInt, Vec> =
    foldStep((_: number) => (acc: Vec): Effect<RandomInt, Vec> =>
        randomInt().step(r => pure(msb.concat(acc)(vec(32n)(BigInt(r)))))
    )(empty)([0, 1, 2, 3, 4, 5, 6, 7])

/**
 * Streams a file in `CHUNK_BYTES` chunks, feeding each into the SHA-2 state,
 * and returns the final hash without loading the whole file into memory.
 */
const streamHash = (sha2: Sha2) => (path: string): Effect<ReadBytes, IoResult<Vec>> => {
    const chunkBits = BigInt(CHUNK_BYTES) * 8n
    const loop = (state: Sha2State, offset: number): Effect<ReadBytes, IoResult<Vec>> =>
        readBytes(path, offset, CHUNK_BYTES).step(result => {
            if (result[0] === 'error') { return pure(error(result[1])) }
            const chunk = result[1]
            const newState = sha2.append(chunk)(state)
            if (length(chunk) < chunkBits) {
                return pure(ok(sha2.end(newState)))
            }
            return loop(newState, offset + CHUNK_BYTES)
        })
    return loop(sha2.init, 0)
}

/**
 * Move-hash-move upload pipeline: moves `fileName` from `~/cas_upload/` to a
 * random staging path, stream-hashes it, then renames it to its final CAS shard
 * path. Returns `ok(hash)` on success or `error(reason)` on any I/O failure.
 */
export const casUpload = (home: string) => (fileName: string): Effect<Mkdir | Rename | RandomInt | ReadBytes, IoResult<Vec>> => {
    const src = join(home, 'cas_upload', fileName)
    const stageDir = join(home, prefix, '.stage')
    return random256.step(rnd => {
        const rndStr = vecToCBase32(rnd)
        const stagePath = join(stageDir, `${rndStr}-${fileName}`)
        return mkdir(stageDir, { recursive: true })
            .step(() => rename(src, stagePath))
            .step(r => {
                if (r[0] === 'error') { return pure(error(r[1])) }
                return streamHash(sha256)(stagePath)
                    .step(hashResult => {
                        if (hashResult[0] === 'error') { return pure(hashResult) }
                        const hash = hashResult[1]
                        const p = toPath(hash)
                        const parts = parse(p)
                        const finalDir = join(home, ...parts.slice(0, -1))
                        const finalPath = join(home, p)
                        return mkdir(finalDir, { recursive: true })
                            .step(() => rename(stagePath, finalPath))
                            .step(r2 => pure(r2[0] === 'error' ? error(r2[1]) : ok(hash)))
                    })
            })
    })
}

export const commands: Commands<FileKvStoreOperation | Write | All | MemOp | Read> = [
    {
        names: ['add'],
        description: 'Store file content and print its hash',
        handler: ({ home, args: [path, ...rest] }) => {
            if (path === undefined || rest.length !== 0) {
                return errorExit("'cas add' expects one parameter")
            }
            const c = cas(sha256)(fileKvStore(home))
            return readFile(path)
                .step(v => c.write(unwrap(v)))
                .step(hash => log(vecToCBase32(hash)))
                .step(() => pure(0))
        },
    },
    {
        names: ['get'],
        description: 'Restore content by hash into a file',
        handler: ({ home, args: [hashCBase32, path, ...rest] }) => {
            if (hashCBase32 === undefined || path === undefined || rest.length !== 0) {
                return errorExit("'cas get' expects two parameters")
            }
            const hash = cBase32ToVec(hashCBase32)
            if (hash === null) {
                return errorExit(`invalid hash format: ${hashCBase32}`)
            }
            const c = cas(sha256)(fileKvStore(home))
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
        handler: ({ home }) => {
            const c = cas(sha256)(fileKvStore(home))
            return c.list()
                .step(forEachStep(j => log(vecToCBase32(j))))
                .step(() => pure(0))
        },
    },
]

export const main = dispatch(commands)
