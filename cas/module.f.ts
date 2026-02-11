import { computeSync, type Sha2 } from "../crypto/sha2/module.f.ts"
import { todo } from "../dev/module.f.ts"
import type { Io } from "../io/module.f.ts"
import { type Vec } from "../types/bit_vec/module.f.ts"
import { cBase32ToVec, vecToCBase32 } from "../types/cbase32/module.f.ts"
import { pure, type Effect, type Operations } from "../types/effect/module.f.ts"
import { mkdir, readFile, writeFile, type Fs, type IoResult } from "../types/effect/node/module.f.ts"
import { compose } from "../types/function/module.f.ts"
import { toOption } from "../types/nullable/module.f.ts"
import { fromVec, toVec } from "../types/uint8array/module.f.ts"

export type KvStore2<O extends Operations> = {
    readonly read: (key: Vec) => Effect<O, Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Effect<O, void>
    readonly list: () => Effect<O, readonly[Vec]>
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
            const parts = p.split('/')
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
            .flatMap(([status, data]) => pure(status === 'error' ? undefined : data)),
    write: (key: Vec, value: Vec): Effect<O, void> => {
        const p = toPath(key)
        const parts = p.split('/')
        const dir = `${path}/${parts.slice(0, -1).join('/')}`
        // TODO: error handling
        return mkdir<O>(dir, { recursive: true })
            .flatMap(() => writeFile(`${path}/${p}`, value))
            .flatMap(() => pure(undefined))
    },
    list: (): Effect<O, readonly[Vec]> => todo(),
})

export type Cas = {
    readonly read: (key: Vec) => Promise<Vec|undefined>
    readonly write: (value: Vec) => Promise<readonly[Cas, Vec]>
    readonly list: () => Promise<Iterable<Vec>>
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

export const main = (io: Io) => (args: readonly string[]): Promise<number> => {
    const { error } = io.console
    switch (args[0]) {
        case 'add': {
            error('cas add command is not implemented yet')
            break
        }
        case 'get': {
            error('cas get command is not implemented yet')
            break
        }
        case 'list': {
            error('cas list command is not implemented yet')
            break
        }
        case undefined: {
            error('Error: cas command requires subcommand')
            break
        }
        default: {
            error(`Error: Unknown cas subcommand "${args[0]}"`)
        }
    }
    return Promise.resolve(1)
}
