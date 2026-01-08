import { todo } from "../dev/module.f.ts"
import type { Io } from "../io/module.f.ts"
import { empty, length, msb, vec, type Vec } from "../types/bit_vec/module.f.ts"

export type Cas = {
    readonly read: (key: Vec) => Promise<Vec|undefined>
    readonly write: (key: Vec, value: Vec) => Promise<Cas>
    readonly list: () => Promise<Iterable<Vec>>
}

export type KeyValue = readonly[Vec, Vec];

export const memCas = (): Cas => {
    type Store = Map<Vec, Vec>;
    const create = (...i: readonly KeyValue[]): Cas => {
        const store = new Map(i);
        return {
            read: async (key: Vec) => store.get(key),
            write: async (...kv: KeyValue) => create(...store, kv),
            list: async () => store.keys(),
        }
    }
    return create();
}

export const fileCas = (io: Io) => (path: string): Cas => {
    const { readdir } = io.fs.promises;
    const result: Cas ={
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
