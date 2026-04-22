export type Level = {
    readonly count: (i: bigint) => bigint
    readonly sum: (i: bigint) => bigint
    readonly next: (sequence: readonly bigint[]) => bigint
}

export const level = (n: bigint): Level => {
    const n1 = n - 1n
    const n2 = n - 2n
    const f = (i: bigint) => (1n << i) * n1
    const count = (i: bigint) => i < 0n ? 0n : f(i) + 1n
    const sum = (i: bigint) => f(i + 1n) - n2 + i
    return {
        count,
        sum,
        next: sequence =>
            sequence.slice(0, -2).reduce((a, b) => a + sum(b - 1n), 0n)
            + sum(sequence.at(-2)!)
            + sequence.at(-1)!
            - n
    }
}
