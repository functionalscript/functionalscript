export type Range = readonly [number, number]

export const contains: (range: Range) => (i: number) => boolean
    = ([b, e]) => i => b <= i && i <= e

export const one: (i: number) => Range
    = a => [a, a]
