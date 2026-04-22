export type Level = {
    readonly count: (i: bigint) => bigint
    readonly sum: (i: bigint) => bigint
}

export const level = (n: bigint): Level => {
    const n1 = n - 1n
    const n2 = n - 2n
    const f = (i: bigint) => (1n << i) * n1
    const count = (i: bigint) => i < 0n ? 0n : f(i) + 1n
    return {
        count,
        sum: i => f(i + 1n) - n2 + i,
    }
}
