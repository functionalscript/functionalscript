import { computeSync, type Sha2 } from "../crypto/sha2/module.f.ts"
import { todo } from "../dev/module.f.ts"
import type { Io } from "../io/module.f.ts"
import { type Vec } from "../types/bit_vec/module.f.ts"

export type KeyValueStore = {
    readonly read: (key: Vec) => Promise<Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Promise<KeyValueStore>
    readonly list: () => Promise<Iterable<Vec>>
}

export type KeyValue = readonly[Vec, Vec];

export const memStore = (): KeyValueStore => {
    type Store = Map<Vec, Vec>;
    const create = (...i: readonly KeyValue[]): KeyValueStore => {
        const store = new Map(i);
        return {
            read: async (key: Vec) => store.get(key),
            write: async (...kv: KeyValue) => create(...store, kv),
            list: async () => store.keys(),
        }
    }
    return create();
}

export const fileStore = (io: Io) => (path: string): KeyValueStore => {
    const { readdir } = io.fs.promises;
    const result: KeyValueStore ={
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
    const f = ({ read, list, write }: KeyValueStore): Cas => ({
        read,
        write: async (value: Vec) => {
            const hash = compute([value])
            return [f(await write(hash, value)), hash]
        },
        list,
    })
    return f
}
