import { computeSync, sha256, type Sha2 } from "../crypto/sha2/module.f.ts"
import { parse } from "../path/module.f.ts"
import type { Vec } from "../types/bit_vec/module.f.ts"
import { cBase32ToVec, vecToCBase32 } from "../types/cbase32/module.f.ts"
import { pure, type Effect, type Operations } from "../types/effect/module.f.ts"
import { error, log, mkdir, readdir, readFile, writeFile, type Fs, type NodeEffect, type NodeOperations } from "../types/effect/node/module.f.ts"
import { toOption } from "../types/nullable/module.f.ts"
import { unwrap } from "../types/result/module.f.ts"

export type KvStore<O extends Operations> = {
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
        readFile(toPath(key))
            .map(([status, data]) => status === 'error' ? undefined : data),
    write: (key: Vec, value: Vec): Effect<Fs, void> => {
        const p = toPath(key)
        const parts = parse(p)
        const dir = `${path}/${parts.slice(0, -1).join('/')}`
        // TODO: error handling
        return mkdir(dir, { recursive: true })
            .pipe(() => writeFile(`${path}/${p}`, value))
            .map(() => undefined)
    },
    list: (): Effect<Fs, readonly Vec[]> =>
        readdir('.cas', { recursive: true })
        // TODO: remove unwrap
        .map(r => unwrap(r).flatMap(name =>
                toOption(cBase32ToVec(name.replaceAll('/', ''))))
        ),
})

export type Cas<O extends Operations> = {
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    readonly write: (value: Vec) => Effect<O, Vec>
    readonly list: () => Effect<O, readonly Vec[]>
}

export const cas = (sha2: Sha2): <O extends Operations>(_: KvStore<O>) => Cas<O> => {
    const compute = computeSync(sha2)
    return ({ read, write, list }) => ({
        read,
        write: (value: Vec) => {
            const hash = compute([value])
            return write(hash, value)
                .map(() => hash)
        },
        list,
    })
}

const e = (s: string): Effect<NodeOperations, number> => error(s).map(() => 1)

export const main = (args: readonly string[]): Effect<NodeOperations, number> => {
    const c = cas(sha256)(fileKvStore('.'))
    const [cmd, ...options] = args
    switch (cmd) {
        case 'add': {
            if (options.length !== 1) {
                return e("'cas add' expects one parameter")
            }
            const [path] = options
            return readFile(path)
                .pipe(v => c.write(unwrap(v)))
                .pipe(hash => log(vecToCBase32(hash)))
                .map(() => 0)
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
            return c.read(hash)
                .pipe(v => {
                    const result: NodeEffect<number> = v === undefined
                        ? e(`no such hash: ${hashCBase32}`)
                        : writeFile(path, v).map(() => 0)
                    return result
                })
        }
        case 'list': {
            return c.list()
                .pipe(v => {
                    // TODO: make it lazy.
                    let i: Effect<NodeOperations, void> = pure(undefined)
                    for (const j of v) {
                        i = i.pipe(() => log(vecToCBase32(j)))
                    }
                    return i
                })
                .map(() => 0)
        }
        case undefined: {
            return e('Error: CAS command requires subcommand')
        }
        default:
            return e(`Error: Unknown CAS subcommand "${args[0]}"`)
    }
}
