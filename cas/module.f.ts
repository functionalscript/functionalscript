import { computeSync, type Sha2 } from "../crypto/sha2/module.f.ts"
import { todo } from "../dev/module.f.ts"
import type { Io } from "../io/module.f.ts"
import { parse } from "../path/module.f.ts"
import type { Vec } from "../types/bit_vec/module.f.ts"
import { cBase32ToVec, vecToCBase32 } from "../types/cbase32/module.f.ts"
import { type Effect, type Operations } from "../types/effect/module.f.ts"
import { error, mkdir, readdir, readFile, writeFile, type Error, type Fs, type NodeOperations } from "../types/effect/node/module.f.ts"
import { fromIo } from "../types/effect/node/module.ts"
import { compose } from "../types/function/module.f.ts"
import { toOption } from "../types/nullable/module.f.ts"
import { unwrap } from "../types/result/module.f.ts"
import { fromVec, toVec } from "../types/uint8array/module.f.ts"

export type KvStore2<O extends Operations> = {
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Effect<O, void>
    readonly list: () => Effect<O, readonly Vec[]>
}

export type KvStore = {
    readonly read: (key: Vec) => Promise<Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Promise<KvStore>
    readonly list: () => Promise<Iterable<Vec>>
}

export type Kv = readonly[Vec, Vec];

export const memKvStore = (): KvStore => {
    const create = (...i: readonly Kv[]): KvStore => {
        const store = new Map(i);
        return {
            read: async (key: Vec) => store.get(key),
            write: async (...kv: Kv) => create(...store, kv),
            list: async () => store.keys(),
        }
    }
    return create();
}

const o = { withFileTypes: true } as const

const split = (s: string) => [s.substring(0, 2), s.substring(2)]

const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split(s)
    const [b, c] = split(bc)
    return `${a}/${b}/${c}`
}

export const fileKvStore = (io: Io) => (path: string): KvStore => {
    const { readdir, readFile, writeFile, mkdir } = io.fs.promises
    const { asyncTryCatch } = io
    const result: KvStore = {
        read: async (key: Vec) => {
            const p = toPath(key)
            const [s, v] = await asyncTryCatch(() => readFile(`${path}/${p}`))
            if (s === 'error') { return undefined }
            return toVec(v)
        },
        write: async (key: Vec, value: Vec) => {
            const p = toPath(key)
            const parts = parse(p)
            const dir = `${path}/${parts.slice(0, -1).join('/')}`
            await mkdir(dir, { recursive: true })
            await writeFile(`${path}/${p}`, fromVec(value))
            return result
        },
        list: async () => {
            const f = async (p: string): Promise<readonly string[]> => {
                const dir = await readdir(p, o)
                let result: readonly string[] = []
                for (const entry of dir) {
                    const { name } = entry
                    if (entry.isFile()) {
                        result = [...result, name]
                        continue
                    }
                    // directory
                    const sub = await f(`${p}/${name}`)
                    result = [...result, ...sub.map(x => `${name}${x}`)]
                }
                return result
            }
            const all = await f(path)
            return all.flatMap(compose(cBase32ToVec)(toOption))
        },
    }
    return result
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

export const cas = (sha2: Sha2): (s: KvStore) => Cas => {
    const compute = computeSync(sha2)
    const f = ({ read, list, write }: KvStore): Cas => ({
        read,
        write: async (value: Vec) => {
            const hash = compute([value])
            return [f(await write(hash, value)), hash]
        },
        list,
    })
    return f
}

export const cas2 = (sha2: Sha2) => {
    const compute = computeSync(sha2)
    return <O extends Operations>({ read, write, list }: KvStore2<O>): Cas2<O> => ({
        read,
        write: (value: Vec) => {
            const hash = compute([value])
            return write(hash, value).map(() => hash)
        },
        list,
    })
}

export const main = (io: Io) => (args: readonly string[]): Promise<number> =>
    fromIo(io)(main2(args))

const e = <O extends Error>(s: string) => error<O>(s).map(() => 1)

export const main2 = <O extends NodeOperations>(args: readonly string[]): Effect<O, number> => {
    switch (args[0]) {
        case 'add': {
            return e('cas add command is not implemented yet')
        }
        case 'get': {
            return e('cas get command is not implemented yet')
        }
        case 'list': {
            return e('cas list command is not implemented yet')
        }
        case undefined: {
            return e('Error: cas command requires subcommand')
        }
        default:
            return e(`Error: Unknown CAS subcommand "${args[0]}"`)
    }
}
