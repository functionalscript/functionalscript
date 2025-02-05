export type InputRange = number

export type Sequence<K extends string> = readonly Rule<K>[]

export type Or<K extends string> = {
    readonly[k in string]: Rule<K>
}

export type Rule<K extends string> = Or<K> | Sequence<K> | InputRange | K

export type Set<K extends string> = Record<string, Rule<K>>

/*
const a: OneKey<'a'|'b', number> = {
    a: 1,
    // b: 2
}
*/
