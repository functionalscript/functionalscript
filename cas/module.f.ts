import { computeSync, type Sha2 } from "../crypto/sha2/module.f.ts"
import { todo } from "../dev/module.f.ts"
import type { Io } from "../io/module.f.ts"
import { type Vec } from "../types/bit_vec/module.f.ts"

export type KvStore = {
    readonly read: (key: Vec) => Promise<Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Promise<KvStore>
    readonly list: () => Promise<Iterable<Vec>>
}

export type Kv = readonly[Vec, Vec];

export const memStore = (): KvStore => {
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

export const fileStore = (io: Io) => (path: string): KvStore => {
    const { readdir } = io.fs.promises;
    const result: KvStore ={
        read: async (key: Vec) => {
            const dir = await readdir(path, { withFileTypes: true })
            return todo()
        },
        write: async (key: Vec, value: Vec) => {
            todo()
            return result
        },
        list: async () => todo(),
    }
    return result
}

export type Cas = {
    readonly read: (key: Vec) => Promise<Vec|undefined>
    readonly write: (value: Vec) => Promise<readonly[Cas, Vec]>
    readonly list: () => Promise<Iterable<Vec>>
}

export const cas = (sha2: Sha2) => {
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
