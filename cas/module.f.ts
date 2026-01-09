import { readFile } from "fs/promises"
import { computeSync, type Sha2 } from "../crypto/sha2/module.f.ts"
import { todo } from "../dev/module.f.ts"
import type { Io } from "../io/module.f.ts"
import { type Vec } from "../types/bit_vec/module.f.ts"
import { fromCBase32, toCBase32 } from "../types/cbase32/module.f.ts"

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
    const s = toCBase32(key)
    const [a, bc] = split(s)
    const [b, c] = split(bc)
    return `${a}/${b}/${c}`
}

export const fileKvStore = (io: Io) => (path: string): KvStore => {
    const { readdir } = io.fs.promises
    const { asyncTryCatch } = io
    const result: KvStore = {
        read: async (key: Vec) => {
            const p = toPath(key)
            const [s, v] = await asyncTryCatch(() => readFile(`${path}/${p}`))
            if (s === 'error') { return undefined }
            return todo()
        },
        write: async (key: Vec, value: Vec) => {
            const p = toPath(key)
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
            return all.flatMap(c => {
                const [s, v] = fromCBase32(c)
                return s === 'ok' ? [v] : []
            })
        },
    }
    return result
}

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
