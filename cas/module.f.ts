/**
 * Content-addressable storage utilities for hashing, addressing, and path parsing.
 *
 * @module
 */
import { computeSync, sha256, type Sha2 } from "../crypto/sha2/module.f.ts"
import { parse } from "../path/module.f.ts"
import type { Vec } from "../types/bit_vec/module.f.ts"
import { cBase32ToVec, vecToCBase32 } from "../types/cbase32/module.f.ts"
import { begin, pure, type Effect, type Operation } from "../types/effects/module.f.ts"
import { error, log, mkdir, readdir, readFile, writeFile, type Fs, type NodeEffect, type NodeOp } from "../types/effects/node/module.f.ts"
import { toOption } from "../types/nullable/module.f.ts"
import { unwrap } from "../types/result/module.f.ts"

export type KvStore<O extends Operation> = {
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Effect<O, void>
    readonly list: () => Effect<O, readonly Vec[]>
}

export type Kv = readonly[Vec, Vec];

const o = { withFileTypes: true } as const

const split = (s: string) => [s.substring(0, 2), s.substring(2)]

const prefix = '.cas'

const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split(s)
    const [b, c] = split(bc)
    return `${prefix}/${a}/${b}/${c}`
}

export const fileKvStore = (path: string): KvStore<Fs> => ({
    read: (key: Vec): Effect<Fs, Vec|undefined> =>
        begin
            .step(() => readFile(toPath(key)))
            .step(([status, data]) => pure(status === 'error' ? undefined : data)),
    write: (key: Vec, value: Vec): Effect<Fs, void> => {
        const p = toPath(key)
        const parts = parse(p)
        const dir = `${path}/${parts.slice(0, -1).join('/')}`
        // TODO: error handling
        return begin
            .step(() => mkdir(dir, { recursive: true }))
            .step(() => writeFile(`${path}/${p}`, value))
            .step(() => pure(undefined))
    },
    list: (): Effect<Fs, readonly Vec[]> =>
        // TODO: remove unwrap
        begin
            .step(() => readdir('.cas', { recursive: true }))
            .step(r => pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
                toOption(isFile
                    ? cBase32ToVec(parentPath.substring(prefix.length).replaceAll('/', '') + name)
                    : null)))),
})

export type Cas<O extends Operation> = {
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    readonly write: (value: Vec) => Effect<O, Vec>
    readonly list: () => Effect<O, readonly Vec[]>
}

export const cas = (sha2: Sha2): <O extends Operation>(_: KvStore<O>) => Cas<O> => {
    const compute = computeSync(sha2)
    return ({ read, write, list }) => ({
        read,
        write: (value: Vec) => {
            const hash = compute([value])
            return begin
                .step(() => write(hash, value))
                .step(() => pure(hash))
        },
        list,
    })
}

const e = (s: string): Effect<NodeOp, number> =>
    begin
        .step(() => error(s))
        .step(() => pure(1))

export const main = (args: readonly string[]): Effect<NodeOp, number> => {
    const c = cas(sha256)(fileKvStore('.'))
    const [cmd, ...options] = args
    switch (cmd) {
        case 'add': {
            if (options.length !== 1) {
                return e("'cas add' expects one parameter")
            }
            const [path] = options
            return begin
                .step(() => readFile(path))
                .step(v => c.write(unwrap(v)))
                .step(hash => log(vecToCBase32(hash)))
                .step(() => pure(0))
        }
        case 'get': {
            if (options.length !== 2) {
                return e("'cas get' expects two parameters")
            }
            const [hashCBase32, path] = options
            const hash = cBase32ToVec(hashCBase32)
            if (hash === null) {
                return e(`invalid hash format: ${hashCBase32}`)
            }
            return begin
                .step(() => c.read(hash))
                .step(v => {
                    const result: NodeEffect<number> = v === undefined
                        ? e(`no such hash: ${hashCBase32}`)
                        : begin
                            .step(() => writeFile(path, v))
                            .step(() => pure(0))
                    return result
                })
        }
        case 'list': {
            return begin
                .step(() => c.list())
                .step(v => {
                    // TODO: make it lazy.
                    let i: Effect<NodeOp, void> = begin
                    for (const j of v) {
                        const prev: Effect<NodeOp, void> = i
                        i = begin
                            .step(() => prev)
                            .step(() => log(vecToCBase32(j)))
                    }
                    return i
                })
                .step(() => pure(0))
        }
        case undefined: {
            return e('Error: CAS command requires subcommand')
        }
        default:
            return e(`Error: Unknown CAS subcommand "${args[0]}"`)
    }
}
