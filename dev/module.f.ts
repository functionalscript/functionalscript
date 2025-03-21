export const todo = (): never => { throw 'not implemented' }

export type Module = {
    readonly default?: unknown
}

export type UnknownMap = {
    readonly[k in string]: unknown
}

type Entry<T> = readonly[string, T]

export const cmp = ([a]: Entry<unknown>, [b]: Entry<unknown>) =>
    a < b ? -1 : a > b ? 1 : 0

export type ModuleMap = {
   readonly[k in string]: Module
}

export const remove_tail = (v: readonly string[]) => (dif: number) =>
    v.slice(0, v.length - dif)
