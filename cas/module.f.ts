import { computeSync, sha256, type Sha2 } from "../crypto/sha2/module.f.ts"
import type { Io } from "../io/module.f.ts"
import { parse } from "../path/module.f.ts"
import type { Vec } from "../types/bit_vec/module.f.ts"
import { cBase32ToVec, vecToCBase32 } from "../types/cbase32/module.f.ts"
import { pure, type Effect, type Operations } from "../types/effect/module.f.ts"
import { error, log, mkdir, readdir, readFile, writeFile, type Error, type Fs, type NodeOperations } from "../types/effect/node/module.f.ts"
import { fromIo } from "../types/effect/node/module.ts"
import { toOption } from "../types/nullable/module.f.ts"
import { unwrap } from "../types/result/module.f.ts"

export type KvStore2<O extends Operations> = {
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Effect<O, void>
    readonly list: () => Effect<O, readonly Vec[]>
}

export type Kv = readonly[Vec, Vec];

const o = { withFileTypes: true } as const

const split = (s: string) => [s.substring(0, 2), s.substring(2)]

const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split(s)
    const [b, c] = split(bc)
    return `${a}/${b}/${c}`
}

export const fileKvStore2 = <O extends Fs>(path: string): KvStore2<O> => ({
    read: (key: Vec): Effect<O, Vec|undefined> =>
        readFile<O>(toPath(key))
            .map(([status, data]) => status === 'error' ? undefined : data),
    write: (key: Vec, value: Vec): Effect<O, void> => {
        const p = toPath(key)
        const parts = parse(p)
        const dir = `${path}/${parts.slice(0, -1).join('/')}`
        // TODO: error handling
        return mkdir<O>(dir, { recursive: true })
            .pipe(() => writeFile(`${path}/${p}`, value))
            .map(() => undefined)
    },
    list: (): Effect<O, readonly Vec[]> =>
        readdir<O>('', { recursive: true })
        // TODO: remove unwrap
        .map(r => unwrap(r).flatMap(name =>
            toOption(cBase32ToVec(name.replaceAll('/', '')))
        )),
})

export type Cas = {
    readonly read: (key: Vec) => Promise<Vec|undefined>
    readonly write: (value: Vec) => Promise<readonly[Cas, Vec]>
    readonly list: () => Promise<Iterable<Vec>>
}

export type Cas2<O extends Operations> = {
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    readonly write: (value: Vec) => Effect<O, Vec>
    readonly list: () => Effect<O, readonly Vec[]>
}

export const cas2 = (sha2: Sha2) => {
    const compute = computeSync(sha2)
    return <O extends Operations>({ read, write, list }: KvStore2<O>): Cas2<O> => ({
        read,
        write: (value: Vec) => {
            const hash = compute([value])
            return write(hash, value)
                .map(() => hash)
        },
        list,
    })
}

export const main = (io: Io) => (args: readonly string[]): Promise<number> =>
    fromIo(io)(main2(args))

const e = <O extends Error>(s: string) => error<O>(s).map(() => 1)

export const main2 = <O extends NodeOperations>(args: readonly string[]): Effect<O, number> => {
    const c = cas2(sha256)(fileKvStore2<O>('.'))
    const [cmd, ...options] = args
    switch (cmd) {
        case 'add': {
            if (options.length !== 1) {
                return e("'cas add' expects one parameter")
            }
            const [path] = options
            return readFile<O>(path)
                .pipe(v => c.write(unwrap(v)))
                .pipe(hash => log<O>(vecToCBase32(hash)))
                .map(() => 0)
        }
        case 'get': {
            if (options.length !== 2) {
                return e("'cas get' expects two parameters")
            }
            const [hashCBase32, path] = options
            const hash = cBase32ToVec(hashCBase32)
            if (hash === null) {
                return e(`invalid hash format ${hashCBase32}`)
            }
            return c.read(hash)
                .pipe(v => v === undefined
                    ? e('no such hash')
                    : writeFile<O>(path, v).map(() => 0)
                )
        }
        case 'list': {
            return c.list()
                .pipe(v => {
                    let i: Effect<O, void> = pure(undefined)
                    for (const j of v) {
                        i = i.pipe(() => log(vecToCBase32(j)))
                    }
                    return i
                })
                .map(() => 0)
        }
        case undefined: {
            return e('Error: cas command requires subcommand')
        }
        default:
            return e(`Error: Unknown CAS subcommand "${args[0]}"`)
    }
}
