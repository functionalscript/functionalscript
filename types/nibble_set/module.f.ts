export type NibbleSet = number
export type Nibble = number

export const empty = 0

export const universe = 0xFFFF

const one
    : (n: Nibble) => NibbleSet
    = n => 1 << n

export const has
    : (n: Nibble) => (s: NibbleSet) => boolean
    = n => s => ((s >> n) & 1) === 1

export const set
    : (n: Nibble) => (s: NibbleSet) => NibbleSet
    = n => s => s | one(n)

export const complement
    : (n: NibbleSet) => NibbleSet
    = s => universe ^ s

export const unset
    : (n: Nibble) => (s: NibbleSet) => NibbleSet
    = n => s => s & complement(one(n))

const range
    : (r: readonly [number, number]) => NibbleSet
    = ([a, b]) => one(b - a + 1) - 1 << a

export const setRange
    : (r: readonly [number, number]) => (s: NibbleSet) => NibbleSet
    = r => s => s | range(r)
