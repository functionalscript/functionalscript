export type InputRange = number

export type Sequence<K extends string> = readonly Rule<K>[]

export type Or<K extends string> = {
    readonly[k in string]: Rule<K>
}

export type Rule<K extends string> = Or<K> | Sequence<K> | InputRange | K

export type Set<K extends string> = Record<string, Rule<K>>

// https://stackoverflow.com/questions/57571664/typescript-type-for-an-object-with-only-one-key-no-union-type-allowed-as-a-key
type OneKey<K extends string, V> = {
    [P in K]: (Record<P, V> & Partial<Record<Exclude<K, P>, never>>) extends infer O
        ? { [Q in keyof O]: O[Q] }
        : never
}[K];

/*
const a: OneKey<'a'|'b', number> = {
    a: 1,
    // b: 2
}
*/
